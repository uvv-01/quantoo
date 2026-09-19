/**
 * /api/artifacts/[artifactId]
 *
 * GET    — artifact detail with version summaries (owner or public).
 * PATCH  — set visibility (owner only; history is never rewritten).
 * DELETE — delete the artifact and its versions (owner only).
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { artifactIdSchema, artifactVisibilitySchema } from "@/lib/artifacts/validation";
import { getArtifactDetail, setArtifactVisibility } from "@/lib/artifacts/service";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    const { artifactId } = await params;
    const parsed = artifactIdSchema.safeParse(artifactId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid artifact id." }, { status: 400 });
    }

    const detail = await getArtifactDetail(user?.id ?? null, parsed.data);
    if (!detail) {
      // Foreign private artifacts are indistinguishable from nonexistent.
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }
    return NextResponse.json({ artifact: detail });
  } catch {
    return NextResponse.json({ error: "Unable to load the artifact." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "artifact"), RATE_LIMITS.artifact);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const { artifactId } = await params;
    const idParsed = artifactIdSchema.safeParse(artifactId);
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid artifact id." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
    }
    const parsed = artifactVisibilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid visibility value." }, { status: 400 });
    }

    const updated = await setArtifactVisibility(
      user.id,
      idParsed.data,
      parsed.data.visibility,
    );
    if (!updated) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }
    return NextResponse.json({ visibility: parsed.data.visibility });
  } catch {
    return NextResponse.json({ error: "Unable to update the artifact." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { artifactId } = await params;
    const parsed = artifactIdSchema.safeParse(artifactId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid artifact id." }, { status: 400 });
    }

    const deleted = await prisma.researchArtifact.deleteMany({
      where: { id: parsed.data, userId: user.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete the artifact." }, { status: 500 });
  }
}
