/**
 * Semantic record extraction (Phase 6).
 *
 * Builds a SemanticRecord from a persisted execution artifact. The record
 * contains only information the execution actually produced: probabilities
 * exist only for measurement-free circuits, measurement frequencies only
 * for measured ones, statevector evidence only when it was persisted
 * within the storage caps. Missing information is null — never inferred.
 */

import type { ScenarioOutcome } from "@/lib/exec/types";
import { canonicalCircuitFromOutcome, sourceFingerprint } from "@/lib/semantic/canonical";
import { frequenciesFromCounts } from "@/lib/semantic/statistics";
import { computeSemanticFingerprint } from "@/lib/semantic/fingerprint";
import type {
  EnvironmentFingerprint,
  SemanticRecord,
} from "@/lib/semantic/types";

/**
 * The persisted execution artifact shape written by lib/exec/service.ts.
 * Older rows may lack `environment`; every field is defensively validated.
 */
export interface StoredExecutionArtifact {
  outcomes: Record<string, ScenarioOutcome>;
  environment?: unknown;
}

/** Environment fingerprint when the runtime did not report versions. */
export function unknownEnvironment(
  execution: { shots: number | null; seed: number | null } = {
    shots: null,
    seed: null,
  },
): EnvironmentFingerprint {
  return {
    python: null,
    framework: { name: "unknown", version: null },
    simulator: { name: "unknown", version: null },
    dependencies: {},
    execution: {
      shots: execution.shots,
      seed: execution.seed,
      optimization: null,
    },
  };
}

/** Defensive shape check for a persisted scenario outcome. */
function isScenarioOutcome(value: unknown): value is ScenarioOutcome {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  const circuit = o.circuit as Record<string, unknown> | undefined;
  return (
    !!circuit &&
    typeof circuit.qubits === "number" &&
    typeof circuit.clbits === "number" &&
    typeof circuit.depth === "number" &&
    typeof circuit.gateCounts === "object" &&
    circuit.gateCounts !== null
  );
}

/**
 * Extract a semantic record from a submission row's persisted artifact.
 * Returns null when the artifact is missing or malformed (e.g. failed
 * executions, legacy rows) — callers must surface that honestly.
 */
export function extractSemanticRecord(input: {
  submissionId: string;
  userId: string;
  problemId: string;
  sourceCode: string | null;
  artifact: unknown;
}): SemanticRecord | null {
  if (!input.artifact || typeof input.artifact !== "object") return null;
  const artifact = input.artifact as Record<string, unknown>;
  const rawOutcomes = artifact.outcomes;
  if (!rawOutcomes || typeof rawOutcomes !== "object") return null;
  const outcomes = rawOutcomes as Record<string, unknown>;
  const submissionOutcome = outcomes["submission"];
  if (!isScenarioOutcome(submissionOutcome)) return null;

  const circuit = canonicalCircuitFromOutcome(submissionOutcome);
  if (!circuit) return null;

  // Exact probabilities exist only for measurement-free circuits whose
  // statevector was persisted. Sampled frequencies exist only for measured
  // circuits with a positive shot total.
  const probabilities =
    submissionOutcome.probabilities &&
    Object.keys(submissionOutcome.probabilities).length > 0
      ? submissionOutcome.probabilities
      : null;
  const measurementFrequencies = submissionOutcome.counts
    ? frequenciesFromCounts(submissionOutcome.counts)
    : null;

  const shots =
    typeof submissionOutcome.shots === "number" ? submissionOutcome.shots : null;
  const seed =
    typeof submissionOutcome.seed === "number" ? submissionOutcome.seed : null;

  const environment = parseEnvironment(
    artifact.environment,
    shots,
    seed,
  );

  const statevector =
    submissionOutcome.statevectorPairs &&
    Array.isArray(submissionOutcome.statevectorPairs) &&
    submissionOutcome.statevectorPairs.length > 0
      ? {
          pairs: submissionOutcome.statevectorPairs,
          globalPhase:
            typeof submissionOutcome.globalPhase === "number"
              ? submissionOutcome.globalPhase
              : null,
        }
      : null;

  return {
    schemaVersion: "quantoo.semantic.v1",
    semanticRecordId: `sem_${input.submissionId}`,
    submissionId: input.submissionId,
    userId: input.userId,
    problemId: input.problemId,
    sourceFingerprint: input.sourceCode
      ? sourceFingerprint(input.sourceCode)
      : null,
    circuit,
    fingerprint: computeSemanticFingerprint({
      circuit,
      probabilities,
      measurementFrequencies,
      environment,
    }),
    probabilities,
    measurementFrequencies,
    shots,
    seed,
    statevector,
    scenarioNames: Object.keys(outcomes),
    environment,
    capturedAt: new Date().toISOString(),
  };
}

/** Validate the stored environment block, falling back to unknowns. */
function parseEnvironment(
  raw: unknown,
  shots: number | null,
  seed: number | null,
): EnvironmentFingerprint {
  if (!raw || typeof raw !== "object") return unknownEnvironment({ shots, seed });
  const env = raw as Record<string, unknown>;
  const str = (value: unknown): string | null =>
    typeof value === "string" && value.length <= 64 ? value : null;
  const component = (
    value: unknown,
  ): { name: string; version: string | null } => {
    if (!value || typeof value !== "object") {
      return { name: "unknown", version: null };
    }
    const c = value as Record<string, unknown>;
    return { name: str(c.name) ?? "unknown", version: str(c.version) };
  };
  const deps: Record<string, string | null> = {};
  if (env.numpy !== undefined) deps.numpy = str(env.numpy);
  return {
    python: str(env.python),
    framework: component(env.framework),
    simulator: component(env.simulator),
    dependencies: deps,
    execution: { shots, seed, optimization: null },
  };
}
