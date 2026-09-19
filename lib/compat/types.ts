/**
 * Quantum Compatibility & Reproducibility Lab — domain types (Phase 7).
 *
 * Compatibility is defined behaviorally: a program is compatible with an
 * environment when its tested semantic behavior stays within the selected
 * comparison policy — not when package versions merely match. Every
 * conclusion references evidence; unavailable facts are `null` or carry an
 * explicit reason, never an invention.
 */

import type { SemanticComparison, SemanticStatus } from "@/lib/semantic/types";

// ========================================
// Environment profiles
// ========================================

/**
 * A controlled execution environment provisioned by the application.
 * Profiles are declared in code; users never choose package sources,
 * URLs, or installation commands. Availability is measured, not assumed.
 */
export interface EnvironmentProfile {
  /** Stable identifier recorded on runs executed in this environment. */
  id: string;
  /** Human-readable name (version numbers included, never "latest"). */
  name: string;
  /** What makes this environment distinct (informational). */
  description: string;
  /** Runtime image used when this profile is selected. */
  image: string;
  /** True when the profile is the deployment's default runtime. */
  isDefault: boolean;
}

/** Measured availability of a profile in the current deployment. */
export interface EnvironmentAvailability {
  profileId: string;
  /** Status is always evidence-based: probed, never inferred from config. */
  status: "AVAILABLE" | "UNAVAILABLE" | "NOT_VERIFIED";
  /** Measured when probed; null means not probed. */
  imagePresent: boolean | null;
  checkedAt: string | null;
  /** Plain-language reason when unavailable. Never a stack trace. */
  reason: string | null;
}

/** Client-facing environment descriptor (registry + availability). */
export interface EnvironmentDescriptor {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  availability: EnvironmentAvailability;
}

// ========================================
// Experiments
// ========================================

/** A stored compatibility experiment. */
export interface CompatibilityExperimentDto {
  id: string;
  userId: string;
  problemId: string;
  name: string;
  policyName: string;
  baselineSubmissionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One cell of the environment matrix: baseline program in one environment. */
export interface CompatibilityRunDto {
  id: string;
  experimentId: string;
  role: "BASELINE" | "CANDIDATE";
  environmentId: string;
  submissionId: string | null;
  /** Backend status, evidence-backed: never a guess. */
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

// ========================================
// Compatibility report
// ========================================

/** Evidence-backed verdicts. No vague GOOD/BAD/BROKEN labels. */
export type CompatibilityOverallStatus =
  | "COMPATIBLE"
  | "COMPATIBLE_WITH_RESOURCE_CHANGE"
  | "BEHAVIORALLY_DIFFERENT"
  | "EXECUTION_FAILED"
  | "INSUFFICIENT_EVIDENCE";

/** One dimension of a compatibility report. */
export interface CompatibilityDimension {
  dimension:
    | "EXECUTION"
    | "STRUCTURE"
    | "BEHAVIOR"
    | "PROBABILITY"
    | "MEASUREMENT"
    | "RESOURCE"
    | "ENVIRONMENT";
  status: "PASS" | "WARNING" | "DIFFERENT" | "CHANGED" | "FAIL" | "NOT_COMPARED";
  message: string;
  /** Observed values backing the status (e.g. distances, deltas, indexes). */
  observed: Record<string, number | string | null> | null;
}

/** Structured comparison result for one candidate environment. */
export interface CompatibilityCandidateResult {
  environmentId: string;
  /** Backend run status (SUCCEEDED / FAILED / TIMED_OUT / ...). */
  runStatus: string;
  errorCode: string | null;
  status: CompatibilityOverallStatus;
  dimensions: CompatibilityDimension[];
  /** The Phase 6 comparison payload (evidence-linked), when produced. */
  semanticComparison: SemanticComparison | null;
}

/** Full structured compatibility report for an experiment. */
export interface CompatibilityReport {
  schemaVersion: "quantoo.compatibility.v1";
  experimentId: string;
  policyName: string;
  baselineSubmissionId: string;
  baselineEnvironmentId: string;
  overallStatus: CompatibilityOverallStatus;
  candidateResults: CompatibilityCandidateResult[];
  /** Every non-PASS difference across candidates (evidence-linked). */
  differences: SemanticComparison["differences"];
  limitations: string[];
  computedAt: string;
}

/**
 * Serializable experiment export (quantoo.experiment.v1). The capsule and
 * report are included as evidence history; they are never executed or
 * interpreted as instructions on import.
 */
export interface ExperimentExport {
  schemaVersion: "quantoo.experiment.v1";
  kind: "quantoo-experiment";
  exportedAt: string;
  experiment: {
    name: string;
    policyName: string;
    shots: number | null;
    seed: number | null;
  };
  problem: { slug: string | null; title: string | null };
  sourceCode: string;
  baselineEnvironmentId: string;
  candidateEnvironmentIds: string[];
  baselineCapsule: unknown;
  compatibilityReport: CompatibilityReport | null;
}

export type { SemanticStatus };
