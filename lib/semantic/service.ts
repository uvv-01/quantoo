/**
 * Semantic observatory service (Phase 6).
 *
 * Server-side orchestration over real execution artifacts: semantic
 * record loading with ownership enforcement, execution comparison,
 * baseline management, and capsule-based reproduction.
 *
 * Rules:
 *   - Identity comes from the session; the API layer passes userId in.
 *   - Every verdict is recomputed server-side from persisted artifacts.
 *     Client-supplied verdicts are never trusted.
 *   - Reproduction re-executes the user's own code inside the same
 *     sandboxed pipeline (limits, rate limits, judging) as a normal run;
 *     it introduces no new execution path.
 *   - Failed or artifact-less executions have no semantic record: the
 *     service reports that honestly instead of inventing evidence.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { runSubmission } from "@/lib/exec/service";
import {
  compareSemanticRecords,
  resolveComparisonPolicy,
} from "@/lib/semantic/compare";
import { extractSemanticRecord } from "@/lib/semantic/record";
import type {
  ComparisonPolicy,
  SemanticComparison,
  SemanticRecord,
  SemanticStatus,
} from "@/lib/semantic/types";

// ========================================
// Record loading (ownership enforced)
// ========================================

export interface OwnedSubmission {
  id: string;
  userId: string;
  problemId: string;
  sourceCode: string;
  executionResult: unknown;
  status: string;
  createdAt: Date;
}

/**
 * Load one of the user's own submissions as a semantic record.
 * Returns null when the submission does not exist, belongs to someone
 * else, or carries no comparable execution artifact.
 */
export async function loadSemanticRecord(
  userId: string,
  submissionId: string,
): Promise<{ record: SemanticRecord; submission: OwnedSubmission } | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission || submission.userId !== userId) return null;
  const record = extractSemanticRecord({
    submissionId: submission.id,
    userId: submission.userId,
    problemId: submission.problemId,
    sourceCode: submission.sourceCode,
    artifact: submission.executionResult,
  });
  if (!record) return null;
  return { record, submission };
}

/** List a user's comparable executions for a problem (most recent first). */
export async function listComparableExecutions(
  userId: string,
  problemId: string,
  take = 20,
): Promise<
  Array<{
    id: string;
    createdAt: Date;
    status: string;
    passed: boolean | null;
    hasArtifact: boolean;
    durationMs: number | null;
  }>
> {
  const rows = await prisma.submission.findMany({
    where: { userId, problemId, status: "SUCCEEDED" },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 50),
    select: {
      id: true,
      createdAt: true,
      status: true,
      passed: true,
      executionResult: true,
      durationMs: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    status: row.status,
    passed: row.passed,
    hasArtifact: !!row.executionResult,
    durationMs: row.durationMs,
  }));
}

// ========================================
// Comparison
// ========================================

/**
 * Compare two of the user's own executions under a named policy and
 * persist the structured result as evidence history.
 */
export async function compareExecutions(
  userId: string,
  submissionIdA: string,
  submissionIdB: string,
  policyName: string,
): Promise<
  | { ok: true; comparison: SemanticComparison; comparisonId: string }
  | { ok: false; reason: "not_found" | "no_record" | "same_execution" }
> {
  if (submissionIdA === submissionIdB) {
    return { ok: false, reason: "same_execution" };
  }
  const loadedA = await loadSemanticRecord(userId, submissionIdA);
  if (!loadedA) return { ok: false, reason: "not_found" };
  const loadedB = await loadSemanticRecord(userId, submissionIdB);
  if (!loadedB) return { ok: false, reason: "not_found" };

  const policy = resolveComparisonPolicy(policyName);
  const comparison = compareSemanticRecords(
    loadedA.record,
    loadedB.record,
    policy,
  );

  const persisted = await prisma.semanticComparison.create({
    data: {
      userId,
      recordAId: submissionIdA,
      recordBId: submissionIdB,
      policyName: policy.name,
      overallStatus: comparison.overallStatus,
      result: comparison as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  logger.info("semantic comparison completed", {
    comparisonId: persisted.id,
    userId,
    policy: policy.name,
    status: comparison.overallStatus,
  });

  return { ok: true, comparison, comparisonId: persisted.id };
}

// ========================================
// Baselines
// ========================================

/**
 * Designate one of the user's executions as the regression baseline for a
 * problem. Only executions of the same problem with a comparable artifact
 * qualify. Re-designating replaces the previous baseline.
 */
export async function setBaseline(
  userId: string,
  problemId: string,
  submissionId: string,
  policyName: string,
  note?: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: "not_found" | "problem_mismatch" | "no_record" | "bad_policy" }
> {
  if (!resolveComparisonPolicy(policyName) || !isKnownPolicy(policyName)) {
    return { ok: false, reason: "bad_policy" };
  }
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, userId: true, problemId: true },
  });
  if (!submission || submission.userId !== userId) {
    return { ok: false, reason: "not_found" };
  }
  if (submission.problemId !== problemId) {
    return { ok: false, reason: "problem_mismatch" };
  }
  const record = await loadSemanticRecord(userId, submissionId);
  if (!record) return { ok: false, reason: "no_record" };

  await prisma.semanticBaseline.upsert({
    where: { userId_problemId: { userId, problemId } },
    create: { userId, problemId, submissionId, policyName, note: note ?? null },
    update: { submissionId, policyName, note: note ?? null, updatedAt: new Date() },
  });
  logger.info("semantic baseline set", { userId, problemId, submissionId });
  return { ok: true };
}

/** The user's baseline for a problem, with its semantic record. */
export async function getBaseline(
  userId: string,
  problemId: string,
): Promise<{
  submissionId: string;
  policyName: string;
  note: string | null;
  record: SemanticRecord;
  createdAt: Date;
} | null> {
  const baseline = await prisma.semanticBaseline.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });
  if (!baseline) return null;
  const loaded = await loadSemanticRecord(userId, baseline.submissionId);
  if (!loaded) return null;
  return {
    submissionId: baseline.submissionId,
    policyName: baseline.policyName,
    note: baseline.note,
    record: loaded.record,
    createdAt: baseline.createdAt,
  };
}

/** Remove the user's baseline for a problem. */
export async function clearBaseline(
  userId: string,
  problemId: string,
): Promise<void> {
  await prisma.semanticBaseline.deleteMany({ where: { userId, problemId } });
}

// ========================================
// Baseline regression
// ========================================

/**
 * Compare an execution against the user's baseline for its problem.
 * Returns the comparison plus a regression classification that keeps
 * correctness, resources, and environment as separate dimensions.
 */
export async function compareToBaseline(
  userId: string,
  submissionId: string,
): Promise<
  | {
      ok: true;
      baselineSubmissionId: string;
      comparison: SemanticComparison;
      regression: {
        behavior: SemanticStatus | "NOT_COMPARED";
        resource: string;
        environment: string;
        classification:
          | "NO_REGRESSION"
          | "BEHAVIORAL_REGRESSION"
          | "RESOURCE_REGRESSION"
          | "ENVIRONMENT_CHANGE"
          | "INSUFFICIENT_EVIDENCE";
      };
    }
  | { ok: false; reason: "no_baseline" | "not_found" | "no_record" | "same_execution" }
> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, userId: true, problemId: true },
  });
  if (!submission || submission.userId !== userId) {
    return { ok: false, reason: "not_found" };
  }
  const baseline = await getBaseline(userId, submission.problemId);
  if (!baseline) return { ok: false, reason: "no_baseline" };
  if (baseline.submissionId === submissionId) {
    return { ok: false, reason: "same_execution" };
  }

  const policy = resolveComparisonPolicy(baseline.policyName);
  const comparison = compareSemanticRecords(
    baseline.record,
    (await loadSemanticRecord(userId, submissionId))!.record,
    policy,
  );

  const behaviorStatus = pickBehaviorStatus(comparison);
  const resourceStatus = comparison.resource?.status ?? "NOT_COMPARED";
  const environmentStatus = comparison.environment?.status ?? "NOT_COMPARED";
  const classification = classifyRegression(
    behaviorStatus,
    resourceStatus,
    environmentStatus,
  );

  return {
    ok: true,
    baselineSubmissionId: baseline.submissionId,
    comparison,
    regression: {
      behavior: behaviorStatus,
      resource:
        resourceStatus === "WARNING"
          ? `changed: ${comparison.resource?.message ?? ""}`
          : resourceStatus,
      environment: environmentStatus,
      classification,
    },
  };
}

function pickBehaviorStatus(
  comparison: SemanticComparison,
): SemanticStatus | "NOT_COMPARED" {
  const behavioral = [comparison.state, comparison.probability, comparison.measurement];
  if (behavioral.every((x) => x === null || x.status === "NOT_COMPARED")) {
    return "NOT_COMPARED";
  }
  return comparison.overallStatus;
}

function classifyRegression(
  behavior: SemanticStatus | "NOT_COMPARED",
  resource: string,
  environment: string,
): "NO_REGRESSION" | "BEHAVIORAL_REGRESSION" | "RESOURCE_REGRESSION" | "ENVIRONMENT_CHANGE" | "INSUFFICIENT_EVIDENCE" {
  if (behavior === "DIFFERENT") return "BEHAVIORAL_REGRESSION";
  if (behavior === "NOT_COMPARED") return "INSUFFICIENT_EVIDENCE";
  if (resource === "WARNING") return "RESOURCE_REGRESSION";
  if (environment === "WARNING") return "ENVIRONMENT_CHANGE";
  return "NO_REGRESSION";
}

function isKnownPolicy(name: string): boolean {
  return name === "statistical-default" || name === "exact";
}

// ========================================
// Reproduction
// ========================================

export interface ReproductionResult {
  overallStatus: "REPRODUCED" | "NOT_REPRODUCED" | "INSUFFICIENT_EVIDENCE";
  report: import("@/lib/semantic/types").ReproductionReport;
}

/**
 * Reproduce one of the user's own executions.
 *
 * The original source is re-executed inside the standard sandboxed
 * pipeline (same limits, rate limiting, and judging as any run) using the
 * recorded shot count and seed when the artifact recorded them. The new
 * execution's semantic record is compared against the original's under
 * the policy, and a report is persisted.
 *
 * Reproducibility requires evidence: the execution must succeed AND the
 * behavior comparison must pass. A successful run alone is never
 * "reproduced".
 */
export async function reproduceExecution(
  userId: string,
  submissionId: string,
  policyName: string,
): Promise<
  | { ok: true; result: ReproductionResult; reproductionSubmissionId: string }
  | { ok: false; reason: "not_found" | "no_record" }
> {
  const loaded = await loadSemanticRecord(userId, submissionId);
  if (!loaded) return { ok: false, reason: "no_record" };
  const { record, submission } = loaded;

  // The recorded source is re-run from the database: the client never
  // supplies code for a reproduction, so the experiment always reruns
  // exactly what was recorded.

  const policy = resolveComparisonPolicy(policyName);
  const shots = record.shots ?? undefined;
  const seed = record.seed ?? undefined;

  logger.info("semantic reproduction started", {
    userId,
    originalSubmissionId: submissionId,
  });

  // Standard pipeline: identical validation, sandbox, judging, persistence.
  const run = await runSubmission(userId, {
    problemId: submission.problemId,
    sourceCode: submission.sourceCode,
    shots,
    seed,
  });
  if (run.status !== "SUCCEEDED" || !run.submissionId) {
    return { ok: false, reason: "no_record" };
  }

  // The reproduced run's record: rebuilt from its persisted artifact.
  const reproduced = await loadSemanticRecord(userId, run.submissionId);
  if (!reproduced) return { ok: false, reason: "no_record" };

  const comparison = compareSemanticRecords(
    record,
    reproduced.record,
    policy,
  );

  const behavioralCompared = [
    comparison.state,
    comparison.probability,
    comparison.measurement,
  ].some((x) => x !== null && x.status !== "NOT_COMPARED");
  const behaviorDifferent = [
    comparison.state,
    comparison.probability,
    comparison.measurement,
  ].some((x) => x?.status === "DIFFERENT");

  let overallStatus: ReproductionResult["overallStatus"];
  if (behaviorDifferent) {
    overallStatus = "NOT_REPRODUCED";
  } else if (behavioralCompared) {
    overallStatus = "REPRODUCED";
  } else {
    overallStatus = "INSUFFICIENT_EVIDENCE";
  }

  const checks = comparison.differences
    .filter((d) => d.dimension !== "SOURCE")
    .map((d) => ({
      dimension: d.dimension,
      status: d.status,
      message: d.message,
    }));

  const limitations = [...comparison.limitations];
  if (seed === undefined) {
    limitations.push(
      "The original execution recorded no seed; sampled distributions were compared statistically rather than exactly.",
    );
  }

  const report: import("@/lib/semantic/types").ReproductionReport = {
    schemaVersion: "quantoo.semantic.v1",
    submissionId,
    reproductionSubmissionId: run.submissionId,
    policyName: policy.name,
    overallStatus,
    checks,
    comparison,
    limitations,
    computedAt: new Date().toISOString(),
  };

  await prisma.semanticReproduction.create({
    data: {
      userId,
      originalSubmissionId: submissionId,
      reproductionSubmissionId: run.submissionId,
      policyName: policy.name,
      overallStatus,
      result: report as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  logger.info("semantic reproduction completed", {
    userId,
    originalSubmissionId: submissionId,
    reproductionSubmissionId: run.submissionId,
    status: overallStatus,
  });

  return { ok: true, result: { overallStatus, report }, reproductionSubmissionId: run.submissionId };
}

/** Recent comparison history for the user (evidence audit trail). */
export async function listComparisonHistory(userId: string, take = 10) {
  return prisma.semanticComparison.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 50),
    select: {
      id: true,
      recordAId: true,
      recordBId: true,
      policyName: true,
      overallStatus: true,
      createdAt: true,
    },
  });
}

// Re-export for API-layer convenience.
export type { ComparisonPolicy };
