/**
 * Benchmark run service.
 *
 * Every benchmark run is a real sandboxed execution recorded as a
 * standard submission against the benchmark's anchor problem. Nothing is
 * synthesized: counts, duration, and status come from the actual runtime,
 * and comparisons between runs reuse the Phase 6 statistics engine.
 */

import { prisma } from "@/lib/prisma";
import { runSubmission, ExecutionRequestError } from "@/lib/exec/service";
import { getExecutionLimits } from "@/lib/exec/limits";
import { getEnvironmentProfile } from "@/lib/compat/environments";
import { compareDistributions, hellingerDistance, totalVariationDistance } from "@/lib/semantic/statistics";
import { frequenciesFromCounts } from "@/lib/semantic/statistics";
import { logger } from "@/lib/logger";

/** Server-side randomness only: clients never supply seeds. */
function generateSeed(): number {
  return Math.floor(Math.random() * 2_000_000_000);
}

export interface BenchmarkRunResult {
  runId: string;
  benchmarkId: string;
  benchmarkSlug: string;
  environmentId: string;
  submissionId: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  seed: number;
}

/**
 * Execute a benchmark in a registered environment. The program and
 * configuration come from the database corpus row, never from client
 * input; the caller supplies only identity, benchmark choice, and
 * environment choice.
 */
export async function runBenchmark(params: {
  userId: string;
  benchmarkId: string;
  environmentId: string;
}): Promise<BenchmarkRunResult> {
  const benchmark = await prisma.benchmark.findUnique({
    where: { id: params.benchmarkId },
  });
  if (!benchmark) {
    throw new ExecutionRequestError("INVALID_REQUEST", "Benchmark not found.");
  }

  const environment = getEnvironmentProfile(params.environmentId);
  if (!environment) {
    throw new ExecutionRequestError("INVALID_REQUEST", "Unknown environment.");
  }

  const limits = getExecutionLimits();
  const shots = Math.min(benchmark.shots, limits.maxShots);
  const seed = benchmark.seed ?? generateSeed();

  // Anchor problem for the submission row (validated by runSubmission).
  // Prefer the dedicated slug; fall back to any published problem so the
  // benchmark still runs on deployments with a different seed set.
  let problem = await prisma.problem.findUnique({
    where: { slug: "quantum-states" },
    select: { id: true },
  });
  if (!problem) {
    problem = await prisma.problem.findFirst({
      where: { status: "PUBLISHED" },
      select: { id: true },
    });
  }
  if (!problem) {
    throw new ExecutionRequestError(
      "INVALID_REQUEST",
      "The deployment has no published problems. Run database seeding.",
    );
  }

  const runRow = await prisma.benchmarkRun.create({
    data: {
      benchmarkId: benchmark.id,
      userId: params.userId,
      environmentId: environment.id,
      submissionId: "pending",
      seed,
    },
    select: { id: true },
  });

  let submissionId = "";
  let status = "FAILED";
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    const runResponse = await runSubmission(params.userId, {
      problemId: problem.id,
      sourceCode: benchmark.sourceCode,
      shots,
      seed,
      environmentId: environment.id,
    });
    submissionId = runResponse.submissionId;
    status = runResponse.status;
    errorCode = runResponse.error?.code ?? null;
    errorMessage = runResponse.error?.message ?? null;
  } catch (error) {
    if (error instanceof ExecutionRequestError) {
      errorCode = error.code;
      errorMessage = error.message;
    } else {
      logger.error("benchmark run failed unexpectedly", { benchmarkId: benchmark.id });
      errorCode = "INTERNAL_ERROR";
      errorMessage = "The benchmark execution failed unexpectedly.";
    }
  }

  await prisma.benchmarkRun.update({
    where: { id: runRow.id },
    data: { submissionId, seed },
  });

  logger.info("benchmark run completed", {
    benchmarkRunId: runRow.id,
    benchmarkSlug: benchmark.slug,
    environmentId: environment.id,
    status,
  });

  return {
    runId: runRow.id,
    benchmarkId: benchmark.id,
    benchmarkSlug: benchmark.slug,
    environmentId: environment.id,
    submissionId,
    status,
    errorCode,
    errorMessage,
    seed,
  };
}

export interface BenchmarkRunSummary {
  runId: string;
  environmentId: string;
  submissionId: string;
  seed: number | null;
  status: string;
  errorCode: string | null;
  createdAt: string;
  // Measurement summary (sampled, exact probabilities not implied).
  counts: Record<string, number> | null;
  shots: number | null;
}

/** List a benchmark's runs the user may see (own runs only for now). */
export async function listBenchmarkRuns(
  userId: string,
  benchmarkId: string,
  take = 50,
): Promise<BenchmarkRunSummary[]> {
  const runs = await prisma.benchmarkRun.findMany({
    where: { benchmarkId, userId },
    orderBy: { createdAt: "desc" },
    take,
  });

  const submissions = await prisma.submission.findMany({
    where: { id: { in: runs.map((r) => r.submissionId) } },
    select: { id: true, status: true, errorCode: true, executionResult: true },
  });
  const byId = new Map(submissions.map((s) => [s.id, s]));

  return runs.map((run) => {
    const submission = byId.get(run.submissionId);
    const artifact = submission?.executionResult as
      | { outcomes?: Record<string, { counts?: Record<string, number>; shots?: number }> }
      | null
      | undefined;
    const submissionOutcome = artifact?.outcomes?.submission ?? undefined;
    return {
      runId: run.id,
      environmentId: run.environmentId,
      submissionId: run.submissionId,
      seed: run.seed,
      status: submission?.status ?? "PENDING",
      errorCode: submission?.errorCode ?? null,
      createdAt: run.createdAt.toISOString(),
      counts: submissionOutcome?.counts ?? null,
      shots: submissionOutcome?.shots ?? null,
    };
  });
}

export interface BenchmarkComparison {
  runAId: string;
  runBId: string;
  environmentAId: string;
  environmentBId: string;
  status: "EQUIVALENT" | "DIFFERENT" | "INSUFFICIENT_EVIDENCE";
  hellinger: number | null;
  tvd: number | null;
  /** Weak-evidence note when shot counts are small (from Phase 6 policy). */
  note: string | null;
}

/**
 * Compare two of the user's benchmark runs by their measurement
 * distributions. Thresholds follow the platform's default statistical
 * policy: weak-evidence is reported rather than hidden.
 */
export async function compareBenchmarkRuns(
  userId: string,
  runAId: string,
  runBId: string,
): Promise<BenchmarkComparison | { error: string }> {
  const runs = await prisma.benchmarkRun.findMany({
    where: { id: { in: [runAId, runBId] }, userId },
  });
  if (runs.length !== 2) return { error: "Both runs must exist and belong to you." };

  const [runA, runB] = runs[0].id === runAId ? [runs[0], runs[1]] : [runs[1], runs[0]];
  if (runA.benchmarkId !== runB.benchmarkId) {
    return { error: "Runs must come from the same benchmark." };
  }

  const summaries = await listBenchmarkRuns(userId, runA.benchmarkId, 200);
  const summaryA = summaries.find((s) => s.runId === runA.id);
  const summaryB = summaries.find((s) => s.runId === runB.id);

  const countsA = summaryA?.counts ?? null;
  const countsB = summaryB?.counts ?? null;
  if (!countsA || !countsB) {
    return { error: "One of the runs has no measurement data to compare." };
  }

  const freqA = frequenciesFromCounts(countsA);
  const freqB = frequenciesFromCounts(countsB);
  if (!freqA || !freqB) {
    return { error: "Measurement data could not be normalized for comparison." };
  }
  const h = hellingerDistance(freqA, freqB);
  const tvd = totalVariationDistance(freqA, freqB);

  const shotsA = summaryA?.shots ?? 0;
  const shotsB = summaryB?.shots ?? 0;
  const minShots = Math.min(shotsA, shotsB);
  const THRESHOLD = 0.05;
  const weakEvidence = minShots < 1024;

  const status: BenchmarkComparison["status"] =
    minShots === 0
      ? "INSUFFICIENT_EVIDENCE"
      : h <= THRESHOLD
        ? "EQUIVALENT"
        : "DIFFERENT";

  return {
    runAId: runA.id,
    runBId: runB.id,
    environmentAId: runA.environmentId,
    environmentBId: runB.environmentId,
    status,
    hellinger: h,
    tvd,
    note: weakEvidence
      ? `Small sample (${minShots} shots); treat the comparison as weak evidence.`
      : null,
  };
}

/** Re-export for API surface typing convenience. */
export { compareDistributions };
