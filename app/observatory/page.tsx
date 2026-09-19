import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FlaskConical, Microscope, Layers, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listOwnArtifacts, listPublicArtifacts } from "@/lib/artifacts/service";
import type { ArtifactListItem } from "@/lib/artifacts/service";

export const dynamic = "force-dynamic";

function ArtifactRow({ artifact, showVisibility }: { artifact: ArtifactListItem; showVisibility: boolean }) {
  return (
    <Link
      href={`/observatory/${artifact.id}`}
      className="flex items-center justify-between rounded-md border px-4 py-3 text-sm hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex flex-col">
        <span className="font-medium">{artifact.title}</span>
        <span className="text-xs text-muted-foreground">
          {artifact.problemSlug ? `Problem: ${artifact.problemSlug} · ` : ""}
          v{artifact.latestVersion} · updated {artifact.updatedAt.slice(0, 10)}
        </span>
      </span>
      {showVisibility ? (
        <Badge variant={artifact.visibility === "PUBLIC" ? "default" : "outline"}>
          {artifact.visibility}
        </Badge>
      ) : (
        <Badge variant="outline">PUBLIC</Badge>
      )}
    </Link>
  );
}

export default async function ObservatoryPage() {
  const user = await getAuthenticatedUser();
  const own = user ? await listOwnArtifacts(user.id) : [];
  const publicArtifacts = (await listPublicArtifacts()).filter(
    (artifact) => !own.some((o) => o.id === artifact.id),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Observatory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preserved evidence from executions, comparisons, and reproduction attempts.
          </p>
        </div>
        <Badge variant="outline">
          <Microscope className="h-3 w-3 mr-1" aria-hidden="true" />
          Evidence
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-quantum-accent" aria-hidden="true" />
              Compatibility Lab
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Run one program across controlled environments and compare behavior under an
            explicit policy — inside any problem&apos;s workspace.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4 text-quantum-accent" aria-hidden="true" />
              Reproducibility
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Reproduce any execution and read the evidence-linked reproduction report,
            including environment match or difference.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-quantum-accent" aria-hidden="true" />
              Honest evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every status links to the measurements behind it. Unavailable facts are
            labeled, never invented.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            {!user ? (
              <EmptyState
                title="Sign in to publish"
                description="Create research artifacts from your compatibility experiments after signing in."
              />
            ) : own.length === 0 ? (
              <EmptyState
                title="No artifacts yet"
                description="Run a compatibility experiment in a problem workspace, then publish it as an immutable, integrity-hashed research artifact."
              />
            ) : (
              <div className="space-y-2">
                {own.map((artifact) => (
                  <ArtifactRow key={artifact.id} artifact={artifact} showVisibility />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Public artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            {publicArtifacts.length === 0 ? (
              <EmptyState
                title="Nothing published yet"
                description="Publicly shared research artifacts will appear here. Publishing is always an explicit owner action."
              />
            ) : (
              <div className="space-y-2">
                {publicArtifacts.map((artifact) => (
                  <ArtifactRow key={artifact.id} artifact={artifact} showVisibility={false} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
