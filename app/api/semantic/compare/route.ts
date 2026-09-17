/**
 * POST /api/semantic/compare
 *
 * Compare two of the authenticated user's own executions under a named
 * policy. The verdict is computed server-side from persisted execution
 * artifacts; client-supplied verdicts are never accepted. The structured
 * comparison is persisted as evidence history.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { compareRequestSchema } from "@/lib/semantic/validation";
import { compareExecutions } from "@/lib/semantic/service";
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
    const parsed = compareRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const result = await compareExecutions(
      user.id,
      parsed.data.submissionIdA,
      parsed.data.submissionIdB,
      parsed.data.policy,
    );
    if (!result.ok) {
      const status = result.reason === "same_execution" ? 400 : 404;
      const message =
        result.reason === "same_execution"
          ? "An execution cannot be compared with itself."
          : "One or both executions were not found or have no comparable artifact.";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      comparisonId: result.comparisonId,
      comparison: result.comparison,
    });
  } catch (error) {
    logger.error("semantic comparison failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to compare the executions." },
      { status: 500 },
    );
  }
}
