/**
 * POST /api/progress/problem
 *
 * Update problem progress for the current user.
 * Requires authentication.
 *
 * Supports actions:
 * - start: Record that user started viewing a problem
 * - attempt: Record an attempt (increments count)
 * - solved: Mark the problem as solved
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  startProblem,
  recordAttempt,
  markSolved,
} from "@/lib/server/progress-service";
import { getProblemById } from "@/lib/server/problem-service";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { problemId, action, timeMs } = body as {
      problemId: string;
      action: string;
      timeMs?: number;
    };

    if (!problemId || typeof problemId !== "string") {
      return NextResponse.json(
        { error: "problemId is required" },
        { status: 400 },
      );
    }

    if (!action || !["start", "attempt", "solved"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'start', 'attempt', or 'solved'" },
        { status: 400 },
      );
    }

    // Verify problem exists
    const problem = await getProblemById(problemId);
    if (!problem) {
      return NextResponse.json(
        { error: "Problem not found" },
        { status: 404 },
      );
    }

    let progress;

    switch (action) {
      case "start":
        progress = await startProblem(user.id, problemId);
        break;
      case "attempt":
        progress = await recordAttempt(user.id, problemId, timeMs);
        break;
      case "solved":
        progress = await markSolved(user.id, problemId, timeMs);
        break;
    }

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("Error updating progress:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 },
    );
  }
}
