/**
 * /api/artifacts/[artifactId]/versions/[version]/export
 *
 * GET — the portable, tamper-evident export envelope for one immutable
 * artifact version: schema version, document hash, and the document
 * itself. Follows the version route's visibility rules (owner or public
 * artifact); exports never contain credentials or session data because
 * the stored document is validated to exclude them at publish time.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  artifactIdSchema,
  artifactVersionNumberSchema,
} from "@/lib/artifacts/validation";
import { getArtifactVersionPayload, buildArtifactExport } from "@/lib/artifacts/service";

type RouteParams = { params: Promise<{ artifactId: string; version: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    const { artifactId, version } = await params;

    const idParsed = artifactIdSchema.safeParse(artifactId);
    const versionNumber = artifactVersionNumberSchema.safeParse(version);
    if (!idParsed.success || !versionNumber.success) {
      return NextResponse.json({ error: "Invalid artifact reference." }, { status: 400 });
    }

    const payload = await getArtifactVersionPayload(
      user?.id ?? null,
      idParsed.data,
      versionNumber.data,
    );
    if (!payload) {
      return NextResponse.json({ error: "Artifact version not found." }, { status: 404 });
    }

    const envelope = buildArtifactExport(payload.document, payload.payloadHash);
    return NextResponse.json(envelope, {
      headers: {
        "Content-Disposition": `attachment; filename="quantoo-artifact-v${versionNumber.data}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to export the artifact." }, { status: 500 });
  }
}
