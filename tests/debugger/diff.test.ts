/**
 * Quantum Diff + failure localization tests.
 *
 * All inputs are real-shaped execution artifacts; expectations verify
 * evidence-based behavior: findings quote observed values, equivalence is
 * global-phase invariant, and no claim exceeds the evidence.
 */

import { describe, it, expect } from "vitest";
import { quantumDiff, stateSimilarity } from "@/lib/judge/diff";
import { localizeFailure } from "@/lib/judge/failure-localization";
import type {
  CircuitMetadata,
  JudgeResult,
  ScenarioOutcome,
  TraceStep,
} from "@/lib/exec/types";

function circuit(overrides: Partial<CircuitMetadata> = {}): CircuitMetadata {
  return {
    qubits: 2,
    clbits: 2,
    depth: 3,
    gateCounts: { h: 1, cx: 1, measure: 2 },
    totalGates: 4,
    ...overrides,
  };
}

function outcome(overrides: Partial<ScenarioOutcome> = {}): ScenarioOutcome {
  return {
    scenario: "submission",
    circuit: circuit(),
    ...overrides,
  };
}

function traceStep(
  stepIndex: number,
  gateName: string,
  qubits: number[],
  afterState?: [number, number][],
): TraceStep {
  return {
    stepIndex,
    operationIndex: stepIndex,
    gateName,
    qubits,
    clbits: [],
    params: [],
    measurement: gateName === "measure",
    afterState,
  };
}

describe("stateSimilarity", () => {
  it("is 1 for identical states", () => {
    const a: [number, number][] = [
      [0.7071, 0],
      [0.7071, 0],
    ];
    expect(stateSimilarity(a, a)).toBeCloseTo(1, 10);
  });

  it("is 1 for global-phase twins", () => {
    const a: [number, number][] = [
      [0.7071, 0],
      [0.7071, 0],
    ];
    const b: [number, number][] = [
      [0, 0.7071],
      [0, 0.7071],
    ]; // both amplitudes multiplied by i
    expect(stateSimilarity(a, b)).toBeCloseTo(1, 6);
  });

  it("is below 1 when relative phase differs", () => {
    const a: [number, number][] = [
      [0.7071, 0],
      [0.7071, 0],
    ];
    const b: [number, number][] = [
      [0.7071, 0],
      [0, 0.7071],
    ]; // second amplitude rotated by 90°
    expect(stateSimilarity(a, b)).toBeLessThan(0.99);
  });

  it("is below 1 for different probability distributions", () => {
    const a: [number, number][] = [
      [1, 0],
      [0, 0],
    ];
    const b: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    expect(stateSimilarity(a, b)).toBeCloseTo(0, 6);
  });

  it("is 0 for zero vectors (defensive)", () => {
    const zero: [number, number][] = [
      [0, 0],
      [0, 0],
    ];
    const a: [number, number][] = [
      [1, 0],
      [0, 0],
    ];
    expect(stateSimilarity(zero, a)).toBe(0);
  });
});

describe("quantumDiff", () => {
  it("reports equivalent executions with no findings", () => {
    const a = outcome({
      statevectorPairs: [
        [0.7071, 0],
        [0, 0],
        [0, 0],
        [0.7071, 0],
      ],
      probabilities: { "00": 0.5, "11": 0.5 },
    });
    const b = outcome({
      statevectorPairs: [
        [0.7071, 0],
        [0, 0],
        [0, 0],
        [0.7071, 0],
      ],
      probabilities: { "00": 0.5, "11": 0.5 },
    });
    const diff = quantumDiff(a, b);
    expect(diff.equivalent).toBe(true);
    expect(diff.findings).toHaveLength(0);
  });

  it("treats global-phase twins as equivalent", () => {
    const a = outcome({
      statevectorPairs: [
        [0.7071, 0],
        [0, 0],
        [0, 0],
        [0.7071, 0],
      ],
    });
    const b = outcome({
      statevectorPairs: [
        [0, -0.7071],
        [0, 0],
        [0, 0],
        [0, -0.7071],
      ], // multiplied by -i
    });
    expect(quantumDiff(a, b).equivalent).toBe(true);
  });

  it("detects qubit-count divergence (STRUCTURE)", () => {
    const student = outcome({ circuit: circuit({ qubits: 3 }) });
    const reference = outcome({ circuit: circuit() });
    const diff = quantumDiff(student, reference);
    expect(diff.equivalent).toBe(false);
    const structure = diff.findings.find((f) => f.category === "STRUCTURE");
    expect(structure?.message).toContain("3 qubit(s)");
    expect(structure?.observed).toBe(3);
    expect(structure?.reference).toBe(2);
  });

  it("detects gate-count divergence (STRUCTURE)", () => {
    const student = outcome({
      circuit: circuit({ gateCounts: { h: 2, cx: 1 }, totalGates: 3 }),
    });
    const reference = outcome({
      circuit: circuit({ gateCounts: { h: 1, cx: 1 }, totalGates: 2 }),
    });
    const diff = quantumDiff(student, reference);
    const gateFinding = diff.findings.find(
      (f) => f.category === "STRUCTURE" && f.message.includes("h"),
    );
    expect(gateFinding?.observed).toBe(2);
    expect(gateFinding?.reference).toBe(1);
  });

  it("detects state divergence beyond global phase (STATE)", () => {
    const student = outcome({
      statevectorPairs: [
        [0.7071, 0],
        [0.7071, 0],
        [0, 0],
        [0, 0],
      ],
    });
    const reference = outcome({
      statevectorPairs: [
        [0.7071, 0],
        [0, 0],
        [0, 0],
        [0.7071, 0],
      ],
    });
    const diff = quantumDiff(student, reference);
    expect(diff.findings.some((f) => f.category === "STATE")).toBe(true);
  });

  it("detects exact-probability divergence (PROBABILITY)", () => {
    const student = outcome({
      probabilities: { "00": 0.9, "11": 0.1 },
    });
    const reference = outcome({
      probabilities: { "00": 0.5, "11": 0.5 },
    });
    const diff = quantumDiff(student, reference);
    const p = diff.findings.find((f) => f.category === "PROBABILITY");
    expect(p?.message).toContain("P(|11⟩)");
    expect(p?.observed).toBeCloseTo(0.1, 4);
    expect(p?.reference).toBeCloseTo(0.5, 4);
  });

  it("detects sampled-frequency divergence (MEASUREMENT)", () => {
    const student = outcome({
      counts: { "00": 950, "11": 50 },
      shots: 1000,
    });
    const reference = outcome({
      counts: { "00": 512, "11": 512 },
      shots: 1024,
    });
    const diff = quantumDiff(student, reference);
    expect(diff.findings.some((f) => f.category === "MEASUREMENT")).toBe(true);
  });

  it("tolerates sampling noise within tolerance (MEASUREMENT)", () => {
    const student = outcome({
      counts: { "00": 480, "11": 520 },
      shots: 1000,
    });
    const reference = outcome({
      counts: { "00": 512, "11": 512 },
      shots: 1024,
    });
    const diff = quantumDiff(student, reference);
    expect(diff.findings.some((f) => f.category === "MEASUREMENT")).toBe(false);
  });

  it("detects depth divergence (RESOURCE)", () => {
    const student = outcome({ circuit: circuit({ depth: 7 }) });
    const reference = outcome({ circuit: circuit({ depth: 3 }) });
    const diff = quantumDiff(student, reference);
    const resource = diff.findings.find((f) => f.category === "RESOURCE");
    expect(resource?.observed).toBe(7);
    expect(resource?.reference).toBe(3);
  });

  it("finds the first trace divergence step", () => {
    const studentState: [number, number][] = [
      [1, 0],
      [0, 0],
    ];
    const otherState: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const student = outcome({
      trace: {
        policy: { available: true, representation: "statevector", subsampled: false, stride: 1, reason: null },
        steps: [
          traceStep(0, "h", [0], studentState),
          traceStep(1, "x", [0], otherState), // diverges here
          traceStep(2, "measure", [0]),
        ],
      },
    });
    const reference = outcome({
      trace: {
        policy: { available: true, representation: "statevector", subsampled: false, stride: 1, reason: null },
        steps: [
          traceStep(0, "h", [0], studentState),
          traceStep(1, "measure", [0], studentState),
          traceStep(2, "measure", [0]),
        ],
      },
    });
    const diff = quantumDiff(student, reference);
    expect(diff.firstDivergenceStep).toBe(1);
    expect(diff.agreeingSteps).toBe(1);
  });

  it("reports agreement through the whole trace when equivalent", () => {
    const state: [number, number][] = [
      [0.7071, 0],
      [0.7071, 0],
    ];
    const steps = [
      traceStep(0, "h", [0], state),
      traceStep(1, "measure", [0]),
    ];
    const a = outcome({ trace: { policy: { available: true, representation: "statevector", subsampled: false, stride: 1, reason: null }, steps } });
    const b = outcome({ trace: { policy: { available: true, representation: "statevector", subsampled: false, stride: 1, reason: null }, steps } });
    const diff = quantumDiff(a, b);
    expect(diff.firstDivergenceStep).toBeNull();
    expect(diff.agreeingSteps).toBe(2);
  });

  it("handles missing outcomes factually", () => {
    const diff = quantumDiff(null, outcome());
    expect(diff.equivalent).toBe(false);
    expect(diff.findings[0].message).toContain("student execution did not produce");
  });

  it("never compares source code text", () => {
    // Same circuits, different provenance: diff only sees artifacts.
    const a = outcome();
    const b = outcome();
    expect(quantumDiff(a, b).equivalent).toBe(true);
  });
});

describe("localizeFailure", () => {
  const failingJudge: JudgeResult = {
    passed: false,
    summary: "1 of 2 checks failed.",
    checks: [
      {
        name: "STATE",
        description: "state",
        status: "PASS",
      },
      {
        name: "DISTRIBUTION",
        description: "distribution",
        status: "FAIL",
        message: "P(11) was 0.1, expected about 0.5.",
      },
    ],
    failures: [
      {
        name: "DISTRIBUTION",
        description: "distribution",
        status: "FAIL",
        message: "P(11) was 0.1, expected about 0.5.",
      },
    ],
  };

  it("returns null for passing or missing judge results", () => {
    expect(localizeFailure(null, outcome(), null)).toBeNull();
    const passed: JudgeResult = { ...failingJudge, passed: true, failures: [] };
    expect(localizeFailure(passed, outcome(), null)).toBeNull();
  });

  it("reports no trace when execution produced nothing", () => {
    const loc = localizeFailure(failingJudge, null, null);
    expect(loc?.observation).toContain("No quantum execution trace was produced.");
    expect(loc?.stepIndex).toBeNull();
    expect(loc?.evidence).toBe("none");
  });

  it("points to the first measurement step for measurement checks", () => {
    const student = outcome({
      trace: {
        policy: { available: true, representation: "statevector", subsampled: false, stride: 1, reason: null },
        steps: [
          traceStep(0, "h", [0]),
          traceStep(1, "cx", [0, 1]),
          traceStep(2, "measure", [0]),
          traceStep(3, "measure", [1]),
        ],
      },
    });
    const loc = localizeFailure(failingJudge, student, null);
    expect(loc?.stepIndex).toBe(2);
    expect(loc?.evidence).toBe("measurements");
    expect(loc?.observation).toContain("step 2");
  });

  it("uses diff evidence against a reference execution", () => {
    const divergedState: [number, number][] = [
      [1, 0],
      [0, 0],
    ];
    const bellState: [number, number][] = [
      [0.7071, 0],
      [0, 0],
      [0, 0],
      [0.7071, 0],
    ];
    const student = outcome({
      trace: {
        policy: { available: true, representation: "statevector", subsampled: false, stride: 1, reason: null },
        steps: [
          traceStep(0, "h", [0], bellState),
          traceStep(1, "x", [0], divergedState), // student diverges at step 1
        ],
      },
    });
    const reference = outcome({
      trace: {
        policy: { available: true, representation: "statevector", subsampled: false, stride: 1, reason: null },
        steps: [
          traceStep(0, "h", [0], bellState),
          traceStep(1, "cx", [0, 1], divergedState),
        ],
      },
    });
    const loc = localizeFailure(failingJudge, student, reference);
    expect(loc?.evidence).toBe("trace");
    expect(loc?.stepIndex).toBe(1);
    expect(loc?.observation).toContain("Failure observed after step 1");
  });

  it("falls back to the final state when only the end differs", () => {
    const stateA: [number, number][] = [
      [1, 0],
      [0, 0],
    ];
    const stateB: [number, number][] = [
      [0.7071, 0],
      [0.7071, 0],
    ];
    // No snapshots in the traces (subsampled away): operations agree, so
    // trace-level evidence is unavailable and only the final statevector
    // comparison catches the divergence.
    const student = outcome({
      statevectorPairs: stateA,
      trace: {
        policy: { available: true, representation: "statevector", subsampled: true, stride: 2, reason: null },
        steps: [traceStep(0, "z", [0])],
      },
    });
    const reference = outcome({
      statevectorPairs: stateB,
      trace: {
        policy: { available: true, representation: "statevector", subsampled: true, stride: 2, reason: null },
        steps: [traceStep(0, "z", [0])],
      },
    });
    const loc = localizeFailure(failingJudge, student, reference);
    expect(loc?.evidence).toBe("final-state");
    expect(loc?.observation).toContain("final state");
  });

  it("never claims a specific gate is the bug", () => {
    const student = outcome({
      trace: {
        policy: { available: true, representation: "statevector", subsampled: false, stride: 1, reason: null },
        steps: [traceStep(0, "h", [0])],
      },
    });
    const loc = localizeFailure(failingJudge, student, null);
    expect(loc?.observation).not.toMatch(/gate .* (is|was) (wrong|incorrect|the bug)/i);
  });
});
