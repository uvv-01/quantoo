/**
 * /api/compatibility/experiments/[experimentId]
 *
 * GET    — one of the authenticated user's experiments with its runs and
 *          the latest evidence-backed report.
 * DELETE — delete an owned experiment (cascade-deletes its run cells).
 *
 * Foreign experiments are indistinguishable from nonexistent (404).
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { experimentIdSchema } from "@/lib/compat/validation";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { experimentId } = await params;
    const parsed = experimentIdSchema.safeParse(experimentId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid experiment id." }, { status: 400 });
    }

    const experiment = await prisma.compatibilityExperiment.findFirst({
      where: { id: parsed.data, userId: user.id },
      include: {
        runs: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            environmentId: true,
            status: true,
            submissionId: true,
            errorCode: true,
            errorMessage: true,
            createdAt: true,
          },
        },
      },
    });
    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found." }, { status: 404 });
    }

    return NextResponse.json({ experiment });
  } catch {
    return NextResponse.json(
      { error: "Unable to load the experiment." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { experimentId } = await params;
    const parsed = experimentIdSchema.safeParse(experimentId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid experiment id." }, { status: 400 });
    }

    const deleted = await prisma.compatibilityExperiment.deleteMany({
      where: { id: parsed.data, userId: user.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Experiment not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete the experiment." },
      { status: 500 },
    );
  }
}
