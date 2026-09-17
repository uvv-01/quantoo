/**
 * Semantic comparison engine (Phase 6).
 *
 * Compares two semantic records under an explicit policy and returns a
 * structured, evidence-linked verdict. Every difference quotes observed
 * values; every PASS/FAIL is tied to a metric and threshold where a metric
 * applies; limitations are stated rather than hidden.
 *
 * Wording rules:
 *   - "statistically indistinguishable under policy X" for sampled data
 *   - "observationally equivalent under policy X" for the overall verdict
 *   - "first observed divergence" (never "root cause")
 *   - global-phase differences are not behavioral differences
 */

import { firstStructuralDifference } from "@/lib/semantic/canonical";
import { compareDistributions } from "@/lib/semantic/statistics";
import { stateSimilarity } from "@/lib/judge/diff";
import type {
  ComparisonPolicy,
  SemanticComparison,
  SemanticDifference,
  SemanticRecord,
  SemanticStatus,
} from "@/lib/semantic/types";

/** Similarity threshold for global-phase-invariant state comparison. */
const STATE_SIMILARITY_THRESHOLD = 0.99;

/** Resource delta ratio above which a WARNING (not failure) is raised. */
const RESOURCE_WARNING_RATIO = 1.25;

/** Default policy: statistical behavior comparison with generous evidence rules. */
export const DEFAULT_COMPARISON_POLICY: ComparisonPolicy = {
  name: "statistical-default",
  description:
    "Statistical behavior comparison: distributions within configured distance, structure compared when traces exist, resources and environment reported separately.",
  statistical: {
    metric: "hellinger",
    threshold: 0.05,
    minimumShots: 1024,
  },
  compareProbability: true,
  compareMeasurement: true,
  compareState: true,
  compareResource: true,
  compareEnvironment: true,
  compareStructure: true,
};

/** Strict policy: exact agreement of persisted observable data. */
export const EXACT_COMPARISON_POLICY: ComparisonPolicy = {
  name: "exact",
  description:
    "Exact comparison: persisted observable data must agree within tight tolerances. Sampled data is compared statistically with a small threshold.",
  statistical: {
    metric: "total_variation",
    threshold: 0.01,
    minimumShots: 4096,
  },
  compareProbability: true,
  compareMeasurement: true,
  compareState: true,
  compareResource: false,
  compareEnvironment: false,
  compareStructure: true,
};

/** Look up a policy by name; unknown names fall back to the default. */
export function resolveComparisonPolicy(name: string | null | undefined): ComparisonPolicy {
  switch (name) {
    case "exact":
      return EXACT_COMPARISON_POLICY;
    case "statistical-default":
      return DEFAULT_COMPARISON_POLICY;
    default:
      return DEFAULT_COMPARISON_POLICY;
  }
}

/** All policy names accepted by the API. */
export const COMPARISON_POLICY_NAMES = ["statistical-default", "exact"] as const;

// ========================================
// Entry point
// ========================================

/**
 * Compare two semantic records under a policy. Both records must describe
 * real executions; when neither carries behavioral evidence (no
 * probabilities, no measurements, no statevector), the verdict is
 * INSUFFICIENT_EVIDENCE rather than a guess.
 */
export function compareSemanticRecords(
  a: SemanticRecord,
  b: SemanticRecord,
  policy: ComparisonPolicy = DEFAULT_COMPARISON_POLICY,
): SemanticComparison {
  const differences: SemanticDifference[] = [];
  const limitations: string[] = [];

  const evidenceIds = { recordA: a.semanticRecordId, recordB: b.semanticRecordId };

  // ---------- STRUCTURE ----------
  let structural: SemanticDifference | null = null;
  if (!policy.compareStructure) {
    structural = notCompared("STRUCTURE", evidenceIds);
    differences.push(structural);
  } else if (!a.circuit.operations || !b.circuit.operations) {
    const diff = firstStructuralDifference(a.circuit, b.circuit);
    limitations.push(
      "Full ordered operation lists are unavailable for at least one execution; structure was compared on the gate multiset only.",
    );
    structural = diff
      ? {
          dimension: "STRUCTURE",
          status: "DIFFERENT",
          message: diff.message,
          observed: null,
          reference: null,
          evidence: evidenceIds,
        }
      : {
          dimension: "STRUCTURE",
          status: "PASS",
          message: "Circuit structure agrees on qubits, classical bits, depth, and gate multiset (ordered operations unavailable).",
          evidence: evidenceIds,
        };
    differences.push(structural);
  } else {
    const diff = firstStructuralDifference(a.circuit, b.circuit);
    structural = diff
      ? {
          dimension: "STRUCTURE",
          status: "DIFFERENT",
          message: diff.message,
          operationIndex: diff.operationIndex,
          qubits: diff.qubits,
          evidence: evidenceIds,
        }
      : {
          dimension: "STRUCTURE",
          status: "PASS",
          message: "Circuit structure agrees across all ordered operations.",
          evidence: evidenceIds,
        };
    differences.push(structural);
  }

  // ---------- STATE ----------
  let state: SemanticDifference | null = null;
  if (!policy.compareState) {
    state = notCompared("STATE", evidenceIds);
    differences.push(state);
  } else if (a.statevector && b.statevector) {
    if (a.statevector.pairs.length !== b.statevector.pairs.length) {
      state = {
        dimension: "STATE",
        status: "DIFFERENT",
        message: `Statevector dimension differs: ${a.statevector.pairs.length} vs ${b.statevector.pairs.length} amplitudes.`,
        evidence: evidenceIds,
      };
    } else {
      const similarity = stateSimilarity(a.statevector.pairs, b.statevector.pairs);
      state =
        similarity >= STATE_SIMILARITY_THRESHOLD
          ? {
              dimension: "STATE",
              status: "PASS",
              message: "Final states agree (global-phase invariant comparison).",
              metric: "state_similarity",
              value: Math.round(similarity * 10_000) / 10_000,
              threshold: STATE_SIMILARITY_THRESHOLD,
              evidence: evidenceIds,
            }
          : {
              dimension: "STATE",
              status: "DIFFERENT",
              message:
                "Final states differ beyond global phase: amplitudes or relative phases differ.",
              metric: "state_similarity",
              value: Math.round(similarity * 10_000) / 10_000,
              threshold: STATE_SIMILARITY_THRESHOLD,
              evidence: evidenceIds,
            };
    }
    differences.push(state);
  } else {
    limitations.push(
      "Statevector evidence was not persisted for at least one execution; state comparison was skipped.",
    );
  }

  // ---------- PROBABILITY ----------
  let probability: SemanticDifference | null = null;
  if (!policy.compareProbability) {
    probability = notCompared("PROBABILITY", evidenceIds);
    differences.push(probability);
  } else if (a.probabilities && b.probabilities) {
    const metric = policy.statistical?.metric ?? "hellinger";
    const threshold = policy.statistical?.threshold ?? 0.05;
    const cmp = compareDistributions(a.probabilities, b.probabilities, metric, threshold);
    probability = cmp.pass
      ? {
          dimension: "PROBABILITY",
          status: "PASS",
          message: `Exact probability distributions agree (${metric} = ${formatValue(cmp.value)} ≤ ${formatValue(threshold)}).`,
          metric,
          value: cmp.value,
          threshold,
          evidence: evidenceIds,
        }
      : {
          dimension: "PROBABILITY",
          status: "DIFFERENT",
          message: `Exact probability distributions differ (${metric} = ${formatValue(cmp.value)} > ${formatValue(threshold)}).`,
          metric,
          value: cmp.value,
          threshold,
          evidence: evidenceIds,
        };
    differences.push(probability);
  } else {
    limitations.push(
      "Exact probabilities are only produced by measurement-free circuits; at least one execution measured its qubits, so exact-probability comparison was skipped.",
    );
  }

  // ---------- MEASUREMENT ----------
  let measurement: SemanticDifference | null = null;
  let statisticalWeak = false;
  if (!policy.compareMeasurement) {
    measurement = notCompared("MEASUREMENT", evidenceIds);
    differences.push(measurement);
  } else if (a.measurementFrequencies && b.measurementFrequencies) {
    const metric = policy.statistical?.metric ?? "hellinger";
    const threshold = policy.statistical?.threshold ?? 0.05;
    const minShots = policy.statistical?.minimumShots ?? 0;
    const cmp = compareDistributions(
      a.measurementFrequencies,
      b.measurementFrequencies,
      metric,
      threshold,
    );
    const shotsKnown = a.shots !== null && b.shots !== null;
    const shotsOk =
      shotsKnown &&
      (a.shots as number) >= minShots &&
      (b.shots as number) >= minShots;
    statisticalWeak = shotsKnown && !shotsOk;
    if (statisticalWeak) {
      limitations.push(
        `Sampled comparison used fewer than ${minShots} shots on at least one side; the verdict is correspondingly weaker evidence.`,
      );
    }
    measurement = cmp.pass
      ? {
          dimension: "MEASUREMENT",
          status: "PASS",
          message: `Measurement distributions are ${statisticalWeak ? "within tolerance (low shot count)" : "statistically indistinguishable"} (${metric} = ${formatValue(cmp.value)} ≤ ${formatValue(threshold)}).`,
          metric,
          value: cmp.value,
          threshold,
          evidence: evidenceIds,
        }
      : {
          dimension: "MEASUREMENT",
          status: "DIFFERENT",
          message: `Measurement distributions differ beyond the configured tolerance (${metric} = ${formatValue(cmp.value)} > ${formatValue(threshold)}).`,
          metric,
          value: cmp.value,
          threshold,
          evidence: evidenceIds,
        };
    differences.push(measurement);
  } else {
    limitations.push(
      "Measurement data was not persisted for at least one execution; measurement comparison was skipped.",
    );
  }

  // ---------- RESOURCE ----------
  let resource: SemanticDifference | null = null;
  if (!policy.compareResource) {
    resource = notCompared("RESOURCE", evidenceIds);
    differences.push(resource);
  } else {
    const depthDelta = b.circuit.depth - a.circuit.depth;
    const opDelta = b.circuit.totalOperations - a.circuit.totalOperations;
    const grew =
      depthDelta > 0 || opDelta > 0
        ? Math.max(
            depthDelta / Math.max(a.circuit.depth, 1),
            opDelta / Math.max(a.circuit.totalOperations, 1),
          ) > RESOURCE_WARNING_RATIO
          ? "strong"
          : "some"
        : null;
    resource =
      grew === null
        ? {
            dimension: "RESOURCE",
            status: "PASS",
            message: `Resource profile agrees (depth ${a.circuit.depth}, operations ${a.circuit.totalOperations}).`,
            evidence: evidenceIds,
          }
        : {
            dimension: "RESOURCE",
            status: "WARNING",
            message: `Resource change, not a correctness difference: depth ${a.circuit.depth} → ${b.circuit.depth} (${signed(depthDelta)}), operations ${a.circuit.totalOperations} → ${b.circuit.totalOperations} (${signed(opDelta)}).`,
            observed: { depth: b.circuit.depth, operations: b.circuit.totalOperations },
            reference: { depth: a.circuit.depth, operations: a.circuit.totalOperations },
            evidence: evidenceIds,
          };
    differences.push(resource);
  }

  // ---------- ENVIRONMENT ----------
  let environment: SemanticDifference | null = null;
  if (!policy.compareEnvironment) {
    environment = notCompared("ENVIRONMENT", evidenceIds);
    differences.push(environment);
  } else {
    const envDiff = environmentDifferences(a.environment, b.environment);
    environment =
      envDiff.length === 0
        ? {
            dimension: "ENVIRONMENT",
            status: "PASS",
            message: "Execution environment and configuration match on every recorded field.",
            evidence: evidenceIds,
          }
        : {
            dimension: "ENVIRONMENT",
            status: "WARNING",
            message: `Environment differs: ${envDiff.join("; ")}.`,
            observed: summarizeEnvironment(b.environment),
            reference: summarizeEnvironment(a.environment),
            evidence: evidenceIds,
          };
    differences.push(environment);
  }

  const firstDivergenceStep = structuralDivergenceStep(a, b);

  return {
    schemaVersion: "quantoo.semantic.v1",
    policyName: policy.name,
    overallStatus: computeOverallStatus({
      structural,
      state,
      probability,
      measurement,
      resource,
      environment,
      limitations,
    }),
    summary: buildSummary({
      structural,
      state,
      probability,
      measurement,
      resource,
      environment,
    }),
    structural,
    state,
    probability,
    measurement,
    resource,
    environment,
    differences,
    firstDivergenceStep,
    limitations,
    computedAt: new Date().toISOString(),
  };
}

// ========================================
// Status derivation
// ========================================

interface DimensionSet {
  structural: SemanticDifference | null;
  state: SemanticDifference | null;
  probability: SemanticDifference | null;
  measurement: SemanticDifference | null;
  resource: SemanticDifference | null;
  environment: SemanticDifference | null;
  limitations?: string[];
}

function computeOverallStatus(d: DimensionSet): SemanticStatus {
  const behavioralCompared = [d.state, d.probability, d.measurement].filter(
    (x): x is SemanticDifference =>
      x !== null &&
      (x.status === "PASS" || x.status === "DIFFERENT" || x.status === "WARNING"),
  );
  const anyBehavioralDifferent = behavioralCompared.some(
    (x) => x.status === "DIFFERENT",
  );

  if (anyBehavioralDifferent) {
    return "DIFFERENT";
  }
  if (behavioralCompared.length === 0) {
    // Nothing behavioral was comparable: say so instead of guessing.
    return d.structural?.status === "PASS"
      ? "STRUCTURALLY_EQUIVALENT"
      : "INSUFFICIENT_EVIDENCE";
  }
  // Resource growth is reported before structural notes: a bigger
  // equivalent circuit is a resource regression by construction.
  if (d.resource?.status === "WARNING") return "RESOURCE_REGRESSION";
  if (d.structural?.status === "DIFFERENT") {
    return "BEHAVIORALLY_EQUIVALENT";
  }
  if (d.environment?.status === "WARNING") return "ENVIRONMENT_DIFFERENT";
  return "EQUIVALENT";
}

function buildSummary(d: {
  structural: SemanticDifference | null;
  state: SemanticDifference | null;
  probability: SemanticDifference | null;
  measurement: SemanticDifference | null;
  resource: SemanticDifference | null;
  environment: SemanticDifference | null;
}): string {
  const overall = computeOverallStatus(d);
  switch (overall) {
    case "EQUIVALENT":
      return "Observationally equivalent under the configured policy: structure and behavior evidence agree.";
    case "BEHAVIORALLY_EQUIVALENT":
      return "Behaviorally equivalent under the configured policy: behavior evidence agrees while circuit structure differs.";
    case "STRUCTURALLY_EQUIVALENT":
      return "Structurally equivalent; behavioral evidence was insufficient for a behavioral verdict.";
    case "DIFFERENT":
      return "Behaviorally different under the configured policy: at least one behavioral dimension differs beyond tolerance.";
    case "RESOURCE_REGRESSION":
      return "Behaviorally equivalent with a resource change (depth/operation growth).";
    case "ENVIRONMENT_DIFFERENT":
      return "Behaviorally equivalent; the execution environment or configuration differs.";
    default:
      return "Insufficient evidence: neither execution produced comparable behavioral data.";
  }
}

// ========================================
// Environment comparison
// ========================================

function environmentDifferences(
  a: SemanticRecord["environment"],
  b: SemanticRecord["environment"],
): string[] {
  const diffs: string[] = [];
  if ((a.python ?? null) !== (b.python ?? null)) {
    diffs.push(`Python ${a.python ?? "not recorded"} → ${b.python ?? "not recorded"}`);
  }
  if (a.framework.name !== b.framework.name) {
    diffs.push(`Framework ${a.framework.name} → ${b.framework.name}`);
  } else if ((a.framework.version ?? null) !== (b.framework.version ?? null)) {
    diffs.push(
      `${a.framework.name} ${a.framework.version ?? "not recorded"} → ${b.framework.version ?? "not recorded"}`,
    );
  }
  if (a.simulator.name !== b.simulator.name) {
    diffs.push(`Simulator ${a.simulator.name} → ${b.simulator.name}`);
  } else if ((a.simulator.version ?? null) !== (b.simulator.version ?? null)) {
    diffs.push(
      `simulator ${a.simulator.name} ${a.simulator.version ?? "not recorded"} → ${b.simulator.version ?? "not recorded"}`,
    );
  }
  const depNames = new Set([
    ...Object.keys(a.dependencies),
    ...Object.keys(b.dependencies),
  ]);
  for (const dep of depNames) {
    const va = a.dependencies[dep] ?? null;
    const vb = b.dependencies[dep] ?? null;
    if (va !== vb) diffs.push(`${dep} ${va ?? "not recorded"} → ${vb ?? "not recorded"}`);
  }
  if ((a.execution.shots ?? null) !== (b.execution.shots ?? null)) {
    diffs.push(`Shots ${a.execution.shots ?? "not recorded"} → ${b.execution.shots ?? "not recorded"}`);
  }
  if ((a.execution.seed ?? null) !== (b.execution.seed ?? null)) {
    diffs.push(`Seed ${a.execution.seed ?? "entropy source"} → ${b.execution.seed ?? "entropy source"}`);
  }
  return diffs;
}

function summarizeEnvironment(env: SemanticRecord["environment"]) {
  return {
    python: env.python,
    framework: env.framework,
    simulator: env.simulator,
    dependencies: env.dependencies,
    execution: env.execution,
  };
}

// ========================================
// Trace-level first divergence
// ========================================

/**
 * First trace step where the two records' canonical operations diverge.
 * Requires ordered operations on both sides; returns null otherwise.
 */
export function structuralDivergenceStep(
  a: SemanticRecord,
  b: SemanticRecord,
): number | null {
  if (!a.circuit.operations || !b.circuit.operations) return null;
  const n = Math.min(a.circuit.operations.length, b.circuit.operations.length);
  for (let i = 0; i < n; i++) {
    const opA = a.circuit.operations[i];
    const opB = b.circuit.operations[i];
    if (
      opA.name !== opB.name ||
      opA.qubits.join(",") !== opB.qubits.join(",")
    ) {
      return i;
    }
  }
  if (a.circuit.operations.length !== b.circuit.operations.length) {
    return Math.min(a.circuit.operations.length, b.circuit.operations.length);
  }
  return null;
}

// ========================================
// Helpers
// ========================================

function notCompared(
  dimension: SemanticDifference["dimension"],
  evidence: { recordA: string; recordB: string },
): SemanticDifference {
  return {
    dimension,
    status: "NOT_COMPARED",
    message: "Not compared: excluded by the comparison policy.",
    evidence,
  };
}

function signed(delta: number): string {
  return delta >= 0 ? `+${delta}` : String(delta);
}

function formatValue(value: number): string {
  return value >= 0.0001 ? value.toFixed(4) : value.toExponential(2);
}
