/**
 * Quantum Semantic Observatory — domain types (Phase 6).
 *
 * A quantum program is treated as an observable behavior that can be
 * extracted from a real execution artifact, fingerprinted, compared under
 * an explicit policy, and reproduced. Every conclusion references the
 * evidence that supports it; unsupported values are `null` or carry an
 * explicit unavailability reason — never fabricated.
 */

import type {
  JudgeResult,
  ScenarioOutcome,
  TraceStep,
} from "@/lib/exec/types";

// ========================================
// Semantic status
// ========================================

/** Evidence-backed comparison verdicts. Never a bare "different" without data. */
export type SemanticStatus =
  | "EQUIVALENT"
  | "BEHAVIORALLY_EQUIVALENT"
  | "STRUCTURALLY_EQUIVALENT"
  | "RESOURCE_REGRESSION"
  | "ENVIRONMENT_DIFFERENT"
  | "DIFFERENT"
  | "INSUFFICIENT_EVIDENCE";

// ========================================
// Environment fingerprint (safe metadata only)
// ========================================

/**
 * Technical execution environment. Contains versions and configuration
 * only — never secrets, tokens, cookies, or environment variables.
 */
export interface EnvironmentFingerprint {
  python: string | null;
  framework: { name: string; version: string | null };
  simulator: { name: string; version: string | null };
  /** Additional safe package versions reported by the runtime. */
  dependencies: Record<string, string | null>;
  execution: {
    shots: number | null;
    /** Absent (null) when the execution used the simulator's entropy source. */
    seed: number | null;
    /** Transpilation/optimization setting; the local simulator does not transpile. */
    optimization: string | null;
  };
}

// ========================================
// Canonical circuit representation
// ========================================

/** One canonical operation. Gate names are normalized; ordering is preserved. */
export interface CanonicalOperation {
  /** Normalized gate name (lowercase, aliases resolved, e.g. CNOT -> cx). */
  name: string;
  qubits: number[];
  clbits: number[];
  params: number[];
  measurement: boolean;
}

/**
 * Canonical form of the executed circuit, built from the persisted trace
 * (actual operation order) or circuit metadata (counts only, order lost).
 */
export interface CanonicalCircuit {
  qubits: number;
  clbits: number;
  depth: number;
  /** Present only when the execution artifact carried a gate trace. */
  operations: CanonicalOperation[] | null;
  /** Gate multiset from circuit metadata; present even without a trace. */
  gateHistogram: Record<string, number>;
  totalOperations: number;
}

// ========================================
// Layered semantic fingerprint
// ========================================

/**
 * Deterministic fingerprints over normalized observable information.
 * Each layer is independently inspectable — never one opaque hash.
 */
export interface SemanticFingerprint {
  /** Hash of qubit/clbit counts, depth, and the gate histogram. */
  structural: string;
  /** Hash of the ordered canonical operations (requires trace data). */
  operational: string | null;
  /** Hash of exact probabilities (measurement-free circuits). */
  probability: string | null;
  /** Hash of sampled measurement frequencies at fixed rounding. */
  measurement: string | null;
  /** Hash of resource figures (depth, operation count). */
  resource: string | null;
  /** Hash of the environment fingerprint. */
  environment: string;
  /** Combined fingerprint over every available layer. */
  combined: string;
}

// ========================================
// Semantic record
// ========================================

/**
 * The observable behavior of one execution, extracted server-side from the
 * persisted execution artifact. This is the unit the observatory compares.
 */
export interface SemanticRecord {
  schemaVersion: "quantoo.semantic.v1";
  semanticRecordId: string;
  submissionId: string;
  userId: string;
  problemId: string;

  /** SHA-256 of the source text. Identity, never the comparison basis. */
  sourceFingerprint: string | null;
  circuit: CanonicalCircuit;

  /** Computed by lib/semantic/fingerprint.ts from the layers below. */
  fingerprint: SemanticFingerprint;

  /** Exact computational-basis probabilities (measurement-free circuits). */
  probabilities: Record<string, number> | null;
  /** Sampled measurement frequencies (counts / total shots). */
  measurementFrequencies: Record<string, number> | null;
  shots: number | null;
  seed: number | null;

  /** Final statevector evidence (rounded [re, im] pairs) when persisted. */
  statevector: {
    pairs: [number, number][];
    globalPhase: number | null;
  } | null;

  /** Scenario outcomes available for evidence-linked inspection. */
  scenarioNames: string[];

  environment: EnvironmentFingerprint;
  capturedAt: string;
}

// ========================================
// Comparison
// ========================================

/** A statistical comparison of two distributions. */
export interface DistributionComparison {
  metric: "total_variation" | "hellinger";
  value: number;
  threshold: number;
  pass: boolean;
  /** Population basis states compared across both distributions. */
  supportSize: number;
}

/** Which dimensions a policy requires and how strictly. */
export interface ComparisonPolicy {
  /** Unique policy name, e.g. "statistical-default". */
  name: string;
  description: string;
  /** Distributions are compared with these thresholds when available. */
  statistical: {
    metric: "total_variation" | "hellinger";
    threshold: number;
    /** Sampled comparisons below this shot count are flagged as weak evidence. */
    minimumShots: number;
  } | null;
  /** Compare exact probabilities (measurement-free circuits). */
  compareProbability: boolean;
  /** Compare sampled measurement frequencies. */
  compareMeasurement: boolean;
  /** Compare final statevectors (global-phase invariant). */
  compareState: boolean;
  /** Flag resource deltas (depth, operations) without failing correctness. */
  compareResource: boolean;
  /** Flag environment differences without failing correctness. */
  compareEnvironment: boolean;
  /** Compare the full ordered operation list (requires traces on both sides). */
  compareStructure: boolean;
}

/** One evidence-linked difference between two records. */
export interface SemanticDifference {
  /** Comparison dimension. */
  dimension:
    | "STRUCTURE"
    | "STATE"
    | "PROBABILITY"
    | "MEASUREMENT"
    | "OBSERVABLE"
    | "RESOURCE"
    | "ENVIRONMENT"
    | "SOURCE";
  status: "DIFFERENT" | "WARNING" | "PASS" | "NOT_COMPARED";
  /** Factual statement quoting observed values. No speculation. */
  message: string;
  /** Trace step / operation index of first divergence, when localized. */
  operationIndex?: number;
  qubits?: number[];
  observed?: unknown;
  reference?: unknown;
  metric?: string;
  value?: number;
  threshold?: number;
  /** Trace steps A/B at which evidence was captured, when available. */
  evidence: {
    recordA: string;
    recordB: string;
  };
}

/** Structured result of comparing two semantic records under a policy. */
export interface SemanticComparison {
  schemaVersion: "quantoo.semantic.v1";
  policyName: string;
  overallStatus: SemanticStatus;
  /** Short evidence-linked headline, e.g. "statistically indistinguishable under policy X". */
  summary: string;
  structural: SemanticDifference | null;
  state: SemanticDifference | null;
  probability: SemanticDifference | null;
  measurement: SemanticDifference | null;
  resource: SemanticDifference | null;
  environment: SemanticDifference | null;
  /** Every non-PASS difference, ordered by dimension. */
  differences: SemanticDifference[];
  /** First trace step where the executions structurally diverge, if localized. */
  firstDivergenceStep: number | null;
  limitations: string[];
  computedAt: string;
}

// ========================================
// Execution capsule
// ========================================

/**
 * Exportable, reproducibility-oriented snapshot of one execution.
 * Contains technical data only — no secrets, no session data, no other
 * users' information.
 */
export interface ExecutionCapsule {
  schemaVersion: "quantoo.execution.v1";
  capsuleId: string;
  createdAt: string;
  submissionId: string;
  problem: { slug: string; title: string; difficulty: string };
  sourceCode: string;
  execution: {
    status: string;
    passed: boolean | null;
    durationMs: number | null;
    shots: number | null;
    seed: number | null;
  };
  /** Canonical circuit reconstructed from the persisted artifact. */
  circuit: CanonicalCircuit;
  /** Persisted scenario outcomes (trace, snapshots, counts, probabilities). */
  outcomes: Record<string, ScenarioOutcome>;
  semanticRecord: SemanticRecord | null;
  judge: JudgeResult | null;
  environment: EnvironmentFingerprint;
  /** Trace of the submission scenario, kept for first-divergence localization. */
  trace: TraceStep[] | null;
}

// ========================================
// Reproduction
// ========================================

export interface ReproductionReport {
  schemaVersion: "quantoo.semantic.v1";
  /** The original execution's submission id. */
  submissionId: string;
  /** The new submission created by the reproduction run. */
  reproductionSubmissionId: string;
  policyName: string;
  overallStatus: "REPRODUCED" | "NOT_REPRODUCED" | "INSUFFICIENT_EVIDENCE";
  /** Per-dimension reproduction verdicts with evidence. */
  checks: Array<{
    dimension: string;
    status: "PASS" | "DIFFERENT" | "WARNING" | "NOT_COMPARED";
    message: string;
  }>;
  /** The structured semantic comparison between original and reproduction. */
  comparison: SemanticComparison;
  limitations: string[];
  computedAt: string;
}
