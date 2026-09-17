/**
 * The Quantum Judge.
 *
 * Evaluates sandbox execution outcomes against a problem's test
 * specification. The judge is deterministic and data-driven: every check is
 * derived from the problem's stored test specification (authored content),
 * never from client input, and correctness never depends on anything the
 * user's program printed.
 *
 * Check types implemented in this phase:
 *
 *  - STATE         statevector comparison via complex cosine similarity:
 *                  invariant under global phase, sensitive to relative phase
 *  - DISTRIBUTION  measurement probability distribution comparison with
 *                  tolerance; scenario-based specs (zero_state, superposition)
 *                  are evaluated against the matching runtime scenario
 *  - STRUCTURAL    required qubit count and required gates
 *  - ENTANGLEMENT  correlation check via measurement counts (parity)
 *
 * Other spec types (UNITARY, OBSERVABLE, ...) are part of the schema but not
 * yet evaluated; they are reported as SKIPPED rather than silently ignored.
 *
 * Stored specifications are authored data and may be malformed. Every check
 * validates its spec defensively; a misconfigured check is reported as
 * SKIPPED with an explanatory message instead of failing every submission.
 */

import type {
  JudgeCheck,
  JudgeResult,
  ScenarioOutcome,
} from "@/lib/exec/types";

// ========================================
// Test specification shape (stored per problem)
// ========================================

/** A stored test spec. `expected` shape depends on `type`. */
export interface TestSpec {
  type: string;
  description: string;
  expected?: unknown;
}

/** Supported judge check types. */
export const SUPPORTED_SPEC_TYPES = new Set([
  "STATE",
  "DISTRIBUTION",
  "STRUCTURAL",
  "ENTANGLEMENT",
]);

const DEFAULT_STATE_TOLERANCE = 0.01;
const DEFAULT_DISTRIBUTION_TOLERANCE = 0.05;
const DEFAULT_ENTANGLEMENT_TOLERANCE = 0.05;

// ========================================
// Spec field extraction (defensive)
// ========================================

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) return undefined;
    out.push(entry);
  }
  return out;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return undefined;
    out.push(entry);
  }
  return out;
}

function asDistribution(value: unknown): Record<string, number> | undefined {
  const record = asRecord(value);
  const keys = Object.keys(record);
  if (keys.length === 0) return undefined;
  const out: Record<string, number> = {};
  for (const key of keys) {
    const num = asNumber(record[key]);
    if (num === undefined) return undefined;
    out[key] = num;
  }
  return out;
}

// ========================================
// Judge entry point
// ========================================

/**
 * Judge a submission.
 *
 * @param specs    - parsed test specification array from the problem
 * @param outcomes - sandbox outcomes keyed by scenario name
 */
export function judgeSubmission(
  specs: TestSpec[],
  outcomes: Record<string, ScenarioOutcome>,
): JudgeResult {
  const checks: JudgeCheck[] = [];
  const submission = outcomes["submission"];

  for (const spec of specs) {
    switch (spec.type) {
      case "STATE":
        checks.push(checkState(spec, submission));
        break;
      case "DISTRIBUTION":
        checks.push(checkDistribution(spec, outcomes));
        break;
      case "STRUCTURAL":
        checks.push(checkStructural(spec, submission));
        break;
      case "ENTANGLEMENT":
        checks.push(checkEntanglement(spec, submission));
        break;
      default:
        checks.push({
          name: spec.type,
          description: spec.description,
          status: "SKIPPED",
          message: "This check type is not evaluated yet.",
        });
    }
  }

  const evaluated = checks.filter((c) => c.status !== "SKIPPED");
  const failures = evaluated.filter((c) => c.status === "FAIL");
  const passed = evaluated.length > 0 && failures.length === 0;

  const summary = passed
    ? `All ${evaluated.length} checks passed.`
    : `${failures.length} of ${evaluated.length} checks failed.`;

  return { passed, summary, checks, failures };
}

// ========================================
// STATE check
// ========================================

function checkState(
  spec: TestSpec,
  outcome: ScenarioOutcome | undefined,
): JudgeCheck {
  const base = { name: "STATE", description: spec.description };
  const expected = asRecord(spec.expected);
  const expectedVector = asNumberArray(expected["statevector"]);
  if (!expectedVector || expectedVector.length === 0) {
    return {
      ...base,
      status: "SKIPPED",
      message: "This check is misconfigured and was not evaluated.",
    };
  }
  if (!outcome) {
    return { ...base, status: "FAIL", message: "The program did not run." };
  }
  // A measured circuit has no exact final statevector, but the runtime
  // trace records the exact pre-measurement state at the last gate step —
  // the standard, honest way to inspect "the state being measured".
  const pairs =
    outcome.statevectorPairs ??
    lastPreMeasurementState(outcome.trace?.steps ?? []);
  if (!pairs) {
    return {
      ...base,
      status: "FAIL",
      message:
        "This check requires the quantum state, which was not produced for this execution.",
    };
  }
  if (pairs.length !== expectedVector.length) {
    return {
      ...base,
      status: "FAIL",
      message: `Expected ${expectedVector.length} amplitudes (${Math.log2(expectedVector.length)} qubits), the circuit produced ${pairs.length}.`,
    };
  }

  const tolerance = asNumber(expected["tolerance"]) ?? DEFAULT_STATE_TOLERANCE;
  const similarity = complexCosineSimilarity(expectedVector, pairs);

  if (similarity >= 1 - tolerance) {
    return {
      ...base,
      status: "PASS",
      message: "State matches the expected amplitudes.",
      actual: magnitudesOf(pairs).map(round4),
      expected: expectedVector,
    };
  }
  return {
    ...base,
    status: "FAIL",
    message:
      "The quantum state does not match the expected state. Check the amplitudes of your circuit.",
    actual: magnitudesOf(pairs).map(round4),
    expected: expectedVector,
  };
}

/**
 * Exact statevector just before the first measurement, from the trace.
 * Returns undefined when no trace snapshots exist — callers treat that as
 * "state unavailable" rather than fabricating data.
 */
function lastPreMeasurementState(
  steps: { measurement: boolean; afterState?: [number, number][] }[],
): [number, number][] | undefined {
  for (const step of steps) {
    if (step.measurement) {
      return steps[steps.indexOf(step) - 1]?.afterState;
    }
  }
  return steps[steps.length - 1]?.afterState;
}

/**
 * Cosine similarity between the expected real amplitude vector and the
 * actual complex amplitudes. Equals 1 when the states are identical up to
 * a global phase; relative phases still matter.
 */
function complexCosineSimilarity(
  expected: number[],
  pairs: [number, number][],
): number {
  let dotRe = 0;
  let dotIm = 0;
  let expectedNormSq = 0;
  let actualNormSq = 0;
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const [re, im] = pairs[i] ?? [0, 0];
    // <expected|actual> with real expected vector.
    dotRe += e * re;
    dotIm += e * im;
    expectedNormSq += e * e;
    actualNormSq += re * re + im * im;
  }
  const denom = Math.sqrt(expectedNormSq) * Math.sqrt(actualNormSq);
  if (denom === 0) return 0;
  return Math.sqrt(dotRe * dotRe + dotIm * dotIm) / denom;
}

function magnitudesOf(pairs: [number, number][]): number[] {
  return pairs.map(([re, im]) => Math.sqrt(re * re + im * im));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

// ========================================
// DISTRIBUTION check
// ========================================

function checkDistribution(
  spec: TestSpec,
  outcomes: Record<string, ScenarioOutcome>,
): JudgeCheck {
  const base = { name: "DISTRIBUTION", description: spec.description };
  const expected = asRecord(spec.expected);
  const expectedDistribution = asDistribution(expected["distribution"]);
  if (!expectedDistribution) {
    return {
      ...base,
      status: "SKIPPED",
      message: "This check is misconfigured and was not evaluated.",
    };
  }

  const inputScenario = expected["input"];
  const scenario =
    typeof inputScenario === "string" && inputScenario ? inputScenario : "submission";
  const outcome = outcomes[scenario];
  if (!outcome) {
    return {
      ...base,
      status: "FAIL",
      message:
        scenario === "submission"
          ? "The program did not run."
          : "The scenario required by this check did not run.",
    };
  }
  if (!outcome.counts || !outcome.shots) {
    return {
      ...base,
      status: "FAIL",
      message:
        "This check requires measurements. Add measurement operations to the circuit.",
    };
  }

  const probabilities: Record<string, number> = {};
  for (const [bits, count] of Object.entries(outcome.counts)) {
    probabilities[bits] = count / outcome.shots;
  }

  const tolerance = asNumber(expected["tolerance"]) ?? DEFAULT_DISTRIBUTION_TOLERANCE;
  const failures: string[] = [];
  for (const [bits, expectedP] of Object.entries(expectedDistribution)) {
    const actualP = probabilities[bits] ?? 0;
    if (Math.abs(actualP - expectedP) > tolerance) {
      failures.push(
        `P(${bits}) was ${actualP.toFixed(3)}, expected about ${expectedP}.`,
      );
    }
  }

  return {
    ...base,
    status: failures.length === 0 ? "PASS" : "FAIL",
    message:
      failures.length === 0
        ? "Measurement distribution matches."
        : failures.join(" "),
    actual: Object.fromEntries(
      Object.entries(probabilities).map(([k, v]) => [k, round4(v)]),
    ),
    expected: expectedDistribution,
  };
}

// ========================================
// STRUCTURAL check
// ========================================

function checkStructural(
  spec: TestSpec,
  outcome: ScenarioOutcome | undefined,
): JudgeCheck {
  const base = { name: "STRUCTURAL", description: spec.description };
  const expected = asRecord(spec.expected);
  const qubits = asNumber(expected["qubits"]);
  const gates = asStringArray(expected["gates"]);
  if (qubits === undefined && (!gates || gates.length === 0)) {
    return {
      ...base,
      status: "SKIPPED",
      message: "This check is misconfigured and was not evaluated.",
    };
  }
  if (!outcome) {
    return { ...base, status: "FAIL", message: "The program did not run." };
  }

  const problems: string[] = [];
  if (qubits !== undefined && outcome.circuit.qubits !== qubits) {
    problems.push(
      `The circuit uses ${outcome.circuit.qubits} qubit(s), expected ${qubits}.`,
    );
  }
  if (gates) {
    const present = new Set(Object.keys(outcome.circuit.gateCounts));
    for (const gate of gates) {
      if (!present.has(gate)) {
        problems.push(`The circuit is missing the ${gate} gate.`);
      }
    }
  }

  return {
    ...base,
    status: problems.length === 0 ? "PASS" : "FAIL",
    message: problems.length === 0 ? "Structure matches." : problems.join(" "),
    actual: {
      qubits: outcome.circuit.qubits,
      gates: Object.keys(outcome.circuit.gateCounts),
    },
    expected,
  };
}

// ========================================
// ENTANGLEMENT check
// ========================================

function checkEntanglement(
  spec: TestSpec,
  outcome: ScenarioOutcome | undefined,
): JudgeCheck {
  const base = { name: "ENTANGLEMENT", description: spec.description };
  if (!outcome) {
    return { ...base, status: "FAIL", message: "The program did not run." };
  }
  const expected = asRecord(spec.expected);
  if (!outcome.counts || !outcome.shots) {
    return {
      ...base,
      status: "FAIL",
      message:
        "This check requires measurements. Add measurement operations to the circuit.",
    };
  }

  // Correlation from counts: outcomes where all classical bits agree versus
  // disagree. For a Bell state, agreement is 100%.
  let agree = 0;
  let disagree = 0;
  for (const [bits, count] of Object.entries(outcome.counts)) {
    const cleaned = bits.replace(/[^01]/g, "");
    if (cleaned.length === 0) continue;
    const first = cleaned[0];
    const allSame = [...cleaned].every((b) => b === first);
    if (allSame) agree += count;
    else disagree += count;
  }
  const total = agree + disagree;
  if (total === 0) {
    return {
      ...base,
      status: "FAIL",
      message: "The execution produced no measurement outcomes to evaluate.",
    };
  }
  const correlation = agree / total;
  const expectedCorrelation = asNumber(expected["correlation"]) ?? 1;
  const ok =
    Math.abs(correlation - expectedCorrelation) <= DEFAULT_ENTANGLEMENT_TOLERANCE;

  return {
    ...base,
    status: ok ? "PASS" : "FAIL",
    message: ok
      ? "Measurement outcomes are correlated as expected."
      : `Correlated outcomes were ${(correlation * 100).toFixed(1)}% of shots, expected about ${expectedCorrelation * 100}%. Some measurements show the qubits disagreeing.`,
    actual: round4(correlation),
    expected: expectedCorrelation,
  };
}
