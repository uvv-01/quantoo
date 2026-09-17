/**
 * PUT /api/drafts
 *
 * Save the current user's draft code for a problem (code persistence).
 * Drafts are private to the user: reads and writes always scope by the
 * session user, never by client-provided IDs.
 *
 * PUT  - save/overwrite draft
 * GET  - load draft (?problemSlug=...)
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { saveDraftSchema } from "@/lib/exec/validation";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const limit = checkRateLimit(
      getRateLimitKey(user.id, "draftSave"),
      RATE_LIMITS.draftSave,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many saves. Please wait a moment." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = saveDraftSchema.safeParse(body);
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
      return NextResponse.json(
        { error: "Problem not found." },
        { status: 404 },
      );
    }

    const draft = await prisma.problemDraft.upsert({
      where: {
        userId_problemId: { userId: user.id, problemId: problem.id },
      },
      update: { sourceCode: parsed.data.sourceCode },
      create: {
        userId: user.id,
        problemId: problem.id,
        sourceCode: parsed.data.sourceCode,
      },
      select: { updatedAt: true },
    });

    return NextResponse.json({ saved: true, updatedAt: draft.updatedAt });
  } catch (error) {
    logger.error("draft save failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to save the draft." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("problemSlug") ?? "";
    const parsed = saveDraftSchema
      .pick({ problemSlug: true })
      .safeParse({ problemSlug: slug });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid problem identifier." },
        { status: 400 },
      );
    }

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

    const draft = await prisma.problemDraft.findUnique({
      where: {
        userId_problemId: { userId: user.id, problemId: problem.id },
      },
      select: { sourceCode: true, updatedAt: true },
    });

    return NextResponse.json({
      draft: draft ? { sourceCode: draft.sourceCode, updatedAt: draft.updatedAt } : null,
    });
  } catch (error) {
    logger.error("draft load failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load the draft." },
      { status: 500 },
    );
  }
}
