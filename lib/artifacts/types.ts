/**
 * Research artifact document types (quantoo.artifact.v1).
 *
 * A research artifact preserves provenance: it records what was executed,
 * where, with which configuration, and carries the evidence produced by
 * the Phase 6/7 engines. It contains technical data only — never
 * credentials, session data, or environment variables.
 *
 * Integrity hashes are conventional sha-256 digests over canonical JSON.
 * They are integrity mechanisms, not "quantum hashes".
 */

// ========================================
// Visibility
// ========================================

/** Artifact visibility. Publishing is always an explicit user action. */
export type ArtifactVisibility = "PRIVATE" | "PUBLIC";

// ========================================
// Provenance
// ========================================

/** Who created the artifact and from what. Identity is minimal by design. */
export interface ArtifactProvenance {
  /** Display name of the artifact creator at publish time. */
  createdBy: string;
  /** UTC timestamp of artifact creation (ISO 8601). */
  createdAt: string;
  /** Problem context, when the evidence originates from a problem. */
  problem: { slug: string | null; title: string | null } | null;
  /** Source experiment reference, when assembled from one. */
  sourceExperimentId: string | null;
}

// ========================================
// Artifact sections
// ========================================

/** The program and its shared execution configuration. */
export interface ArtifactSourceSection {
  sourceCode: string;
  language: string;
  shots: number | null;
  seed: number | null;
  policyName: string | null;
}

/**
 * Evidence produced by the Phase 6/7 engines. Sections are embedded
 * snapshots: they are frozen at publish time and never re-resolved, so
 * the artifact remains interpretable even if original rows are deleted.
 */
export interface ArtifactEvidence {
  /** Phase 6 execution capsule(s): baseline and, when present, candidates. */
  capsules: Array<{
    role: "BASELINE" | "CANDIDATE";
    environmentId: string | null;
    capsule: unknown;
  }>;
  /** Phase 7 compatibility report, when the artifact came from an experiment. */
  compatibilityReport: unknown | null;
  /** Reproduction reports, when reproduction was performed. */
  reproductions: Array<{
    originalSubmissionId: string;
    reproductionSubmissionId: string;
    overallStatus: string;
    report: unknown;
  }>;
}

/**
 * Versioned research artifact document. Only fields actually implemented
 * by the platform are described; the schema exists for long-term
 * evolution and is validated defensively on import.
 */
export interface ResearchArtifactDocument {
  schemaVersion: "quantoo.artifact.v1";
  artifactType: "COMPATIBILITY_EXPERIMENT";
  title: string;
  description: string | null;
  provenance: ArtifactProvenance;
  source: ArtifactSourceSection;
  evidence: ArtifactEvidence;
}

// ========================================
// Export envelope
// ========================================

/** Serializable export format for a research artifact version. */
export interface ArtifactExport {
  schemaVersion: "quantoo.artifact.v1";
  kind: "quantoo-artifact";
  exportedAt: string;
  /** sha-256 over the canonical JSON of `document`. */
  documentHash: string;
  document: ResearchArtifactDocument;
}

// ========================================
// Version info (API responses)
// ========================================

export interface ArtifactVersionSummary {
  version: number;
  payloadHash: string;
  sizeBytes: number;
  createdAt: string;
}
