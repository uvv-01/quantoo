/**
 * /api/artifacts
 *
 * GET  — list the authenticated user's research artifacts plus the
 *        currently public ones (metadata only; payloads are fetched
 *        separately by version).
 * POST — publish a research artifact from an owned compatibility
 *        experiment (creates artifact + immutable version 1).
 *
 * Publishing never executes anything and never includes credentials.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { publishArtifactSchema } from "@/lib/artifacts/validation";
import {
  listOwnArtifacts,
  listPublicArtifacts,
  publishArtifact,
} from "@/lib/artifacts/service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "artifact"), RATE_LIMITS.artifact);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429 },
      );
    }

    const [own, publicArtifacts] = await Promise.all([
      listOwnArtifacts(user.id),
      listPublicArtifacts(),
    ]);

    return NextResponse.json({
      own,
      public: publicArtifacts.filter((artifact) => !own.some((o) => o.id === artifact.id)),
    });
  } catch {
    return NextResponse.json({ error: "Unable to load artifacts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "artifact"), RATE_LIMITS.artifact);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
    }

    const parsed = publishArtifactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    // Ownership: the experiment must belong to the caller before any
    // evidence is snapshotted.
    const experiment = await prisma.compatibilityExperiment.findFirst({
      where: { id: parsed.data.experimentId, userId: user.id },
      select: { id: true },
    });
    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found." }, { status: 404 });
    }

    const result = await publishArtifact({
      userId: user.id,
      experimentId: parsed.data.experimentId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      visibility: parsed.data.visibility,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    logger.info("artifact published", {
      artifactId: result.artifactId,
      version: result.version,
      visibility: parsed.data.visibility,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to publish the artifact." }, { status: 500 });
  }
}
