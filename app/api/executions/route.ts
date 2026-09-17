/**
 * GET /api/executions
 *
 * Submission history for the current user: the user's own executions for a
 * problem, newest first. Ownership is enforced by scoping to the session
 * user — another user's submissions are never reachable.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { submissionQuerySchema } from "@/lib/exec/validation";
import { listUserSubmissions } from "@/lib/exec/service";
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

    const { searchParams } = new URL(request.url);
    const parsed = submissionQuerySchema.safeParse({
      problemSlug: searchParams.get("problemSlug") ?? "",
      limit: searchParams.get("limit") ?? 10,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request." },
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

    const submissions = await listUserSubmissions(
      user.id,
      problem.id,
      parsed.data.limit,
    );
    return NextResponse.json({ submissions });
  } catch (error) {
    logger.error("submission history failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load submissions." },
      { status: 500 },
    );
  }
}
