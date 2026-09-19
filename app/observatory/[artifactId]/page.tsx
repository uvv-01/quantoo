import { Badge } from "@/components/ui/badge";
import { getArtifactDetail, getArtifactVersionPayload } from "@/lib/artifacts/service";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { ArtifactClient } from "./artifact-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(artifactId)) notFound();

  const user = await getAuthenticatedUser();
  const detail = await getArtifactDetail(user?.id ?? null, artifactId);
  if (!detail) notFound();

  let isOwner = false;
  if (user) {
    const row = await prisma.researchArtifact.findUnique({
      where: { id: artifactId },
      select: { userId: true },
    });
    isOwner = row?.userId === user.id;
  }

  // Load the latest version payload for the summary view.
  const latestVersion = detail.versions[0];
  const payload = latestVersion
    ? await getArtifactVersionPayload(user?.id ?? null, artifactId, latestVersion.version)
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {detail.description ?? "Research artifact"}
            {detail.problemSlug ? ` · problem: ${detail.problemSlug}` : ""}
          </p>
        </div>
        <Badge variant={detail.visibility === "PUBLIC" ? "default" : "outline"}>
          {detail.visibility}
        </Badge>
      </div>

      <ArtifactClient
        artifactId={detail.id}
        isOwner={isOwner}
        visibility={detail.visibility}
        versions={detail.versions}
        initialVersion={latestVersion?.version ?? null}
        initialDocument={payload?.document ?? null}
        initialHash={payload?.payloadHash ?? null}
      />
    </div>
  );
}
