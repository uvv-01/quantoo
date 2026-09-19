/**
 * Research artifact service.
 *
 * Assembles versioned evidence documents from compatibility experiments,
 * publishes them as immutable versions with integrity hashes, and reads
 * them back under strict ownership/visibility rules.
 *
 * Rules:
 *   - Identity comes from the session; the API layer passes userId in.
 *   - Published versions are immutable. Corrections create new versions.
 *   - Embedding snapshots evidence at publish time; the artifact stays
 *     interpretable even if the originating rows are later removed.
 *   - Visibility changes never rewrite history.
 */

import { prisma } from "@/lib/prisma";
import { buildExecutionCapsule } from "@/lib/semantic/capsule";
import { sha256Canonical } from "@/lib/artifacts/integrity";
import type {
  ArtifactEvidence,
  ArtifactExport,
  ArtifactProvenance,
  ArtifactVisibility,
  ArtifactVersionSummary,
  ResearchArtifactDocument,
} from "@/lib/artifacts/types";
import type { CompatibilityReport } from "@/lib/compat/types";

/** Hard cap on a serialized artifact version payload (defense in depth). */
export const MAX_ARTIFACT_BYTES = 4_000_000;

// ========================================
// Assembly
// ========================================

/**
 * Assemble a quantoo.artifact.v1 document from a compatibility experiment
 * the caller owns. Returns null when the experiment has no baseline
 * execution yet (nothing to preserve).
 */
export async function assembleArtifactFromExperiment(
  userId: string,
  experimentId: string,
  title: string,
  description: string | null,
): Promise<ResearchArtifactDocument | null> {
  const experiment = await prisma.compatibilityExperiment.findFirst({
    where: { id: experimentId, userId },
    include: {
      problem: { select: { slug: true, title: true } },
      runs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!experiment || !experiment.baselineSubmissionId) return null;

  const baselineCapsule = await buildExecutionCapsule(experiment.baselineSubmissionId);

  const candidateCapsules: ArtifactEvidence["capsules"] = [];
  for (const run of experiment.runs) {
    if (run.role !== "CANDIDATE" || !run.submissionId) continue;
    const capsule = await buildExecutionCapsule(run.submissionId);
    if (capsule) {
      candidateCapsules.push({
        role: "CANDIDATE",
        environmentId: run.environmentId,
        capsule,
      });
    }
  }

  const reproductions = await prisma.semanticReproduction.findMany({
    where: { userId, originalSubmissionId: experiment.baselineSubmissionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const evidence: ArtifactEvidence = {
    capsules: [
      ...(baselineCapsule
        ? [{ role: "BASELINE" as const, environmentId: experiment.runs.find((r) => r.role === "BASELINE")?.environmentId ?? null, capsule: baselineCapsule }]
        : []),
      ...candidateCapsules,
    ],
    compatibilityReport: (experiment.report as CompatibilityReport | null) ?? null,
    reproductions: reproductions.map((reproduction) => ({
      originalSubmissionId: reproduction.originalSubmissionId,
      reproductionSubmissionId: reproduction.reproductionSubmissionId,
      overallStatus: reproduction.overallStatus,
      report: reproduction.result,
    })),
  };

  const provenance: ArtifactProvenance = {
    createdBy: "artifact-owner",
    createdAt: new Date().toISOString(),
    problem: { slug: experiment.problem.slug, title: experiment.problem.title },
    sourceExperimentId: experiment.id,
  };

  return {
    schemaVersion: "quantoo.artifact.v1",
    artifactType: "COMPATIBILITY_EXPERIMENT",
    title,
    description,
    provenance,
    source: {
      // Prefer the experiment's own stored source (imported packages);
      // otherwise reconstruct from the baseline capsule.
      sourceCode:
        experiment.sourceCode ??
        (baselineCapsule?.sourceCode ?? ""),
      language: "python",
      shots: experiment.shots,
      seed: experiment.seed,
      policyName: experiment.policyName,
    },
    evidence,
  };
}

// ========================================
// Publish (immutable versioning)
// ========================================

/**
 * Create an artifact and publish its first immutable version in one
 * transaction. The payload hash is computed over the canonical document.
 */
export async function publishArtifact(params: {
  userId: string;
  experimentId: string;
  title: string;
  description: string | null;
  visibility: ArtifactVisibility;
}): Promise<{ artifactId: string; version: number; payloadHash: string } | { error: string }> {
  const document = await assembleArtifactFromExperiment(
    params.userId,
    params.experimentId,
    params.title,
    params.description,
  );
  if (!document) {
    return { error: "The experiment has no baseline execution to preserve yet." };
  }

  const serialized = JSON.stringify(document);
  if (Buffer.byteLength(serialized, "utf8") > MAX_ARTIFACT_BYTES) {
    return { error: "The assembled artifact exceeds the maximum supported size." };
  }

  const payloadHash = sha256Canonical(document);

  const created = await prisma.researchArtifact.create({
    data: {
      userId: params.userId,
      experimentId: params.experimentId,
      problemId: null,
      title: params.title,
      description: params.description,
      visibility: params.visibility,
      latestVersion: 1,
      versions: {
        create: {
          version: 1,
          payload: document as unknown as import("@prisma/client").Prisma.InputJsonValue,
          payloadHash,
          sizeBytes: Buffer.byteLength(serialized, "utf8"),
        },
      },
    },
    select: { id: true },
  });

  return { artifactId: created.id, version: 1, payloadHash };
}

/**
 * Publish a new immutable version of an existing artifact from its source
 * experiment's current evidence. The version number always increments.
 */
export async function publishArtifactVersion(params: {
  userId: string;
  artifactId: string;
}): Promise<{ version: number; payloadHash: string } | { error: string }> {
  const artifact = await prisma.researchArtifact.findFirst({
    where: { id: params.artifactId, userId: params.userId },
  });
  if (!artifact) return { error: "Artifact not found." };
  if (!artifact.experimentId) {
    return { error: "This artifact has no source experiment to re-snapshot." };
  }

  const document = await assembleArtifactFromExperiment(
    params.userId,
    artifact.experimentId,
    artifact.title,
    artifact.description,
  );
  if (!document) return { error: "The source experiment no longer has a baseline execution." };

  const serialized = JSON.stringify(document);
  if (Buffer.byteLength(serialized, "utf8") > MAX_ARTIFACT_BYTES) {
    return { error: "The assembled artifact exceeds the maximum supported size." };
  }

  const payloadHash = sha256Canonical(document);
  const nextVersion = artifact.latestVersion + 1;

  await prisma.$transaction([
    prisma.researchArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: nextVersion,
        payload: document as unknown as import("@prisma/client").Prisma.InputJsonValue,
        payloadHash,
        sizeBytes: Buffer.byteLength(serialized, "utf8"),
      },
    }),
    prisma.researchArtifact.update({
      where: { id: artifact.id },
      data: { latestVersion: nextVersion },
    }),
  ]);

  return { version: nextVersion, payloadHash };
}

// ========================================
// Reading
// ========================================

export interface ArtifactListItem {
  id: string;
  title: string;
  description: string | null;
  visibility: ArtifactVisibility;
  latestVersion: number;
  problemSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

/** List the user's own artifacts (private ones included). */
export async function listOwnArtifacts(userId: string): Promise<ArtifactListItem[]> {
  const rows = await prisma.researchArtifact.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { problem: { select: { slug: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    visibility: row.visibility as ArtifactVisibility,
    latestVersion: row.latestVersion,
    problemSlug: row.problem?.slug ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** List publicly visible artifacts. Only metadata is exposed here. */
export async function listPublicArtifacts(): Promise<ArtifactListItem[]> {
  const rows = await prisma.researchArtifact.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { problem: { select: { slug: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    visibility: "PUBLIC" as const,
    latestVersion: row.latestVersion,
    problemSlug: row.problem?.slug ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export interface ArtifactDetail {
  id: string;
  title: string;
  description: string | null;
  visibility: ArtifactVisibility;
  problemSlug: string | null;
  versions: ArtifactVersionSummary[];
}

/** Get artifact metadata with version summaries. Owner or public only. */
export async function getArtifactDetail(
  userId: string | null,
  artifactId: string,
): Promise<ArtifactDetail | null> {
  const artifact = await prisma.researchArtifact.findUnique({
    where: { id: artifactId },
    include: {
      problem: { select: { slug: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!artifact) return null;
  const isOwner = userId !== null && artifact.userId === userId;
  if (!isOwner && artifact.visibility !== "PUBLIC") return null;

  return {
    id: artifact.id,
    title: artifact.title,
    description: artifact.description,
    visibility: artifact.visibility as ArtifactVisibility,
    problemSlug: artifact.problem?.slug ?? null,
    versions: artifact.versions.map((version) => ({
      version: version.version,
      payloadHash: version.payloadHash,
      sizeBytes: version.sizeBytes,
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

/** Load one immutable version payload (owner or public only). */
export async function getArtifactVersionPayload(
  userId: string | null,
  artifactId: string,
  version: number,
): Promise<{ document: ResearchArtifactDocument; payloadHash: string } | null> {
  const artifact = await prisma.researchArtifact.findUnique({
    where: { id: artifactId },
    select: { userId: true, visibility: true },
  });
  if (!artifact) return null;
  const isOwner = userId !== null && artifact.userId === userId;
  if (!isOwner && artifact.visibility !== "PUBLIC") return null;

  const versionRow = await prisma.researchArtifactVersion.findUnique({
    where: { artifactId_version: { artifactId, version } },
  });
  if (!versionRow) return null;
  return {
    document: versionRow.payload as unknown as ResearchArtifactDocument,
    payloadHash: versionRow.payloadHash,
  };
}

/** Set visibility. Ownership is enforced; history is never rewritten. */
export async function setArtifactVisibility(
  userId: string,
  artifactId: string,
  visibility: ArtifactVisibility,
): Promise<boolean> {
  const result = await prisma.researchArtifact.updateMany({
    where: { id: artifactId, userId },
    data: { visibility },
  });
  return result.count > 0;
}

// ========================================
// Export envelope
// ========================================

/** Build the portable export envelope for one immutable version. */
export function buildArtifactExport(
  document: ResearchArtifactDocument,
  payloadHash: string,
): ArtifactExport {
  return {
    schemaVersion: "quantoo.artifact.v1",
    kind: "quantoo-artifact",
    exportedAt: new Date().toISOString(),
    documentHash: payloadHash,
    document,
  };
}
