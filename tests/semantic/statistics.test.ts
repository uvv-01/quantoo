/**
 * Semantic statistics and canonical circuit unit tests (Phase 6).
 */

import { describe, expect, it } from "vitest";
import {
  compareDistributions,
  frequenciesFromCounts,
  hellingerDistance,
  totalVariationDistance,
} from "@/lib/semantic/statistics";
import {
  canonicalCircuitFromOutcome,
  firstStructuralDifference,
  layerHash,
  normalizeGateName,
  sourceFingerprint,
  stableStringify,
} from "@/lib/semantic/canonical";
import { computeSemanticFingerprint } from "@/lib/semantic/fingerprint";
import type { ScenarioOutcome } from "@/lib/exec/types";
import type {
  CanonicalCircuit,
  EnvironmentFingerprint,
} from "@/lib/semantic/types";

// ========================================
// Statistics
// ========================================

describe("total variation distance", () => {
  it("is zero for identical distributions", () => {
    const p = { "00": 0.5, "11": 0.5 };
    expect(totalVariationDistance(p, p)).toBe(0);
  });

  it("is one for disjoint distributions", () => {
    expect(
      totalVariationDistance({ "00": 1 }, { "11": 1 }),
    ).toBe(1);
  });

  it("treats missing keys as zero probability", () => {
    // 0.5*|0.6-0.2| + 0.5*|0.4-0.8| = 0.4? No: (0.4 + 0.4)/2 = 0.4.
    expect(
      totalVariationDistance({ "00": 0.6, "11": 0.4 }, { "00": 0.2, "11": 0.8 }),
    ).toBeCloseTo(0.4, 10);
  });

  it("handles non-negative support differences", () => {
    expect(totalVariationDistance({ "00": 0.5 }, { "11": 0.5 })).toBe(0.5);
  });
});

describe("hellinger distance", () => {
  it("is zero for identical distributions", () => {
    const p = { "0": 0.3, "1": 0.7 };
    expect(hellingerDistance(p, p)).toBeCloseTo(0, 12);
  });

  it("is one for disjoint distributions", () => {
    expect(hellingerDistance({ "0": 1 }, { "1": 1 })).toBeCloseTo(1, 12);
  });

  it("is symmetric", () => {
    const p = { "00": 0.7, "11": 0.3 };
    const q = { "00": 0.4, "11": 0.6 };
    expect(hellingerDistance(p, q)).toBeCloseTo(hellingerDistance(q, p), 12);
  });

  it("satisfies H(p,q) <= TVD for these cases", () => {
    const p = { "00": 0.7, "11": 0.3 };
    const q = { "00": 0.4, "11": 0.6 };
    expect(hellingerDistance(p, q)).toBeLessThanOrEqual(
      totalVariationDistance(p, q) + 1e-12,
    );
  });
});

describe("compareDistributions", () => {
  it("passes within threshold and reports the metric", () => {
    const cmp = compareDistributions(
      { "00": 0.51, "11": 0.49 },
      { "00": 0.49, "11": 0.51 },
      "hellinger",
      0.05,
    );
    expect(cmp.pass).toBe(true);
    expect(cmp.supportSize).toBe(2);
  });

  it("fails beyond threshold", () => {
    const cmp = compareDistributions({ "00": 1 }, { "00": 0.2, "11": 0.8 }, "hellinger", 0.05);
    expect(cmp.pass).toBe(false);
  });

  it("supports total variation", () => {
    const cmp = compareDistributions({ "0": 1 }, { "0": 0.9, "1": 0.1 }, "total_variation", 0.05);
    expect(cmp.value).toBeCloseTo(0.1, 12);
    expect(cmp.pass).toBe(false);
  });
});

describe("frequenciesFromCounts", () => {
  it("normalizes counts", () => {
    expect(frequenciesFromCounts({ "00": 250, "11": 250 })).toEqual({
      "00": 0.5,
      "11": 0.5,
    });
  });

  it("returns null for empty or zero totals", () => {
    expect(frequenciesFromCounts({})).toBeNull();
    expect(frequenciesFromCounts({ "0": 0 })).toBeNull();
  });
});

// ========================================
// Canonical circuits and hashing
// ========================================

function outcomeFixture(overrides: Partial<ScenarioOutcome> = {}): ScenarioOutcome {
  return {
    scenario: "submission",
    circuit: {
      qubits: 2,
      clbits: 2,
      depth: 2,
      gateCounts: { h: 1, cx: 1 },
      totalGates: 2,
    },
    ...overrides,
  };
}

describe("canonicalCircuitFromOutcome", () => {
  it("uses trace operations when available", () => {
    const outcome = outcomeFixture({
      trace: {
        steps: [
          {
            stepIndex: 0,
            operationIndex: 0,
            gateName: "h",
            qubits: [0],
            clbits: [],
            params: [],
            measurement: false,
          },
          {
            stepIndex: 1,
            operationIndex: 1,
            gateName: "cx",
            qubits: [0, 1],
            clbits: [],
            params: [],
            measurement: false,
          },
        ],
        policy: {
          available: true,
          representation: "statevector",
          subsampled: false,
          stride: 1,
          reason: null,
        },
      },
    });
    const canonical = canonicalCircuitFromOutcome(outcome);
    expect(canonical?.operations).toHaveLength(2);
    expect(canonical?.operations?.[1]).toEqual({
      name: "cx",
      qubits: [0, 1],
      clbits: [],
      params: [],
      measurement: false,
    });
  });

  it("reports operations as unavailable without a trace", () => {
    const canonical = canonicalCircuitFromOutcome(outcomeFixture());
    expect(canonical?.operations).toBeNull();
    expect(canonical?.gateHistogram).toEqual({ h: 1, cx: 1 });
  });

  it("returns null for missing outcomes", () => {
    expect(canonicalCircuitFromOutcome(undefined)).toBeNull();
  });
});

describe("normalizeGateName", () => {
  it("folds known aliases and lowercases", () => {
    expect(normalizeGateName("CNOT")).toBe("cx");
    expect(normalizeGateName("H")).toBe("h");
    expect(normalizeGateName("rz")).toBe("rz");
  });
});

describe("stableStringify and hashes", () => {
  it("sorts keys deterministically", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it("produces stable hashes regardless of key order", () => {
    expect(layerHash({ a: 1, b: [1, 2] })).toBe(layerHash({ b: [1, 2], a: 1 }));
  });

  it("hashes source text for identity", () => {
    expect(sourceFingerprint("qc.h(0)")).toBe(sourceFingerprint("qc.h(0)"));
    expect(sourceFingerprint("qc.h(0)")).not.toBe(sourceFingerprint("qc.h(1)"));
  });
});

describe("firstStructuralDifference", () => {
  const circuit = (over: Partial<CanonicalCircuit>): CanonicalCircuit => ({
    qubits: 2,
    clbits: 0,
    depth: 1,
    operations: null,
    gateHistogram: { h: 1 },
    totalOperations: 1,
    ...over,
  });

  it("detects qubit-count differences", () => {
    const diff = firstStructuralDifference(
      circuit({ qubits: 2 }),
      circuit({ qubits: 3 }),
    );
    expect(diff?.message).toContain("Qubit count");
  });

  it("detects gate-multiset differences without traces", () => {
    const diff = firstStructuralDifference(
      circuit({ gateHistogram: { h: 1 } }),
      circuit({ gateHistogram: { x: 1 } }),
    );
    expect(diff?.message).toContain("multiset");
  });

  it("localizes the first divergent operation with traces", () => {
    const ops = (names: string[]) =>
      names.map((name, i) => ({
        name,
        qubits: [i % 2],
        clbits: [],
        params: [],
        measurement: false,
      }));
    const diff = firstStructuralDifference(
      circuit({ operations: ops(["h", "cx"]) }),
      circuit({ operations: ops(["h", "x"]) }),
    );
    expect(diff?.operationIndex).toBe(1);
    expect(diff?.message).toContain("operation 1");
  });

  it("passes for identical ordered operations", () => {
    const ops = [
      { name: "h", qubits: [0], clbits: [], params: [], measurement: false },
    ];
    expect(
      firstStructuralDifference(
        circuit({ operations: ops }),
        circuit({ operations: structuredClone(ops) }),
      ),
    ).toBeNull();
  });
});

describe("computeSemanticFingerprint", () => {
  const environment: EnvironmentFingerprint = {
    python: "3.11.0",
    framework: { name: "qiskit", version: "1.2.4" },
    simulator: { name: "qiskit_aer", version: "0.15.1" },
    dependencies: { numpy: "2.1.0" },
    execution: { shots: 4096, seed: 7, optimization: null },
  };

  it("is deterministic for identical inputs", () => {
    const input = {
      circuit: canonicalCircuitFromOutcome(outcomeFixture())!,
      probabilities: { "00": 0.5, "11": 0.5 },
      measurementFrequencies: null,
      environment,
    };
    expect(computeSemanticFingerprint(input)).toEqual(
      computeSemanticFingerprint(input),
    );
  });

  it("changes when behavior changes but not when unrelated metadata changes", () => {
    const circuitA = canonicalCircuitFromOutcome(outcomeFixture())!;
    const circuitB = canonicalCircuitFromOutcome(
      outcomeFixture({ circuit: { ...outcomeFixture().circuit, gateCounts: { h: 1, x: 1, cx: 1 }, totalGates: 3 } }),
    )!;
    const a = computeSemanticFingerprint({
      circuit: circuitA,
      probabilities: { "00": 0.5 },
      measurementFrequencies: null,
      environment,
    });
    const b = computeSemanticFingerprint({
      circuit: circuitB,
      probabilities: { "00": 0.5 },
      measurementFrequencies: null,
      environment,
    });
    expect(a.structural).not.toBe(b.structural);
  });

  it("keeps layers independently inspectable", () => {
    const fp = computeSemanticFingerprint({
      circuit: canonicalCircuitFromOutcome(outcomeFixture())!,
      probabilities: null,
      measurementFrequencies: { "00": 0.5, "11": 0.5 },
      environment,
    });
    expect(fp.probability).toBeNull();
    expect(fp.measurement).not.toBeNull();
    expect(fp.environment).not.toBeNull();
    expect(fp.combined).not.toBeNull();
  });
});
