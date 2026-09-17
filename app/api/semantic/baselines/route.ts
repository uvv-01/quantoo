/**
 * /api/semantic/baselines
 *
 * GET    ?problemSlug= — the user's baseline for a problem (with semantic record).
 * PUT                  — designate one of the user's executions as the baseline.
 * DELETE ?problemSlug= — remove the baseline.
 *
 * Only the user's own executions can become baselines; the comparison
 * policy is validated server-side.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  baselineQuerySchema,
  setBaselineRequestSchema,
} from "@/lib/semantic/validation";
import { clearBaseline, getBaseline, setBaseline } from "@/lib/semantic/service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const parsed = baselineQuerySchema.safeParse({
      problemSlug: url.searchParams.get("problemSlug") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const problem = await prisma.problem.findUnique({
      where: { slug: parsed.data.problemSlug },
      select: { id: true },
    });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found." }, { status: 404 });
    }

    const baseline = await getBaseline(user.id, problem.id);
    if (!baseline) {
      return NextResponse.json({ baseline: null });
    }
    return NextResponse.json({
      baseline: {
        submissionId: baseline.submissionId,
        policyName: baseline.policyName,
        note: baseline.note,
        createdAt: baseline.createdAt,
        record: baseline.record,
      },
    });
  } catch (error) {
    logger.error("baseline load failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load the baseline." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = setBaselineRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const problem = await prisma.problem.findUnique({
      where: { slug: parsed.data.problemSlug },
      select: { id: true },
    });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found." }, { status: 404 });
    }

    const result = await setBaseline(
      user.id,
      problem.id,
      parsed.data.submissionId,
      parsed.data.policy,
      parsed.data.note,
    );
    if (!result.ok) {
      const messages: Record<string, string> = {
        not_found: "Execution not found.",
        problem_mismatch: "The execution belongs to a different problem.",
        no_record: "The execution has no comparable artifact.",
        bad_policy: "Unknown comparison policy.",
      };
      return NextResponse.json(
        { error: messages[result.reason] ?? "Could not set the baseline." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("baseline set failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to set the baseline." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const parsed = baselineQuerySchema.safeParse({
      problemSlug: url.searchParams.get("problemSlug") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const problem = await prisma.problem.findUnique({
      where: { slug: parsed.data.problemSlug },
      select: { id: true },
    });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found." }, { status: 404 });
    }

    await clearBaseline(user.id, problem.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("baseline clear failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to clear the baseline." },
      { status: 500 },
    );
  }
}
