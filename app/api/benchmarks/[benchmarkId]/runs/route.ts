/**
 * /api/benchmarks/[benchmarkId]/runs
 *
 * GET  — the authenticated user's runs for a benchmark, with measurement
 *        summaries pulled from the recorded submissions.
 * POST — execute the benchmark in a registered environment. The program,
 *        shots, and seed come from the corpus row / server generation,
 *        never from client input.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { z } from "zod";
import { listBenchmarkRuns, runBenchmark } from "@/lib/benchmarks/service";
import { ENVIRONMENT_IDS } from "@/lib/compat/environments";

type RouteParams = { params: Promise<{ benchmarkId: string }> };

const runSchema = z.object({
  environmentId: z.enum(ENVIRONMENT_IDS),
});

const benchmarkIdSchema = z.string().uuid("Invalid benchmark id");

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { benchmarkId } = await params;
    const parsed = benchmarkIdSchema.safeParse(benchmarkId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid benchmark id." }, { status: 400 });
    }

    const runs = await listBenchmarkRuns(user.id, parsed.data);
    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json({ error: "Unable to load benchmark runs." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "benchmark"), RATE_LIMITS.benchmark);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429 },
      );
    }

    const { benchmarkId } = await params;
    const idParsed = benchmarkIdSchema.safeParse(benchmarkId);
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid benchmark id." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
    }
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const result = await runBenchmark({
      userId: user.id,
      benchmarkId: idParsed.data,
      environmentId: parsed.data.environmentId,
    });

    if (result.errorCode === "INVALID_REQUEST") {
      return NextResponse.json(
        { error: result.errorMessage ?? "Benchmark could not be run." },
        { status: 400 },
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to run the benchmark." }, { status: 500 });
  }
}
