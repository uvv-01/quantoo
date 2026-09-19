/**
 * /api/artifacts/[artifactId]/versions/[version]
 *
 * GET    — one immutable version payload with its integrity hash.
 * POST   — publish a new immutable version from the source experiment's
 *          current evidence (owner only; version increments, history is
 *          preserved).
 *
 * Integrity is always recomputed by the client against the embedded hash;
 * the server stores what was hashed at publish time.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import {
  artifactIdSchema,
  artifactVersionNumberSchema,
} from "@/lib/artifacts/validation";
import {
  getArtifactVersionPayload,
  publishArtifactVersion,
} from "@/lib/artifacts/service";

type RouteParams = { params: Promise<{ artifactId: string; version: string }> };

function parseVersion(raw: string): number | null {
  const parsed = artifactVersionNumberSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    const { artifactId, version } = await params;

    const idParsed = artifactIdSchema.safeParse(artifactId);
    const versionNumber = parseVersion(version);
    if (!idParsed.success || versionNumber === null) {
      return NextResponse.json({ error: "Invalid artifact reference." }, { status: 400 });
    }

    const payload = await getArtifactVersionPayload(
      user?.id ?? null,
      idParsed.data,
      versionNumber,
    );
    if (!payload) {
      return NextResponse.json({ error: "Artifact version not found." }, { status: 404 });
    }

    return NextResponse.json({
      version: versionNumber,
      payloadHash: payload.payloadHash,
      document: payload.document,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load the artifact version." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "artifact"), RATE_LIMITS.artifact);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const { artifactId, version } = await params;
    const idParsed = artifactIdSchema.safeParse(artifactId);
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid artifact id." }, { status: 400 });
    }
    // The route carries the current version; a new one is always created.
    void version;

    const result = await publishArtifactVersion({
      userId: user.id,
      artifactId: idParsed.data,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to publish the artifact version." }, { status: 500 });
  }
}
