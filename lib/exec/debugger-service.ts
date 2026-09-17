/**
 * Debugger service.
 *
 * Assembles the debugger payload for a submission from the persisted
 * execution artifact. The debugger is read-only: it consumes real runtime
 * data and reports limitations explicitly instead of fabricating missing
 * quantum information.
 *
 * Ownership is enforced here (server-side): the service takes the
 * authenticated user id and only ever returns data for a submission that
 * belongs to that user. Client-supplied identifiers are never trusted for
 * authorization.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type {
  DebuggerPayload,
  ScenarioOutcome,
  ScenarioTrace,
} from "@/lib/exec/types";
import type { JudgeResult } from "@/lib/exec/types";
import { localizeFailure } from "@/lib/judge/failure-localization";
import type { FailureLocalization } from "@/lib/judge/failure-localization";
import type { Prisma } from "@prisma/client";

/** The reference outcome for a submission, when one can be identified. */
export interface ReferenceInfo {
  submissionId: string;
  outcome: ScenarioOutcome | null;
}

/** Access result for a debugger request. */
export type DebuggerAccessResult =
  | { ok: true; payload: DebuggerPayload; localization: FailureLocalization | null }
  | { ok: false; status: 404 | 403; error: string };

/**
 * Load the debugger payload for a submission, enforcing ownership.
 *
 * @param userId       authenticated user id (from the server session)
 * @param submissionId submission identifier from the request
 */
export async function getDebuggerData(
  userId: string,
  submissionId: string,
): Promise<DebuggerAccessResult> {
  if (!isUuid(submissionId)) {
    return { ok: false, status: 404, error: "Submission not found." };
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      judgeResult: true,
      executionResult: true,
      createdAt: true,
      problem: { select: { slug: true } },
    },
  });

  if (!submission) {
    return { ok: false, status: 404, error: "Submission not found." };
  }
  if (submission.userId !== userId) {
    // Authenticated, but not the owner: do not reveal existence.
    return { ok: false, status: 404, error: "Submission not found." };
  }

  const outcomes = parseOutcomes(submission.executionResult);
  const judge = parseJudge(submission.judgeResult);

  const payload: DebuggerPayload = {
    submissionId: submission.id,
    problemSlug: submission.problem.slug,
    status: submission.status as DebuggerPayload["status"],
    errorCode: submission.errorCode,
    errorMessage: submission.errorMessage,
    judge,
    outcomes,
    traceAvailability: describeTraceAvailability(outcomes),
  };

  const reference = await findReferenceOutcome(userId, submission);
  const studentOutcome = outcomes["submission"] ?? null;
  const localization = judge
    ? localizeFailure(judge, studentOutcome, reference?.outcome ?? null)
    : null;

  return { ok: true, payload, localization };
}

// ========================================
// Reference execution
// ========================================

/**
 * Find a reference outcome for comparison: the user's own most recent
 * passing submission for the same problem. The user's passing execution is
 * the best available "reference" in this phase — it is a real execution of
 * real code, never a fabricated ideal.
 */
async function findReferenceOutcome(
  userId: string,
  submission: { id: string; userId: string; problem: { slug: string } },
): Promise<ReferenceInfo | null> {
  try {
    const problem = await prisma.problem.findUnique({
      where: { slug: submission.problem.slug },
      select: { id: true },
    });
    if (!problem) return null;

    const passing = await prisma.submission.findFirst({
      where: {
        userId,
        problemId: problem.id,
        passed: true,
        status: "SUCCEEDED",
        id: { not: submission.id },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, executionResult: true },
    });
    if (!passing) return null;

    const outcomes = parseOutcomes(passing.executionResult);
    return {
      submissionId: passing.id,
      outcome: outcomes["submission"] ?? null,
    };
  } catch (error) {
    logger.error("reference lookup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ========================================
// Parsers
// ========================================

function parseOutcomes(raw: Prisma.JsonValue | null): Record<string, ScenarioOutcome> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  let record = raw as Record<string, unknown>;
  // Phase 6 wraps the artifact as { outcomes, environment }; older rows
  // stored the outcomes map at the top level. Both shapes are supported.
  const nested = record.outcomes;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    record = nested as Record<string, unknown>;
  }
  const outcomes: Record<string, ScenarioOutcome> = {};
  for (const [name, value] of Object.entries(record)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.scenario === "string" &&
      candidate.circuit &&
      typeof candidate.circuit === "object"
    ) {
      outcomes[name] = candidate as unknown as ScenarioOutcome;
    }
  }
  return outcomes;
}

function parseJudge(raw: Prisma.JsonValue | null): JudgeResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.passed === "boolean" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.checks)
  ) {
    return candidate as unknown as JudgeResult;
  }
  return null;
}

// ========================================
// Trace availability
// ========================================

/**
 * Per-scenario report of what debugger data actually exists, so the UI can
 * state limitations instead of showing empty panels.
 */
function describeTraceAvailability(
  outcomes: Record<string, ScenarioOutcome>,
): DebuggerPayload["traceAvailability"] {
  const availability: DebuggerPayload["traceAvailability"] = {};
  for (const [name, outcome] of Object.entries(outcomes)) {
    const trace: ScenarioTrace | undefined = outcome.trace;
    const hasSteps = Array.isArray(trace?.steps) && trace.steps.length > 0;
    const hasSnapshots =
      hasSteps && trace!.steps.some((s) => Array.isArray(s.afterState));
    availability[name] = {
      trace: hasSteps,
      snapshots: hasSnapshots === true,
      reason: hasSteps ? (trace!.policy.reason ?? null) : "No trace was recorded for this scenario.",
    };
  }
  return availability;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
