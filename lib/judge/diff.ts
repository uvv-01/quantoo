/**
 * Quantum Diff — reference vs student execution comparison.
 *
 * A reusable comparison layer for identifying where two executions of a
 * quantum circuit meaningfully diverge. It compares real execution artifacts
 * only, and every finding quotes observed values — it never speculates
 * about what the user did wrong in their source code.
 *
 * Comparison categories:
 *
 *   STRUCTURE    qubit/clbit counts, depth, gate multiset
 *   STATE        final statevector equivalence (global-phase invariant)
 *   PROBABILITY  exact computational-basis probabilities
 *   MEASUREMENT  sampled counts / frequencies
 *   RESOURCE     depth and operation count deltas
 *
 * Textual source-code equality is deliberately never compared: different
 * implementations can be quantum-equivalent.
 */

import type {
  CircuitMetadata,
  DiffCategory,
  DiffFinding,
  QuantumDiff,
  ScenarioOutcome,
  TraceStep,
} from "@/lib/exec/types";

/** Tolerance for exact-probability comparisons. */
const PROBABILITY_TOLERANCE = 0.01;

/** Tolerance for global-phase-invariant state comparison. */
const STATE_SIMILARITY_THRESHOLD = 0.99;

// ========================================
// Public entry point
// ========================================

/**
 * Compare a student's submission outcome against a reference outcome.
 * Both arguments are real execution artifacts (or null when the execution
 * did not produce that scenario).
 */
export function quantumDiff(
  student: ScenarioOutcome | null,
  reference: ScenarioOutcome | null,
): QuantumDiff {
  const findings: DiffFinding[] = [];

  if (!student || !reference) {
    return {
      firstDivergenceStep: null,
      agreeingSteps: 0,
      findings: [
        {
          category: "STRUCTURE",
          message: !student && !reference
            ? "Neither execution produced an outcome to compare."
            : !student
              ? "The student execution did not produce an outcome to compare."
              : "The reference execution did not produce an outcome to compare.",
        },
      ],
      equivalent: false,
    };
  }

  findings.push(...diffStructure(student.circuit, reference.circuit));
  findings.push(...diffState(student, reference));
  findings.push(...diffProbability(student, reference));
  findings.push(...diffMeasurement(student, reference));
  findings.push(...diffResource(student.circuit, reference.circuit));

  const firstDivergenceStep = firstTraceDivergence(
    student.trace?.steps,
    reference.trace?.steps,
  );
  if (firstDivergenceStep !== null) {
    findings.push(
      traceDivergenceFinding(student, reference, firstDivergenceStep),
    );
  }

  return {
    firstDivergenceStep,
    agreeingSteps:
      firstDivergenceStep === null
        ? countTraceAgreement(student.trace?.steps, reference.trace?.steps)
        : firstDivergenceStep,
    findings,
    equivalent: findings.length === 0,
  };
}

// ========================================
// STRUCTURE
// ========================================

function diffStructure(
  student: CircuitMetadata,
  reference: CircuitMetadata,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  if (student.qubits !== reference.qubits) {
    findings.push({
      category: "STRUCTURE",
      message: `The circuit uses ${student.qubits} qubit(s), the reference uses ${reference.qubits}.`,
      observed: student.qubits,
      reference: reference.qubits,
    });
  }
  if (student.clbits !== reference.clbits) {
    findings.push({
      category: "STRUCTURE",
      message: `The circuit has ${student.clbits} classical bit(s), the reference has ${reference.clbits}.`,
      observed: student.clbits,
      reference: reference.clbits,
    });
  }

  // Gate multiset comparison: names and counts, order-independent.
  const gates = new Map<string, { student: number; reference: number }>();
  for (const [name, count] of Object.entries(student.gateCounts)) {
    gates.set(name, { student: count, reference: 0 });
  }
  for (const [name, count] of Object.entries(reference.gateCounts)) {
    const entry = gates.get(name) ?? { student: 0, reference: 0 };
    entry.reference = count;
    gates.set(name, entry);
  }
  for (const [name, counts] of gates) {
    if (counts.student !== counts.reference) {
      findings.push({
        category: "STRUCTURE",
        message: `Gate ${name}: the circuit uses it ${counts.student} time(s), the reference ${counts.reference}.`,
        observed: counts.student,
        reference: counts.reference,
      });
    }
  }
  return findings;
}

// ========================================
// STATE
// ========================================

function diffState(
  student: ScenarioOutcome,
  reference: ScenarioOutcome,
): DiffFinding[] {
  const studentState = student.statevectorPairs;
  const referenceState = reference.statevectorPairs;
  if (!studentState || !referenceState) return [];

  if (studentState.length !== referenceState.length) {
    return [
      {
        category: "STATE",
        message: `The final state has ${studentState.length} amplitudes (${Math.log2(studentState.length)} qubits), the reference has ${referenceState.length} (${Math.log2(referenceState.length)} qubits).`,
        observed: studentState.length,
        reference: referenceState.length,
      },
    ];
  }

  const similarity = stateSimilarity(studentState, referenceState);
  if (similarity < STATE_SIMILARITY_THRESHOLD) {
    // Global-phase-invariant comparison; a mismatch means physically
    // different states (relative phase or amplitudes differ).
    return [
      {
        category: "STATE",
        message:
          "The final quantum state differs from the reference state (beyond global phase).",
        observed: magnitudes(studentState).map(round4),
        reference: magnitudes(referenceState).map(round4),
      },
    ];
  }
  return [];
}

/**
 * Cosine similarity between two complex amplitude vectors: 1 when the
 * states are identical up to global phase, < 1 when relative phase or
 * amplitudes differ.
 */
export function stateSimilarity(
  a: [number, number][],
  b: [number, number][],
): number {
  let dotRe = 0;
  let dotIm = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const [aRe, aIm] = a[i];
    const [bRe, bIm] = b[i];
    // <a|b> conjugate on a.
    dotRe += aRe * bRe + aIm * bIm;
    dotIm += aRe * bIm - aIm * bRe;
    normA += aRe * aRe + aIm * aIm;
    normB += bRe * bRe + bIm * bIm;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.sqrt(dotRe * dotRe + dotIm * dotIm) / denom;
}

// ========================================
// PROBABILITY
// ========================================

function diffProbability(
  student: ScenarioOutcome,
  reference: ScenarioOutcome,
): DiffFinding[] {
  const studentP = student.probabilities;
  const referenceP = reference.probabilities;
  if (!studentP || !referenceP) return [];

  const basis = new Set([...Object.keys(studentP), ...Object.keys(referenceP)]);
  const findings: DiffFinding[] = [];
  for (const state of basis) {
    const a = studentP[state] ?? 0;
    const b = referenceP[state] ?? 0;
    if (Math.abs(a - b) > PROBABILITY_TOLERANCE) {
      findings.push({
        category: "PROBABILITY",
        message: `P(|${state}⟩) is ${a.toFixed(4)} in the circuit, ${b.toFixed(4)} in the reference.`,
        observed: round4(a),
        reference: round4(b),
      });
    }
  }
  return findings;
}

// ========================================
// MEASUREMENT
// ========================================

function diffMeasurement(
  student: ScenarioOutcome,
  reference: ScenarioOutcome,
): DiffFinding[] {
  const studentCounts = student.counts;
  const referenceCounts = reference.counts;
  if (!studentCounts || !referenceCounts) return [];

  const studentTotal = Object.values(studentCounts).reduce((s, c) => s + c, 0);
  const referenceTotal = Object.values(referenceCounts).reduce(
    (s, c) => s + c,
    0,
  );
  if (studentTotal === 0 || referenceTotal === 0) return [];

  const findings: DiffFinding[] = [];
  const outcomes = new Set([
    ...Object.keys(studentCounts),
    ...Object.keys(referenceCounts),
  ]);
  for (const bits of outcomes) {
    // Sampled frequencies — the tolerance reflects sampling noise, not
    // exact probability error.
    const a = (studentCounts[bits] ?? 0) / studentTotal;
    const b = (referenceCounts[bits] ?? 0) / referenceTotal;
    if (Math.abs(a - b) > SAMPLING_TOLERANCE) {
      findings.push({
        category: "MEASUREMENT",
        message: `Outcome |${bits}⟩ was measured in ${studentCounts[bits] ?? 0}/${studentTotal} shots, the reference measured it in ${referenceCounts[bits] ?? 0}/${referenceTotal}.`,
        observed: round4(a),
        reference: round4(b),
      });
    }
  }
  return findings;
}

/**
 * Generous tolerance for sampled-frequency comparisons: at 1024 shots two
 * samples of the same 50/50 distribution differ by more than 0.05 about
 * 0.2% of the time, so this only flags systematic differences.
 */
const SAMPLING_TOLERANCE = 0.1;

// ========================================
// RESOURCE
// ========================================

function diffResource(
  student: CircuitMetadata,
  reference: CircuitMetadata,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  if (student.depth !== reference.depth) {
    findings.push({
      category: "RESOURCE",
      message: `Circuit depth is ${student.depth}, the reference is ${reference.depth}.`,
      observed: student.depth,
      reference: reference.depth,
    });
  }
  if (student.totalGates !== reference.totalGates) {
    findings.push({
      category: "RESOURCE",
      message: `Total operations: ${student.totalGates} in the circuit, ${reference.totalGates} in the reference.`,
      observed: student.totalGates,
      reference: reference.totalGates,
    });
  }
  return findings;
}

// ========================================
// Trace-level divergence
// ========================================

/**
 * Find the first step where the two traces' operations differ, or where
 * their exact post-step states first meaningfully diverge. Returns null
 * when the traces agree throughout (or when traces are unavailable).
 */
function firstTraceDivergence(
  student: TraceStep[] | undefined,
  reference: TraceStep[] | undefined,
): number | null {
  if (!student || !reference) return null;
  const n = Math.min(student.length, reference.length);
  for (let i = 0; i < n; i++) {
    if (!stepsEquivalent(student[i], reference[i])) return i;
  }
  return null;
}

function countTraceAgreement(
  student: TraceStep[] | undefined,
  reference: TraceStep[] | undefined,
): number {
  if (!student || !reference) return 0;
  const n = Math.min(student.length, reference.length);
  let agreed = 0;
  for (let i = 0; i < n; i++) {
    if (stepsEquivalent(student[i], reference[i])) agreed++;
    else break;
  }
  return agreed;
}

function stepsEquivalent(a: TraceStep, b: TraceStep): boolean {
  if (
    a.gateName !== b.gateName ||
    a.qubits.join(",") !== b.qubits.join(",")
  ) {
    return false;
  }
  const aState = a.afterState;
  const bState = b.afterState;
  if (aState && bState) {
    return stateSimilarity(aState, bState) >= STATE_SIMILARITY_THRESHOLD;
  }
  // Without snapshots on both sides, operation identity is the evidence.
  return true;
}

function traceDivergenceFinding(
  student: ScenarioOutcome,
  reference: ScenarioOutcome,
  stepIndex: number,
): DiffFinding {
  const studentStep = student.trace?.steps[stepIndex];
  const referenceStep = reference.trace?.steps[stepIndex];
  const describe = (step: TraceStep | undefined) =>
    step
      ? `${step.gateName} on qubit(s) ${step.qubits.join(", ")}`
      : "no operation";

  const category: DiffCategory = "STRUCTURE";
  if (studentStep && referenceStep && studentStep.gateName === referenceStep.gateName && studentStep.qubits.join(",") === referenceStep.qubits.join(",")) {
    // Operations agree; the states diverged.
    return {
      category: "STATE",
      message: `First detected divergence: step ${stepIndex}. The state after ${describe(studentStep)} differs from the reference state after the same step.`,
      stepIndex,
      observed: studentStep.afterState
        ? magnitudes(studentStep.afterState).map(round4)
        : undefined,
      reference: referenceStep.afterState
        ? magnitudes(referenceStep.afterState).map(round4)
        : undefined,
    };
  }
  return {
    category,
    message: `First detected divergence: step ${stepIndex}. The circuit applies ${describe(studentStep)}, the reference applies ${describe(referenceStep)}.`,
    stepIndex,
  };
}

// ========================================
// Helpers
// ========================================

function magnitudes(pairs: [number, number][]): number[] {
  return pairs.map(([re, im]) => Math.sqrt(re * re + im * im));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
