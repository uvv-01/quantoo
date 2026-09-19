"use client";

/**
 * Artifact detail client (Phase 8).
 *
 * Renders one immutable artifact version: provenance, source program,
 * evidence summaries, and the integrity hash. Owners can publish a new
 * version (append-only), change visibility, export the version, and
 * delete the artifact. Integrity is verified in the browser by
 * recomputing nothing — the hash shown is the one stored at publish
 * time, and the export carries it for independent verification.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ArtifactVersionSummary,
  ArtifactVisibility,
  ResearchArtifactDocument,
} from "@/lib/artifacts/types";

interface ArtifactClientProps {
  artifactId: string;
  isOwner: boolean;
  visibility: ArtifactVisibility;
  versions: ArtifactVersionSummary[];
  initialVersion: number | null;
  initialDocument: ResearchArtifactDocument | null;
  initialHash: string | null;
}

export function ArtifactClient(props: ArtifactClientProps) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(props.visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(props.initialVersion);
  const [document_, setDocument] = useState(props.initialDocument);
  const [hash, setHash] = useState(props.initialHash);

  const loadVersion = useCallback(
    async (target: number) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/artifacts/${props.artifactId}/versions/${target}`,
        );
        if (!response.ok) {
          setError("Could not load that version.");
          return;
        }
        const body = (await response.json()) as {
          version: number;
          payloadHash: string;
          document: ResearchArtifactDocument;
        };
        setVersion(body.version);
        setDocument(body.document);
        setHash(body.payloadHash);
      } finally {
        setBusy(false);
      }
    },
    [props.artifactId],
  );

  const changeVisibility = useCallback(
    async (next: ArtifactVisibility) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch(`/api/artifacts/${props.artifactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: next }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "Could not update visibility.");
          return;
        }
        setVisibility(next);
        setNotice(`Visibility set to ${next}. Published versions are never rewritten.`);
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [props.artifactId, router],
  );

  const publishNewVersion = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/artifacts/${props.artifactId}/versions/${version ?? 1}`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as
        | { version: number; payloadHash: string }
        | { error: string }
        | null;
      if (!response.ok || !body || "error" in body) {
        setError(
          body && "error" in body ? body.error : "Could not publish a new version.",
        );
        return;
      }
      setNotice(`Version ${body.version} published with a fresh integrity hash.`);
      await loadVersion(body.version);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [props.artifactId, version, loadVersion, router]);

  const exportVersion = useCallback(() => {
    if (!document_ || !hash) return;
    const envelope = {
      schemaVersion: "quantoo.artifact.v1",
      kind: "quantoo-artifact",
      exportedAt: new Date().toISOString(),
      documentHash: hash,
      document: document_,
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `quantoo-artifact-v${version ?? 1}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [document_, hash, version]);

  const deleteArtifact = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/artifacts/${props.artifactId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/observatory");
      }
    } finally {
      setBusy(false);
    }
  }, [props.artifactId, router]);

  const evidenceSummary = useMemo(() => {
    if (!document_) return null;
    return {
      capsules: document_.evidence.capsules.length,
      reproductions: document_.evidence.reproductions.length,
      hasCompatibilityReport: document_.evidence.compatibilityReport !== null,
      shots: document_.source.shots,
      seed: document_.source.seed,
    };
  }, [document_]);

  if (!document_ || !hash) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground py-8">
          No versions of this artifact are readable yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md border px-4 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Version history</CardTitle>
          {props.isOwner ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={publishNewVersion} disabled={busy}>
                Publish new version
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => changeVisibility(visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC")}
                disabled={busy}
              >
                {visibility === "PUBLIC" ? "Make private" : "Make public"}
              </Button>
              <Button size="sm" variant="destructive" onClick={deleteArtifact} disabled={busy}>
                Delete
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {props.versions.map((entry) => (
              <li key={entry.version} className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className={`rounded px-2 py-1 underline-offset-4 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    entry.version === version ? "font-semibold" : "underline"
                  }`}
                  onClick={() => loadVersion(entry.version)}
                  disabled={busy}
                >
                  Version {entry.version}
                </button>
                <span className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-0.5 text-xs" title="sha-256 over the canonical document">
                    {entry.payloadHash.slice(0, 12)}…
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {(entry.sizeBytes / 1024).toFixed(1)} KiB
                  </span>
                  <Badge variant="outline">{entry.createdAt.slice(0, 10)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Created:</span>{" "}
              {document_.provenance.createdAt.slice(0, 10)}
            </p>
            <p>
              <span className="text-muted-foreground">Source experiment:</span>{" "}
              {document_.provenance.sourceExperimentId ? (
                <code className="rounded bg-muted px-1 text-xs">
                  {document_.provenance.sourceExperimentId.slice(0, 8)}…
                </code>
              ) : (
                "imported snapshot"
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Problem:</span>{" "}
              {document_.provenance.problem?.title ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Integrity (sha-256):</span>{" "}
              <code className="rounded bg-muted px-1 text-xs">{hash.slice(0, 24)}…</code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Execution capsules:</span>{" "}
              {evidenceSummary?.capsules}
            </p>
            <p>
              <span className="text-muted-foreground">Reproduction reports:</span>{" "}
              {evidenceSummary?.reproductions}
            </p>
            <p>
              <span className="text-muted-foreground">Compatibility report:</span>{" "}
              {evidenceSummary?.hasCompatibilityReport ? "included" : "none"}
            </p>
            <p>
              <span className="text-muted-foreground">Shots / seed:</span>{" "}
              {evidenceSummary?.shots ?? "—"} / {evidenceSummary?.seed ?? "—"}
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={exportVersion}>
              Export version {version} (JSON)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source program</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
            <code>{document_.source.sourceCode}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
