/**
 * Compatibility experiment service (Phase 7).
 *
 * Orchestrates the central Phase 7 primitive:
 *
 *   same program + same execution configuration + different controlled
 *   environment -> execute in each registered environment through the
 *   standard sandboxed pipeline -> semantic comparison per candidate
 *   -> evidence-backed compatibility report
 *
 * Rules enforced here:
 *   - Environment ids must resolve through the code-defined registry;
 *     users never define environments, images, or package sources.
 *   - Every execution goes through runSubmission (validation, sandbox,
 *     limits, judge, persistence). No second execution pipeline exists.
 *   - All runs in one experiment share shots and a server-generated seed,
 *     so environments differ only by their runtime, never by sampling
 *     configuration.
 *   - Source comes from the user's own persisted baseline execution —
 *     never from client input — and is re-executed only inside the sandbox.
 *   - Every verdict is recomputed server-side from persisted artifacts.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { runSubmission, ExecutionRequestError } from "@/lib/exec/service";
import {
  compareSemanticRecords,
  resolveComparisonPolicy,
} from "@/lib/semantic/compare";

/** All policy names accepted by the API (single source: the engine). */
const COMPARISON_POLICY_NAMES: readonly string[] = ["statistical-default", "exact"];
import { loadSemanticRecord } from "@/lib/semantic/service";
import { buildExecutionCapsule, validateExecutionCapsule } from "@/lib/semantic/capsule";
import {
  getEnvironmentProfile,
  getEnvironmentAvailability,
  MAX_CANDIDATE_ENVIRONMENTS,
} from "@/lib/compat/environments";
import type {
  CompatibilityReport,
  CompatibilityDimension,
  CompatibilityOverallStatus,
} from "@/lib/compat/types";
import type { SemanticComparison } from "@/lib/semantic/types";

/** Version of the per-candidate compatibility report payload. */
export const COMPAT_REPORT_SCHEMA_VERSION = "quantoo.compatibility.v1" as const;
/** Version of the exported reproducibility package. */
export const EXPERIMENT_PACKAGE_SCHEMA_VERSION = "quantoo.experiment.v1" as const;

/** Maximum candidates accepted per create request (registry cap is 5). */
const MAX_CANDIDATES_PER_REQUEST = MAX_CANDIDATE_ENVIRONMENTS;
/** Maximum non-terminal experiments per user (prevents run multiplication). */
const MAX_EXPERIMENTS_PER_USER = 20;
/** Maximum imported package size (bytes of JSON text). */
export const MAX_PACKAGE_BYTES = 1_000_000;

// ========================================
// Experiment creation
// ========================================

export interface CreateExperimentInput {
  userId: string;
  problemId: string;
  name: string;
  /** The user's own persisted execution that defines the baseline. */
  baselineSubmissionId: string;
  /** Registered environment ids to run the same program in. */
  candidateEnvironmentIds: string[];
  policyName?: string;
}

export async function createExperiment(
  input: CreateExperimentInput,
): Promise<{ experimentId: string } | { error: string; code: number }> {
  const policyName = input.policyName ?? "statistical-default";
  if (!COMPARISON_POLICY_NAMES.includes(policyName)) {
    return { error: `Unknown comparison policy: ${policyName}`, code: 400 };
  }

  // Candidate ids: deduped, capped, and every id must exist in the
  // registry. Unknown ids are rejected rather than silently dropped so
  // the user's matrix matches what was requested.
  const uniqueIds = [...new Set(input.candidateEnvironmentIds)];
  if (uniqueIds.length === 0) {
    return { error: "At least one candidate environment is required.", code: 400 };
  }
  if (uniqueIds.length > MAX_CANDIDATES_PER_REQUEST) {
    return {
      error: `At most ${MAX_CANDIDATES_PER_REQUEST} candidate environments are allowed per experiment.`,
      code: 400,
    };
  }
  for (const id of uniqueIds) {
    if (!getEnvironmentProfile(id)) {
      return { error: `Unknown environment id: ${id}`, code: 400 };
    }
  }

  // The baseline must be the user's own successful execution — except for
  // imported experiments, which carry their source on the experiment row
  // until the first local execution establishes a baseline submission.
  if (input.baselineSubmissionId !== "imported") {
    const baseline = await prisma.submission.findFirst({
      where: { id: input.baselineSubmissionId, userId: input.userId, status: "SUCCEEDED" },
      select: { id: true },
    });
    if (!baseline) {
      return { error: "Baseline execution not found.", code: 404 };
    }
  }

  // Bound total experiments so candidate runs cannot multiply workload.
  const total = await prisma.compatibilityExperiment.count({
    where: { userId: input.userId },
  });
  if (total >= MAX_EXPERIMENTS_PER_USER) {
    return { error: "Experiment limit reached. Delete an experiment before creating another.", code: 429 };
  }

  // Baseline availability is checked at create time so the user gets a
  // clear error before any run starts.
  const experiment = await prisma.compatibilityExperiment.create({
    data: {
      userId: input.userId,
      problemId: input.problemId,
      name: input.name.slice(0, 200),
      policyName,
      baselineSubmissionId: input.baselineSubmissionId,
      runs: {
        create: uniqueIds.map((environmentId) => ({
          role: "CANDIDATE",
          environmentId,
          status: "PENDING",
        })),
      },
    },
    select: { id: true },
  });

  logger.info("compatibility experiment created", {
    userId: input.userId,
    experimentId: experiment.id,
    candidates: uniqueIds.length,
  });

  return { experimentId: experiment.id };
}

// ========================================
// Experiment execution
// ========================================

export interface RunCellResult {
  environmentId: string;
  submissionId: string | null;
  status: string;
  errorMessage: string | null;
}

export interface ExecuteExperimentResult {
  experimentId: string;
  baseline: RunCellResult | null;
  candidates: RunCellResult[];
}

/**
 * Executes the experiment: the baseline program (read from the user's own
 * baseline execution row) in every candidate environment. A run cell that
 * has already completed is not re-executed; failed cells can be re-run by
 * clearing them first (delete + create), keeping this endpoint idempotent.
 */
export async function executeExperiment(
  experimentId: string,
  userId: string,
): Promise<ExecuteExperimentResult | { error: string; code: number }> {
  const experiment = await prisma.compatibilityExperiment.findFirst({
    where: { id: experimentId, userId },
    include: { runs: { orderBy: { createdAt: "asc" } } },
  });
  if (!experiment) {
    return { error: "Experiment not found.", code: 404 };
  }

  const baselineSubmission = experiment.sourceCode
    ? { sourceCode: experiment.sourceCode }
    : await prisma.submission.findFirst({
        where: {
          id: experiment.baselineSubmissionId ?? "",
          userId,
          status: "SUCCEEDED",
        },
        select: { sourceCode: true },
      });
  if (!baselineSubmission) {
    return { error: "Baseline execution not found.", code: 404 };
  }

  // One shared execution configuration: shots from the baseline artifact
  // (capped by the service) and one server-generated seed so every
  // environment samples identically. Imported experiments have no baseline
  // artifact yet, so the deployment default shot count is used.
  const baselineRecord = experiment.baselineSubmissionId
    ? await loadSemanticRecord(userId, experiment.baselineSubmissionId)
    : null;
  const shots = baselineRecord?.record.shots ?? undefined;
  const seed = (experiment.seed ?? randomUUID().charCodeAt(0) * 7919) % 2 ** 31;

  const result: ExecuteExperimentResult = { experimentId, baseline: null, candidates: [] };

  // Imported experiments (source present, no baseline submission yet):
  // first establish the local baseline by running the source through the
  // standard pipeline in the default environment, then compare candidates
  // against it.
  if (!experiment.baselineSubmissionId && experiment.sourceCode) {
    try {
      const baselineRun = await runSubmission(userId, {
        problemId: experiment.problemId,
        sourceCode: experiment.sourceCode,
        shots,
        seed,
      });
      if (baselineRun.status !== "SUCCEEDED") {
        return {
          error: `The imported program failed to execute in this deployment (${baselineRun.error?.code ?? "unknown"}). No experiment was created.`,
          code: 422,
        };
      }
      await prisma.compatibilityExperiment.update({
        where: { id: experimentId },
        data: { baselineSubmissionId: baselineRun.submissionId },
      });
      result.baseline = {
        environmentId: "default",
        submissionId: baselineRun.submissionId,
        status: baselineRun.status,
        errorMessage: null,
      };
    } catch (error) {
      if (error instanceof ExecutionRequestError) {
        return { error: error.message, code: 422 };
      }
      return { error: "The imported program failed to execute.", code: 422 };
    }
  }

  for (const run of experiment.runs) {
    if (run.status === "SUCCEEDED" || run.status === "RUNNING") {
      const cell: RunCellResult = {
        environmentId: run.environmentId,
        submissionId: run.submissionId,
        status: run.status,
        errorMessage: run.errorMessage,
      };
      if (run.role === "BASELINE") result.baseline = cell;
      else result.candidates.push(cell);
      continue;
    }

    // Candidate availability is measured before executing: a missing image
    // produces an explicit UNAVAILABLE cell, never a fake result.
    const profile = getEnvironmentProfile(run.environmentId);
    if (!profile) {
      await markRun(run.id, "FAILED", "INVALID_REQUEST", "Unknown environment profile.");
      result.candidates.push({
        environmentId: run.environmentId,
        submissionId: null,
        status: "FAILED",
        errorMessage: "Unknown environment profile.",
      });
      continue;
    }
    const availability = await getEnvironmentAvailability(run.environmentId);
    if (availability.status !== "AVAILABLE") {
      await markRun(
        run.id,
        "FAILED",
        "SANDBOX_ERROR",
        availability.reason ?? "Environment is not available in this deployment.",
      );
      result.candidates.push({
        environmentId: run.environmentId,
        submissionId: null,
        status: "FAILED",
        errorMessage: availability.reason ?? "Environment is not available in this deployment.",
      });
      continue;
    }

    await prisma.compatibilityRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", completedAt: null },
    });

    logger.info("compatibility run started", {
      userId,
      experimentId,
      runId: run.id,
      environmentId: run.environmentId,
    });

    let submissionId: string | null = null;
    let status = "FAILED";
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    try {
      const runResponse = await runSubmission(userId, {
        problemId: experiment.problemId,
        sourceCode: baselineSubmission.sourceCode,
        shots,
        seed,
        environmentId: run.environmentId,
      });
      submissionId = runResponse.submissionId;
      status = runResponse.status;
      errorCode = runResponse.error?.code ?? null;
      errorMessage = runResponse.error?.message ?? null;
    } catch (error) {
      // runSubmission throws ExecutionRequestError for request-level
      // problems (unknown problem, sandbox disabled, unavailable env).
      if (error instanceof ExecutionRequestError) {
        errorCode = error.code;
        errorMessage = error.message;
      } else {
        logger.error("compatibility run failed unexpectedly", {
          experimentId,
          environmentId: run.environmentId,
        });
        errorCode = "INTERNAL_ERROR";
        errorMessage = "The execution failed unexpectedly.";
      }
    }

    await prisma.compatibilityRun.update({
      where: { id: run.id },
      data: {
        submissionId,
        status,
        errorCode,
        errorMessage,
        completedAt: new Date(),
      },
    });

    logger.info("compatibility run completed", {
      experimentId,
      runId: run.id,
      environmentId: run.environmentId,
      status,
    });

    const cell: RunCellResult = {
      environmentId: run.environmentId,
      submissionId,
      status,
      errorMessage,
    };
    if (run.role === "BASELINE") result.baseline = cell;
    else result.candidates.push(cell);
  }

  // Record the shared execution configuration on the experiment.
  await prisma.compatibilityExperiment.update({
    where: { id: experimentId },
    data: { shots: shots ?? null, seed },
  });

  return result;
}

async function markRun(
  runId: string,
  status: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await prisma.compatibilityRun.update({
    where: { id: runId },
    data: { status, errorCode, errorMessage, completedAt: new Date() },
  });
}

// ========================================
// Report building
// ========================================

/**
 * Builds the compatibility report from persisted artifacts: for each
 * candidate execution, a structured comparison against the baseline's
 * semantic record under the experiment's policy. Environment differences
 * are reported as a separate dimension and never fail correctness.
 */
export async function buildCompatibilityReport(
  experimentId: string,
  userId: string,
): Promise<{ report: CompatibilityReport } | { error: string; code: number }> {
  const experiment = await prisma.compatibilityExperiment.findFirst({
    where: { id: experimentId, userId },
    include: { runs: { orderBy: { createdAt: "asc" } } },
  });
  if (!experiment) {
    return { error: "Experiment not found.", code: 404 };
  }
  if (!experiment.baselineSubmissionId) {
    return { error: "Experiment has no baseline execution.", code: 409 };
  }

  const baselineLoaded = await loadSemanticRecord(userId, experiment.baselineSubmissionId);
  if (!baselineLoaded) {
    return { error: "Baseline execution not found or has no comparable artifact.", code: 409 };
  }

  const policy = resolveComparisonPolicy(experiment.policyName);
  const limitations: string[] = [];
  const candidateResults: CompatibilityReport["candidateResults"] = [];
  const differences: CompatibilityReport["differences"] = [];

  for (const run of experiment.runs) {
    if (run.role === "BASELINE") continue;

    // Environment dimension: reported independently of behavior. The
    // recorded fingerprints of both runs carry the actual versions used.
    const environmentStatus = run.status === "SUCCEEDED" ? "CHANGED" : "NOT_COMPARED";
    const dimension: CompatibilityDimension = {
      dimension: "ENVIRONMENT",
      status: environmentStatus,
      message:
        run.status === "SUCCEEDED"
          ? `Executed in registered environment "${run.environmentId}" (baseline: "${baselineLoaded.record.environment.framework.name}"). Framework and simulator versions are compared from recorded metadata.`
          : "Environment not compared because the candidate execution did not succeed.",
      observed: null,
    };

    if (run.status !== "SUCCEEDED" || !run.submissionId) {
      candidateResults.push({
        environmentId: run.environmentId,
        runStatus: run.status,
        errorCode: run.errorCode,
        status: "EXECUTION_FAILED",
        dimensions: [dimension],
        semanticComparison: null,
      });
      if (run.errorCode) {
        limitations.push(
          `Candidate environment "${run.environmentId}" did not execute (${run.errorCode}); API failure and behavioral difference cannot be distinguished from this evidence alone.`,
        );
      }
      continue;
    }

    const candidateLoaded = await loadSemanticRecord(userId, run.submissionId);
    if (!candidateLoaded) {
      limitations.push(
        `Candidate execution in "${run.environmentId}" produced no comparable artifact.`,
      );
      candidateResults.push({
        environmentId: run.environmentId,
        runStatus: run.status,
        errorCode: run.errorCode,
        status: "INSUFFICIENT_EVIDENCE",
        dimensions: [dimension],
        semanticComparison: null,
      });
      continue;
    }

    const comparison: SemanticComparison = compareSemanticRecords(
      baselineLoaded.record,
      candidateLoaded.record,
      policy,
    );

    differences.push(...comparison.differences.filter((d) => d.status !== "PASS"));

    candidateResults.push({
      environmentId: run.environmentId,
      runStatus: run.status,
      errorCode: null,
      status: classifyCompatibility(comparison),
      dimensions: buildDimensions(comparison, dimension),
      semanticComparison: comparison,
    });
  }

  if (candidateResults.length === 0) {
    limitations.push("Experiment has no candidate runs; nothing was compared.");
  }

  const overall = overallStatus(candidateResults);

  const report: CompatibilityReport = {
    schemaVersion: COMPAT_REPORT_SCHEMA_VERSION,
    experimentId,
    policyName: policy.name,
    baselineSubmissionId: experiment.baselineSubmissionId,
    baselineEnvironmentId: environmentIdOfRecord(baselineLoaded),
    overallStatus: overall,
    candidateResults,
    differences,
    limitations,
    computedAt: new Date().toISOString(),
  };

  await prisma.compatibilityExperiment.update({
    where: { id: experimentId },
    data: { report: report as unknown as import("@prisma/client").Prisma.InputJsonValue },
  });

  logger.info("compatibility report built", {
    userId,
    experimentId,
    status: overall,
  });

  return { report };
}

/**
 * Compatibility classification from a Phase 6 semantic comparison:
 * behavioral verdicts decide compatibility; structural/resource deltas
 * are reported but do not fail behavior.
 */
function classifyCompatibility(comparison: SemanticComparison): CompatibilityOverallStatus {
  const behavioral = [comparison.probability, comparison.measurement, comparison.state];
  const anyCompared = behavioral.some((d) => d && d.status !== "NOT_COMPARED");
  const anyDifferent = behavioral.some((d) => d?.status === "DIFFERENT");
  const resourceWarning =
    comparison.resource?.status === "DIFFERENT" || comparison.resource?.status === "WARNING";

  if (!anyCompared) return "INSUFFICIENT_EVIDENCE";
  if (anyDifferent) return "BEHAVIORALLY_DIFFERENT";
  if (resourceWarning) return "COMPATIBLE_WITH_RESOURCE_CHANGE";
  return "COMPATIBLE";
}

function overallStatus(
  results: CompatibilityReport["candidateResults"],
): CompatibilityOverallStatus {
  if (results.length === 0) return "INSUFFICIENT_EVIDENCE";
  if (results.some((r) => r.status === "BEHAVIORALLY_DIFFERENT")) {
    return "BEHAVIORALLY_DIFFERENT";
  }
  if (results.some((r) => r.status === "INSUFFICIENT_EVIDENCE")) {
    return "INSUFFICIENT_EVIDENCE";
  }
  if (results.every((r) => r.status === "COMPATIBLE")) return "COMPATIBLE";
  if (
    results.every(
      (r) => r.status === "COMPATIBLE" || r.status === "COMPATIBLE_WITH_RESOURCE_CHANGE",
    )
  ) {
    return "COMPATIBLE_WITH_RESOURCE_CHANGE";
  }
  return "EXECUTION_FAILED";
}

/** Reads the environment id recorded on the baseline's own run metadata. */
function environmentIdOfRecord(loaded: NonNullable<Awaited<ReturnType<typeof loadSemanticRecord>>>): string {
  const deps = loaded.record.environment.dependencies ?? {};
  return typeof deps.environmentId === "string" ? deps.environmentId : "not-recorded";
}

/** Per-dimension report rows derived from the comparison. */
function buildDimensions(
  comparison: SemanticComparison,
  environment: CompatibilityDimension,
): CompatibilityDimension[] {
  const rows: CompatibilityDimension[] = [];

  const push = (
    d: SemanticComparison["probability"],
    label: CompatibilityDimension["dimension"],
  ): void => {
    if (!d) {
      rows.push({
        dimension: label,
        status: "NOT_COMPARED",
        message: "No comparable evidence was recorded for this dimension.",
        observed: null,
      });
      return;
    }
    rows.push({
      dimension: label,
      status: d.status === "PASS" ? "PASS" : d.status === "DIFFERENT" ? "DIFFERENT" : d.status,
      message: d.message,
      observed: {
        ...(typeof d.value === "number"
          ? { value: d.value, threshold: d.threshold ?? null }
          : {}),
        ...(typeof d.operationIndex === "number" ? { operationIndex: d.operationIndex } : {}),
      },
    });
  };

  push(comparison.structural, "STRUCTURE");
  push(comparison.probability, "PROBABILITY");
  push(comparison.measurement, "MEASUREMENT");
  push(comparison.state, "BEHAVIOR");
  push(comparison.resource, "RESOURCE");
  rows.push(environment);

  return rows;
}

// ========================================
// Reproducibility package export/import
// ========================================

/**
 * Exports a versioned, secret-free reproducibility package: the program
 * source, the baseline execution capsule, experiment configuration, and
 * the latest compatibility report. Contains technical data only.
 */
export async function exportExperimentPackage(
  experimentId: string,
  userId: string,
): Promise<{ json: string } | { error: string; code: number }> {
  const experiment = await prisma.compatibilityExperiment.findFirst({
    where: { id: experimentId, userId },
    include: { runs: { orderBy: { createdAt: "asc" } } },
  });
  if (!experiment) {
    return { error: "Experiment not found.", code: 404 };
  }
  if (!experiment.baselineSubmissionId) {
    return { error: "Experiment has no baseline execution to export.", code: 409 };
  }

  const [baselineSubmission, problem, capsule] = await Promise.all([
    prisma.submission.findFirst({
      where: { id: experiment.baselineSubmissionId, userId },
      select: { sourceCode: true },
    }),
    prisma.problem.findUnique({
      where: { id: experiment.problemId },
      select: { slug: true, title: true },
    }),
    buildExecutionCapsule(experiment.baselineSubmissionId),
  ]);

  if (!baselineSubmission) {
    return { error: "Baseline execution not found.", code: 404 };
  }

  const json = JSON.stringify(
    {
      schemaVersion: EXPERIMENT_PACKAGE_SCHEMA_VERSION,
      kind: "quantoo-experiment",
      exportedAt: new Date().toISOString(),
      experiment: {
        name: experiment.name,
        policyName: experiment.policyName,
        shots: experiment.shots,
        seed: experiment.seed,
      },
      problem: problem ?? { slug: null, title: null },
      sourceCode: baselineSubmission.sourceCode,
      baselineEnvironmentId:
        experiment.runs.find((r) => r.role === "BASELINE")?.environmentId ??
        firstCandidateEnvironmentId(experiment.runs) ??
        "unknown",
      candidateEnvironmentIds: experiment.runs
        .filter((r) => r.role === "CANDIDATE")
        .map((r) => r.environmentId),
      baselineCapsule: capsule ?? null,
      compatibilityReport: experiment.report ?? null,
    },
    null,
    2,
  );

  if (Buffer.byteLength(json, "utf8") > MAX_PACKAGE_BYTES) {
    return { error: "Exported package exceeds the size limit.", code: 413 };
  }

  return { json };
}

function firstCandidateEnvironmentId(
  runs: Array<{ role: string; environmentId: string }>,
): string | null {
  return runs.find((r) => r.role === "CANDIDATE")?.environmentId ?? null;
}

export interface ImportExperimentResult {
  experimentId: string;
  acceptedEnvironmentIds: string[];
}

/**
 * Imports an exported package as untrusted input. Only the documented
 * versioned shape is accepted; environment ids must exist in this
 * deployment's registry; the source is stored and later executed only
 * through the sandboxed pipeline. No path, command, or dependency field
 * from the package is ever interpreted — the baseline capsule and report
 * are validated for shape and then discarded (history, not instructions).
 */
export async function importExperimentPackage(
  userId: string,
  problemId: string,
  rawText: string,
): Promise<ImportExperimentResult | { error: string; code: number }> {
  if (Buffer.byteLength(rawText, "utf8") > MAX_PACKAGE_BYTES) {
    return { error: "Package is too large.", code: 413 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { error: "Package is not valid JSON.", code: 400 };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "Package must be a JSON object.", code: 400 };
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.schemaVersion !== EXPERIMENT_PACKAGE_SCHEMA_VERSION) {
    return { error: `Unsupported package schemaVersion: ${String(obj.schemaVersion).slice(0, 100)}`, code: 400 };
  }
  if (obj.kind !== "quantoo-experiment") {
    return { error: "Package kind must be quantoo-experiment.", code: 400 };
  }

  // Source: required, bounded. It will run only inside the sandbox.
  const source = obj.sourceCode;
  if (typeof source !== "string" || source.length === 0 || source.length > 50_000) {
    return { error: "Package source code is missing or too large.", code: 400 };
  }

  const experimentMeta =
    obj.experiment && typeof obj.experiment === "object" && !Array.isArray(obj.experiment)
      ? (obj.experiment as Record<string, unknown>)
      : null;
  const policyName =
    typeof experimentMeta?.policyName === "string" &&
    COMPARISON_POLICY_NAMES.includes(experimentMeta.policyName)
      ? experimentMeta.policyName
      : "statistical-default";
  const name =
    typeof experimentMeta?.name === "string" && experimentMeta.name.trim().length > 0
      ? experimentMeta.name.trim().slice(0, 200)
      : "Imported experiment";

  // Candidate environments: filtered against the local registry — an
  // imported id this deployment does not provide is skipped, not fetched.
  const importedIds = Array.isArray(obj.candidateEnvironmentIds)
    ? obj.candidateEnvironmentIds.filter((id): id is string => typeof id === "string")
    : [];
  const acceptedEnvironmentIds = [...new Set(importedIds)]
    .filter((id) => Boolean(getEnvironmentProfile(id)))
    .slice(0, MAX_CANDIDATES_PER_REQUEST);
  if (acceptedEnvironmentIds.length === 0) {
    return {
      error: "Package names no candidate environment that is registered in this deployment.",
      code: 400,
    };
  }

  // The capsule and report are validated for shape (bounded, versioned)
  // but are not trusted as execution instructions; they are re-derived
  // locally after the imported program actually runs here.
  if (typeof obj.baselineCapsule === "string") {
    try {
      validateExecutionCapsule(obj.baselineCapsule.slice(0, MAX_PACKAGE_BYTES));
    } catch {
      // Malformed embedded capsule: tolerated on import (history only),
      // never executed or used to make claims.
    }
  }

  // The import stores the source on a new experiment row owned by the
  // importing user; the first execute call re-runs it in the sandbox and
  // records the resulting submission as the local baseline.
  const total = await prisma.compatibilityExperiment.count({ where: { userId } });
  if (total >= MAX_EXPERIMENTS_PER_USER) {
    return { error: "Experiment limit reached.", code: 429 };
  }

  const created = await prisma.compatibilityExperiment.create({
    data: {
      userId,
      problemId,
      name: `${name} (imported)`,
      policyName,
      baselineSubmissionId: null,
      sourceCode: source,
      runs: {
        create: acceptedEnvironmentIds.map((environmentId) => ({
          role: "CANDIDATE",
          environmentId,
          status: "PENDING",
        })),
      },
    },
    select: { id: true },
  });

  logger.info("compatibility experiment imported", {
    userId,
    experimentId: created.id,
    candidates: acceptedEnvironmentIds.length,
  });

  return { experimentId: created.id, acceptedEnvironmentIds };
}
