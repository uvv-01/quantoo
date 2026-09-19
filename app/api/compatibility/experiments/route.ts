/**
 * /api/compatibility/experiments
 *
 * GET  — list the authenticated user's experiments for a problem.
 * POST — create an experiment from one of the user's own baseline
 *        executions and immediately execute it: every candidate
 *        environment runs the baseline program through the standard
 *        sandboxed pipeline with one shared shots/seed configuration,
 *        then an evidence-backed report is built server-side.
 *
 * Execution is synchronous (each candidate costs one sandbox run, capped
 * by the registry at 5) because the platform has no job queue to defer
 * to; the per-request budget is bounded by the compatibility rate limit.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { createExperimentSchema } from "@/lib/compat/validation";
import {
  createExperiment,
  executeExperiment,
  buildCompatibilityReport,
} from "@/lib/compat/experiment";
import { prisma } from "@/lib/prisma";

function rateLimitResponse(limit: { allowed: boolean; resetAt: Date }): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please wait before trying again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
        ),
      },
    },
  );
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const problemSlug = searchParams.get("problemSlug");
    if (
      !problemSlug ||
      problemSlug.length > 200 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problemSlug)
    ) {
      return NextResponse.json({ error: "Invalid problem identifier." }, { status: 400 });
    }

    const problem = await prisma.problem.findUnique({
      where: { slug: problemSlug },
      select: { id: true },
    });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found." }, { status: 404 });
    }

    const experiments = await prisma.compatibilityExperiment.findMany({
      where: { userId: user.id, problemId: problem.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        policyName: true,
        baselineSubmissionId: true,
        report: true,
        createdAt: true,
        runs: {
          select: {
            id: true,
            role: true,
            environmentId: true,
            status: true,
            submissionId: true,
            errorCode: true,
          },
        },
      },
    });

    return NextResponse.json({ experiments });
  } catch {
    return NextResponse.json(
      { error: "Unable to list experiments." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(
      getRateLimitKey(user.id, "compatibility"),
      RATE_LIMITS.compatibility,
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const body = await request.json().catch(() => null);
    const parsed = createExperimentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const problem = await prisma.problem.findUnique({
      where: { slug: parsed.data.problemSlug },
      select: { id: true, status: true, publishedAt: true },
    });
    if (!problem || problem.status !== "PUBLISHED" || !problem.publishedAt) {
      return NextResponse.json({ error: "Problem not found." }, { status: 404 });
    }

    const created = await createExperiment({
      userId: user.id,
      problemId: problem.id,
      name: parsed.data.name,
      baselineSubmissionId: parsed.data.baselineSubmissionId,
      candidateEnvironmentIds: parsed.data.candidateEnvironmentIds,
      policyName: parsed.data.policy,
    });
    if ("error" in created) {
      return NextResponse.json({ error: created.error }, { status: created.code });
    }

    const execution = await executeExperiment(created.experimentId, user.id);
    if ("error" in execution) {
      return NextResponse.json({ error: execution.error }, { status: execution.code });
    }

    const report = await buildCompatibilityReport(created.experimentId, user.id);

    return NextResponse.json({
      experimentId: created.experimentId,
      execution,
      report: "report" in report ? report.report : null,
      reportError: "error" in report ? report.error : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to run the experiment." },
      { status: 500 },
    );
  }
}
