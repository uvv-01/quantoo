/**
 * Failure localization.
 *
 * Connects Quantum Judge failures to the execution trace so the debugger
 * can open at a meaningful step. Every hint is derived from persisted
 * execution evidence (trace snapshots, counts, exact probabilities) and is
 * phrased as an observation, never as a claim about which gate is "the
 * bug" — the evidence establishes where behavior diverged, not why.
 *
 * Language rules:
 *   - "Failure observed after step N." — divergence found in the trace
 *   - "Failure observed at the final state." — only the final state differs
 *   - "The judge checks the measurement wiring of the circuit; the trace
 *     shows the measurement steps." — measurement-related checks
 *   - "No quantum execution trace was produced." — nothing to localize
 *
 * Never: "Gate X is wrong." / "You forgot to ..." — unsupported claims.
 */

import type {
  JudgeResult,
  ScenarioOutcome,
  TraceStep,
} from "@/lib/exec/types";
import { quantumDiff } from "@/lib/judge/diff";

/** Where the evidence suggests the failure first appears. */
export interface FailureLocalization {
  /** Scenario the hint refers to (always "submission" in this phase). */
  scenario: string;
  /**
   * Suggested trace step to open in the debugger: the first divergence
   * when the trace establishes one, otherwise the last step when only the
   * final state differs, otherwise null.
   */
  stepIndex: number | null;
  /** Total number of trace steps, for positioning the suggestion. */
  totalSteps: number | null;
  /** Evidence-based observation, phrased factually. */
  observation: string;
  /** How the evidence was obtained (exact / sampled), for honest display. */
  evidence: "trace" | "final-state" | "measurements" | "none";
}

/**
 * Localize a failed submission's judge result against its execution trace.
 * `reference` is the reference execution outcome when one exists; in this
 * phase references come from problem scenarios where available.
 */
export function localizeFailure(
  judge: JudgeResult | null,
  student: ScenarioOutcome | null,
  reference: ScenarioOutcome | null,
): FailureLocalization | null {
  const trace = student?.trace;
  const steps: TraceStep[] = trace?.steps ?? [];

  if (!judge || judge.passed) return null;

  if (!student) {
    return {
      scenario: "submission",
      stepIndex: null,
      totalSteps: null,
      observation: "No quantum execution trace was produced.",
      evidence: "none",
    };
  }

  // When a reference execution exists, diffing gives the strongest evidence.
  if (reference) {
    const diff = quantumDiff(student, reference);
    if (!diff.equivalent && diff.firstDivergenceStep !== null) {
      return {
        scenario: "submission",
        stepIndex: diff.firstDivergenceStep,
        totalSteps: steps.length,
        observation: `Failure observed after step ${diff.firstDivergenceStep}. ${diff.findings[0]?.message ?? ""}`.trim(),
        evidence: "trace",
      };
    }
    if (!diff.equivalent && steps.length > 0) {
      const last = steps.length - 1;
      return {
        scenario: "submission",
        stepIndex: last,
        totalSteps: steps.length,
        observation: `Failure observed at the final state. ${diff.findings[0]?.message ?? ""}`.trim(),
        evidence: "final-state",
      };
    }
    if (!diff.equivalent) {
      return {
        scenario: "submission",
        stepIndex: null,
        totalSteps: null,
        observation: `Failure observed in the execution results. ${diff.findings[0]?.message ?? ""}`.trim(),
        evidence: "measurements",
      };
    }
  }

  // Without a reference, use the failing judge checks against the trace.
  const failedChecks = judge.failures;
  if (failedChecks.length === 0) return null;

  const measurementRelated = failedChecks.every((check) =>
    ["DISTRIBUTION", "ENTANGLEMENT"].includes(check.name),
  );
  if (measurementRelated && steps.length > 0) {
    const measureSteps = steps.filter((s) => s.measurement);
    const firstMeasure = measureSteps[0]?.stepIndex ?? steps.length - 1;
    return {
      scenario: "submission",
      stepIndex: firstMeasure,
      totalSteps: steps.length,
      observation: `The judge checks the measurement behavior of the circuit. Failure observed from step ${firstMeasure}, where the first measurement occurs.`,
      evidence: "measurements",
    };
  }

  if (steps.length > 0) {
    const last = steps.length - 1;
    return {
      scenario: "submission",
      stepIndex: last,
      totalSteps: steps.length,
      observation: `Failure observed at the final state (after step ${last}). ${failedChecks[0]?.message ?? ""}`.trim(),
      evidence: "final-state",
    };
  }

  return {
    scenario: "submission",
    stepIndex: null,
    totalSteps: null,
    observation: `Failure observed in the execution results. ${failedChecks[0]?.message ?? ""}`.trim(),
    evidence: "measurements",
  };
}
