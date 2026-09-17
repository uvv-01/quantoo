/**
 * POST /api/semantic/reproduce
 *
 * Reproduce one of the authenticated user's own executions: re-run the
 * recorded source through the standard sandboxed execution pipeline with
 * the recorded shot count and seed, then compare the new semantic record
 * against the original's. The verdict is computed server-side; a
 * successful run alone is never "reproduced".
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { reproduceRequestSchema } from "@/lib/semantic/validation";
import { reproduceExecution } from "@/lib/semantic/service";
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

    const limit = checkRateLimit(
      getRateLimitKey(user.id, "semantic"),
      RATE_LIMITS.semantic,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
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
    const parsed = reproduceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const result = await reproduceExecution(
      user.id,
      parsed.data.submissionId,
      parsed.data.policy,
    );
    if (!result.ok) {
      const messages: Record<string, string> = {
        no_record: "Execution not found or has no comparable artifact.",
        not_found: "Execution not found or has no comparable artifact.",
      };
      return NextResponse.json(
        { error: messages[result.reason] ?? "Reproduction failed." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      overallStatus: result.result.overallStatus,
      report: result.result.report,
      reproductionSubmissionId: result.reproductionSubmissionId,
    });
  } catch (error) {
    logger.error("semantic reproduction failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to reproduce the execution." },
      { status: 500 },
    );
  }
}
