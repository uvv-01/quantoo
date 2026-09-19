/**
 * /api/artifacts/import
 *
 * POST — import a quantoo.artifact.v1 export.
 *
 * Imported artifacts are untrusted data: structural validation with hard
 * size/depth caps, embedded integrity hash verified and reported, source
 * code stored but never executed, and the imported document is snapshotted
 * as a private artifact version owned by the caller.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { validateArtifactExport } from "@/lib/artifacts/validation";
import { sha256Canonical } from "@/lib/artifacts/integrity";
import { MAX_ARTIFACT_BYTES } from "@/lib/artifacts/service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** Hard request-body cap (the artifact cap plus JSON overhead headroom). */
const MAX_IMPORT_BODY_BYTES = MAX_ARTIFACT_BYTES + 8_000;

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "artifact"), RATE_LIMITS.artifact);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_IMPORT_BODY_BYTES) {
      return NextResponse.json({ error: "Artifact is too large." }, { status: 413 });
    }

    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_IMPORT_BODY_BYTES) {
      return NextResponse.json({ error: "Artifact is too large." }, { status: 413 });
    }

    let imported;
    try {
      imported = validateArtifactExport(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Artifact could not be validated.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const document = imported.document;

    const created = await prisma.researchArtifact.create({
      data: {
        userId: user.id,
        experimentId: null,
        problemId: null,
        title: document.title,
        description: document.description,
        visibility: "PRIVATE",
        latestVersion: 1,
        versions: {
          create: {
            version: 1,
            payload: document as unknown as import("@prisma/client").Prisma.InputJsonValue,
            payloadHash: sha256Canonical(document),
            sizeBytes: Buffer.byteLength(JSON.stringify(document), "utf8"),
          },
        },
      },
      select: { id: true },
    });

    logger.info("artifact imported", { artifactId: created.id });

    return NextResponse.json(
      {
        artifactId: created.id,
        version: 1,
        // Reported, never silently assumed: an export whose embedded hash
        // does not match its document is stored but flagged.
        integrityVerified: imported.integrityVerified,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Unable to import the artifact." }, { status: 500 });
  }
}
