/**
 * Execution orchestration.
 *
 * Wires together authentication, validation, rate limiting, the sandbox,
 * the judge, persistence, and progress tracking into the "run" workflow:
 *
 *   validate request -> check rate limit -> execute in sandbox
 *     -> judge outcomes -> persist submission -> update progress
 *
 * This module never trusts client identity: the user is derived from the
 * server session by the API route and passed in explicitly.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { executeInSandbox } from "@/lib/exec/sandbox";
import { getExecutionLimits } from "@/lib/exec/limits";
import { judgeSubmission, SUPPORTED_SPEC_TYPES, type TestSpec } from "@/lib/judge";
import type {
  ExecutionErrorCode,
  RunResponse,
  ScenarioOutcome,
} from "@/lib/exec/types";

// ========================================
// Errors
// ========================================

export class ExecutionRequestError extends Error {
  constructor(
    public readonly code: ExecutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ExecutionRequestError";
  }
}

// ========================================
// Input
// ========================================

export interface RunInput {
  problemId: string;
  sourceCode: string;
  shots?: number;
  /**
   * Optional deterministic seed for sampled measurements. Used by the
   * Phase 6 reproduction flow (the recorded seed of the original run);
   * the public run API does not accept client seeds.
   */
  seed?: number;
}

const MAX_SOURCE_BYTES = 50_000;

function assertSourceSize(sourceCode: string): void {
  const bytes = Buffer.byteLength(sourceCode, "utf8");
  if (bytes > MAX_SOURCE_BYTES) {
    throw new ExecutionRequestError(
      "INVALID_CODE",
      "Source code is too large.",
    );
  }
}

// ========================================
// Test specification loading
// ========================================

/** Parse and sanity-check a problem's stored test specification. */
export function parseTestSpecification(raw: string | null): TestSpec[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error("problem has an unparseable test specification");
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const specs: TestSpec[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const spec = entry as Record<string, unknown>;
    if (typeof spec.type !== "string" || typeof spec.description !== "string") {
      continue;
    }
    if (spec.type === "STATE" || spec.type === "DISTRIBUTION" || spec.type === "STRUCTURAL" || spec.type === "ENTANGLEMENT") {
      specs.push(spec as unknown as TestSpec);
    } else {
      // Keep unknown types so the judge can report them as SKIPPED.
      specs.push(spec as unknown as TestSpec);
    }
  }
  return specs;
}

/** Scenario names the runtime must execute for these specs. */
export function requiredScenarios(specs: TestSpec[]): string[] {
  const scenarios = new Set<string>(["submission"]);
  for (const spec of specs) {
    if (spec.type === "DISTRIBUTION") {
      const input = (spec as { expected?: { input?: string } }).expected?.input;
      if (input) scenarios.add(input);
    }
  }
  return [...scenarios];
}

// ========================================
// Result shaping
// ========================================

/**
 * Build the user-facing execution payload from real runtime data.
 * Probabilities are derived from actual counts; nothing is fabricated.
 */
function buildRunResponse(
  submissionId: string,
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "RESOURCE_LIMIT",
  judge: ReturnType<typeof judgeSubmission> | null,
  outcomes: Record<string, ScenarioOutcome>,
  stdout: string,
  error: { code: ExecutionErrorCode; message: string } | null,
  durationMs: number,
): RunResponse {
  const submission = outcomes["submission"];
  let counts: Record<string, number> | null = null;
  let probabilities: Record<string, number> | null = null;
  let shots: number | null = null;
  let circuit = null;

  if (submission) {
    circuit = submission.circuit;
    if (submission.counts && submission.shots) {
      counts = submission.counts;
      shots = submission.shots;
      probabilities = {};
      for (const [bits, count] of Object.entries(submission.counts)) {
        probabilities[bits] = count / submission.shots;
      }
    }
  }

  return {
    submissionId,
    status,
    passed: judge ? judge.passed : null,
    durationMs,
    error: error ?? null,
    judge,
    execution: {
      circuit,
      counts,
      probabilities,
      shots,
      stdout,
      stderr: "",
    },
  };
}

// ========================================
// Main workflow
// ========================================

/**
 * Execute and judge a submission for an authenticated user.
 *
 * Throws ExecutionRequestError for request-level problems (bad input,
 * unknown problem, rate limit). Execution failures (bad code, timeout...)
 * are returned as a structured result, not thrown, so they can be
 * persisted and displayed.
 */
export async function runSubmission(
  userId: string,
  input: RunInput,
): Promise<RunResponse> {
  const limits = getExecutionLimits();
  assertSourceSize(input.sourceCode);

  const problem = await prisma.problem.findUnique({
    where: { id: input.problemId },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      testSpecification: true,
    },
  });
  if (!problem || problem.status !== "PUBLISHED" || !problem.publishedAt) {
    throw new ExecutionRequestError(
      "INVALID_REQUEST",
      "Problem not found.",
    );
  }

  const specs = parseTestSpecification(
    typeof problem.testSpecification === "string"
      ? problem.testSpecification
      : null,
  );
  const scenarios = requiredScenarios(specs);
  const shots =
    input.shots && Number.isInteger(input.shots) && input.shots >= 1
      ? Math.min(input.shots, limits.maxShots)
      : Math.min(4_096, limits.maxShots);

  // Persist the submission first so every execution has an artifact, even
  // if the sandbox never starts.
  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId: problem.id,
      sourceCode: input.sourceCode,
      status: "RUNNING",
    },
    select: { id: true },
  });

  const sandbox = await executeInSandbox(
    input.sourceCode,
    scenarios,
    shots,
    limits,
    ["density_matrix", "unitary"],
    input.seed,
  );

  if (!sandbox.ok) {
    const errorCode = sandbox.error?.code ?? "INTERNAL_ERROR";
    const status: "FAILED" | "TIMED_OUT" | "RESOURCE_LIMIT" =
      errorCode === "TIMEOUT"
        ? "TIMED_OUT"
        : errorCode === "MEMORY_LIMIT" ||
            errorCode === "QUBIT_LIMIT" ||
            errorCode === "CIRCUIT_LIMIT" ||
            errorCode === "OUTPUT_LIMIT"
          ? "RESOURCE_LIMIT"
          : "FAILED";

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status,
        errorCode,
        errorMessage: sandbox.error?.message ?? null,
        durationMs: sandbox.durationMs,
        completedAt: new Date(),
      },
    });

    // A failed execution still counts as an attempt.
    await recordAttempt(userId, problem.id);

    return buildRunResponse(
      submission.id,
      status,
      null,
      {},
      sandbox.stdout,
      sandbox.error ?? { code: errorCode, message: "The execution failed." },
      sandbox.durationMs,
    );
  }

  // Judge only when the problem has supported checks; otherwise the run is
  // a plain execution with no verdict.
  const judgeable = specs.some((s) => SUPPORTED_SPEC_TYPES.has(s.type));
  const judge = judgeable ? judgeSubmission(specs, sandbox.outcomes) : null;

  const durationMs = sandbox.durationMs;
  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "SUCCEEDED",
      passed: judge ? judge.passed : null,
      judgeResult: judge ? (judge as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
      executionResult: {
        outcomes: sanitizeOutcomesForStorage(sandbox.outcomes),
        environment: sandbox.environment ?? null,
      } as unknown as import("@prisma/client").Prisma.InputJsonValue,
      durationMs,
      completedAt: new Date(),
    },
  });

  await recordAttempt(userId, problem.id, judge?.passed === true);

  return buildRunResponse(
    submission.id,
    "SUCCEEDED",
    judge,
    sandbox.outcomes,
    sandbox.stdout,
    null,
    durationMs,
  );
}

// ========================================
// Progress integration
// ========================================

/**
 * Record an attempt (and a solve when the judge passed) in the existing
 * Phase 3 progress system. SOLVED is only ever set from a real judge pass.
 */
async function recordAttempt(
  userId: string,
  problemId: string,
  solved = false,
): Promise<void> {
  try {
    const existing = await prisma.userProblemProgress.findUnique({
      where: { userId_problemId: { userId, problemId } },
      select: { id: true, status: true },
    });
    if (!existing) {
      await prisma.userProblemProgress.create({
        data: {
          userId,
          problemId,
          status: solved ? "SOLVED" : "ATTEMPTED",
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });
      return;
    }
    const nextStatus =
      existing.status === "SOLVED" || solved
        ? "SOLVED"
        : existing.status === "NOT_STARTED"
          ? "ATTEMPTED"
          : existing.status;
    await prisma.userProblemProgress.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  } catch (error) {
    // Progress tracking must never break the execution workflow.
    logger.error("failed to record problem progress", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ========================================
// Storage helpers
// ========================================

/**
 * Reduce sandbox outcomes to the fields worth persisting.
 *
 * The execution artifact is the debugger's data source, so gate traces and
 * state snapshots are persisted alongside circuit metadata, counts, and
 * exact probabilities — subject to size caps so a submission row can never
 * balloon. Anything that does not fit is omitted; the debugger reports its
 * absence rather than fabricating it.
 */

/** Serialized-size cap for one scenario's persisted trace. */
const MAX_STORED_TRACE_BYTES = 512_000;
/** Serialized-size cap for one scenario's persisted inspection matrices. */
const MAX_STORED_INSPECTION_BYTES = 256_000;

function sanitizeOutcomesForStorage(
  outcomes: Record<string, ScenarioOutcome>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [name, outcome] of Object.entries(outcomes)) {
    // Keep the scenario name in the stored entry so consumers (debugger,
    // diff, analytics) can validate the artifact shape defensively.
    const entry: Record<string, unknown> = {
      scenario: name,
      circuit: outcome.circuit,
    };

    if (outcome.counts) {
      entry.counts = outcome.counts;
      entry.shots = outcome.shots;
      if (typeof outcome.seed === "number") entry.seed = outcome.seed;
    }
    if (
      outcome.statevectorPairs &&
      outcome.statevectorPairs.length <= 32
    ) {
      entry.statevectorPairs = outcome.statevectorPairs;
      if (outcome.probabilities) entry.probabilities = outcome.probabilities;
    }
    if (outcome.trace && serializedSize(outcome.trace) <= MAX_STORED_TRACE_BYTES) {
      entry.trace = outcome.trace;
    }
    if (outcome.inspectionUnavailable) {
      entry.inspectionUnavailable = outcome.inspectionUnavailable;
    } else if (
      outcome.inspection &&
      serializedSize(outcome.inspection) <= MAX_STORED_INSPECTION_BYTES
    ) {
      entry.inspection = outcome.inspection;
    }

    cleaned[name] = entry;
  }
  return cleaned;
}

function serializedSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

// ========================================
// Submission history
// ========================================

/** List a user's own submissions for a problem (ownership enforced upstream). */
export async function listUserSubmissions(
  userId: string,
  problemId: string,
  take = 10,
) {
  return prisma.submission.findMany({
    where: { userId, problemId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 50),
    select: {
      id: true,
      status: true,
      passed: true,
      errorCode: true,
      errorMessage: true,
      durationMs: true,
      createdAt: true,
    },
  });
}
