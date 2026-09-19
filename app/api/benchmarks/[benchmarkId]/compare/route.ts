/**
 * /api/benchmarks/[benchmarkId]/compare
 *
 * POST — compare two of the user's benchmark runs by their measurement
 *        distributions using the Phase 6 statistics. Weak-evidence
 *        (small shot counts) is reported explicitly, never hidden.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { z } from "zod";
import { compareBenchmarkRuns } from "@/lib/benchmarks/service";

type RouteParams = { params: Promise<{ benchmarkId: string }> };

const compareSchema = z.object({
  runAId: z.string().uuid("Invalid run id"),
  runBId: z.string().uuid("Invalid run id"),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "benchmark"), RATE_LIMITS.benchmark);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    await params; // benchmark scoping happens inside the service

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
    }
    const parsed = compareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const result = await compareBenchmarkRuns(
      user.id,
      parsed.data.runAId,
      parsed.data.runBId,
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unable to compare benchmark runs." }, { status: 500 });
  }
}
