/**
 * POST /api/executions/run
 *
 * Execute the current user's quantum code for a problem in the sandbox,
 * judge the result against the problem's test specification, persist the
 * submission, and update progress.
 *
 * Requires authentication. Identity always comes from the server session;
 * client-provided user IDs are never trusted. Rate limited per user.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { runRequestSchema } from "@/lib/exec/validation";
import {
  runSubmission,
  ExecutionRequestError,
} from "@/lib/exec/service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    // Execution is expensive: rate limit per user, not per IP.
    const limit = checkRateLimit(
      getRateLimitKey(user.id, "execution"),
      RATE_LIMITS.execution,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many executions. Please wait before running again.",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000),
          ),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(
                1,
                Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000),
              ),
            ),
          },
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = runRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    // Resolve the problem by slug; runSubmission re-validates publication
    // status so drafts cannot be executed through this endpoint.
    const problem = await prisma.problem.findUnique({
      where: { slug: parsed.data.problemSlug },
      select: { id: true },
    });
    if (!problem) {
      return NextResponse.json(
        { error: "Problem not found." },
        { status: 404 },
      );
    }

    const result = await runSubmission(user.id, {
      problemId: problem.id,
      sourceCode: parsed.data.sourceCode,
      shots: parsed.data.shots,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExecutionRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }
    logger.error("execution request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to execute the submission." },
      { status: 500 },
    );
  }
}
