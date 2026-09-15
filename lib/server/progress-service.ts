/**
 * Progress Service
 *
 * Server-side service for tracking user progress on problems and learning topics.
 * Enforces ownership — users can only access their own progress.
 */

import { prisma } from "@/lib/prisma";
import type { ProgressStatus } from "@prisma/client";

// ========================================
// Types
// ========================================

export interface UserProblemProgress {
  id: string;
  problemId: string;
  status: ProgressStatus;
  attempts: number;
  bestTimeMs: number | null;
  startedAt: Date;
  lastAttemptAt: Date | null;
  updatedAt: Date;
}

export interface UserTopicProgress {
  id: string;
  topicId: string;
  status: ProgressStatus;
  progressPct: number;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface ProgressSummary {
  totalProblemsStarted: number;
  totalProblemsSolved: number;
  totalProblemsAttempted: number;
  topicsStarted: number;
  topicsCompleted: number;
}

// ========================================
// Service Functions
// ========================================

/**
 * Get all problem progress for a specific user.
 */
export async function getUserProblemProgress(
  userId: string,
): Promise<UserProblemProgress[]> {
  return prisma.userProblemProgress.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Get progress for a specific problem for a specific user.
 */
export async function getProblemProgress(
  userId: string,
  problemId: string,
): Promise<UserProblemProgress | null> {
  return prisma.userProblemProgress.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });
}

/**
 * Get progress for a specific problem by slug for a specific user.
 */
export async function getProblemProgressBySlug(
  userId: string,
  problemSlug: string,
): Promise<(UserProblemProgress & { problem: { slug: string } }) | null> {
  const problem = await prisma.problem.findUnique({
    where: { slug: problemSlug },
    select: { id: true, slug: true },
  });

  if (!problem) return null;

  return prisma.userProblemProgress.findUnique({
    where: { userId_problemId: { userId, problemId: problem.id } },
    include: { problem: { select: { slug: true } } },
  });
}

/**
 * Record that a user started a problem.
 * Idempotent — does nothing if already started.
 */
export async function startProblem(
  userId: string,
  problemId: string,
): Promise<UserProblemProgress> {
  const existing = await prisma.userProblemProgress.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });

  if (existing) {
    return existing;
  }

  // Also record activity
  await prisma.userActivity.create({
    data: {
      userId,
      type: "PROBLEM_VIEWED",
      problemId,
    },
  });

  return prisma.userProblemProgress.create({
    data: {
      userId,
      problemId,
      status: "IN_PROGRESS",
    },
  });
}

/**
 * Record a problem attempt for a user.
 * Increments attempt count and updates status.
 */
export async function recordAttempt(
  userId: string,
  problemId: string,
  timeMs?: number,
): Promise<UserProblemProgress> {
  const existing = await prisma.userProblemProgress.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });

  const data = {
    attempts: { increment: 1 },
    lastAttemptAt: new Date(),
    status: "ATTEMPTED" as ProgressStatus,
    ...(timeMs !== undefined && {
      bestTimeMs: existing?.bestTimeMs
        ? Math.min(existing.bestTimeMs, timeMs)
        : timeMs,
    }),
  };

  if (existing) {
    await prisma.userActivity.create({
      data: {
        userId,
        type: "PROBLEM_ATTEMPT",
        problemId,
        metadata: { attemptNumber: existing.attempts + 1, timeMs },
      },
    });

    return prisma.userProblemProgress.update({
      where: { userId_problemId: { userId, problemId } },
      data,
    });
  }

  await prisma.userActivity.create({
    data: {
      userId,
      type: "PROBLEM_ATTEMPT",
      problemId,
      metadata: { attemptNumber: 1, timeMs },
    },
  });

  return prisma.userProblemProgress.create({
    data: {
      userId,
      problemId,
      status: "ATTEMPTED",
      attempts: 1,
      lastAttemptAt: new Date(),
      bestTimeMs: timeMs,
    },
  });
}

/**
 * Mark a problem as solved for a user.
 * Only works if the user has attempted the problem.
 */
export async function markSolved(
  userId: string,
  problemId: string,
  timeMs?: number,
): Promise<UserProblemProgress> {
  const existing = await prisma.userProblemProgress.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });

  if (!existing || existing.status === "NOT_STARTED") {
    throw new Error("Cannot mark an unstarted problem as solved.");
  }

  await prisma.userActivity.create({
    data: {
      userId,
      type: "PROBLEM_SOLVED",
      problemId,
      metadata: { timeMs },
    },
  });

  return prisma.userProblemProgress.update({
    where: { userId_problemId: { userId, problemId } },
    data: {
      status: "SOLVED",
      bestTimeMs:
        timeMs !== undefined
          ? existing.bestTimeMs
            ? Math.min(existing.bestTimeMs, timeMs)
            : timeMs
          : existing.bestTimeMs,
    },
  });
}

/**
 * Get a user's overall progress summary.
 */
export async function getProgressSummary(
  userId: string,
): Promise<ProgressSummary> {
  const [totalProblemsStarted, totalProblemsSolved, totalProblemsAttempted] =
    await Promise.all([
      prisma.userProblemProgress.count({
        where: { userId, status: { not: "NOT_STARTED" } },
      }),
      prisma.userProblemProgress.count({
        where: { userId, status: "SOLVED" },
      }),
      prisma.userProblemProgress.count({
        where: { userId, status: "ATTEMPTED" },
      }),
    ]);

  const [topicsStarted, topicsCompleted] = await Promise.all([
    prisma.userLearningProgress.count({
      where: { userId, status: { not: "NOT_STARTED" } },
    }),
    prisma.userLearningProgress.count({
      where: { userId, status: "SOLVED" },
    }),
  ]);

  return {
    totalProblemsStarted,
    totalProblemsSolved,
    totalProblemsAttempted,
    topicsStarted,
    topicsCompleted,
  };
}

/**
 * Get all published problem statuses for a specific user.
 * Returns a map of problemId -> status for quick lookup.
 */
export async function getUserProblemStatusMap(
  userId: string,
): Promise<Map<string, ProgressStatus>> {
  const progressList = await prisma.userProblemProgress.findMany({
    where: { userId },
    select: { problemId: true, status: true },
  });

  return new Map(progressList.map((p) => [p.problemId, p.status]));
}
