/**
 * GET /api/semantic/executions?problemSlug=
 *
 * List the authenticated user's comparable executions for a problem,
 * with the designated baseline when one exists. Ownership is inherent:
 * only the user's own rows are ever returned.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { executionsQuerySchema } from "@/lib/semantic/validation";
import { listComparableExecutions } from "@/lib/semantic/service";
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
    const parsed = executionsQuerySchema.safeParse({
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

    const [executions, baseline] = await Promise.all([
      listComparableExecutions(user.id, problem.id),
      prisma.semanticBaseline.findUnique({
        where: { userId_problemId: { userId: user.id, problemId: problem.id } },
        select: { submissionId: true, policyName: true },
      }),
    ]);

    return NextResponse.json({
      executions,
      baseline: baseline ?? null,
    });
  } catch (error) {
    logger.error("semantic executions list failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to list executions." },
      { status: 500 },
    );
  }
}
