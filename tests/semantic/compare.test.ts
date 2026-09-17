/**
 * Semantic comparison engine tests (Phase 6).
 *
 * Behavioral fixtures use real Qiskit execution artifacts produced by the
 * actual runtime (the same runner the sandbox uses) — no fabricated
 * quantum data. Runner-level tests live in tests/runtime; here the
 * pipeline is exercised end-to-end at the artifact level.
 */

import { describe, expect, it } from "vitest";
import {
  compareSemanticRecords,
  DEFAULT_COMPARISON_POLICY,
  EXACT_COMPARISON_POLICY,
  resolveComparisonPolicy,
  structuralDivergenceStep,
} from "@/lib/semantic/compare";
import { extractSemanticRecord } from "@/lib/semantic/record";
import type {
  SemanticRecord,
} from "@/lib/semantic/types";
import type { ScenarioOutcome } from "@/lib/exec/types";
import type { StoredArtifact } from "./helpers";
import {
  bellOutcome,
  bellOutcomeWithX,
  deepVariantOutcome,
  ryBellOutcome,
  zeroStateOutcome,
} from "./helpers";

// ========================================
// Record extraction from real artifacts
// ========================================

describe("extractSemanticRecord", () => {
  it("extracts a record from a Phase 6 wrapped artifact", () => {
    const artifact = {
      outcomes: { submission: bellOutcome() },
      environment: {
        python: "3.11.4",
        framework: { name: "qiskit", version: "1.2.4" },
        simulator: { name: "qiskit_aer", version: "0.15.1" },
        numpy: "2.1.3",
      },
    };
    const record = extractSemanticRecord({
      submissionId: "sub-1",
      userId: "user-1",
      problemId: "prob-1",
      sourceCode: "result = QuantumCircuit(2,2)\nresult.h(0)\nresult.cx(0,1)",
      artifact,
    });
    expect(record).not.toBeNull();
    expect(record!.schemaVersion).toBe("quantoo.semantic.v1");
    expect(record!.measurementFrequencies).not.toBeNull();
    expect(record!.probabilities).toBeNull();
    expect(record!.environment.framework.name).toBe("qiskit");
    expect(record!.environment.execution.shots).not.toBeNull();
  });

  it("reads legacy artifacts stored without the environment wrapper", () => {
    const record = extractSemanticRecord({
      submissionId: "sub-1",
      userId: "user-1",
      problemId: "prob-1",
      sourceCode: null,
      artifact: { outcomes: { submission: zeroStateOutcome() } },
    });
    expect(record).not.toBeNull();
    expect(record!.probabilities).not.toBeNull();
    expect(record!.environment.python).toBeNull();
  });

  it("returns null for failed or malformed artifacts instead of guessing", () => {
    expect(
      extractSemanticRecord({
        submissionId: "s",
        userId: "u",
        problemId: "p",
        sourceCode: null,
        artifact: null,
      }),
    ).toBeNull();
    expect(
      extractSemanticRecord({
        submissionId: "s",
        userId: "u",
        problemId: "p",
        sourceCode: null,
        artifact: { outcomes: { submission: { wrong: "shape" } } },
      }),
    ).toBeNull();
  });

  it("falls back to unknown environment fields defensively", () => {
    const record = extractSemanticRecord({
      submissionId: "s",
      userId: "u",
      problemId: "p",
      sourceCode: null,
      artifact: {
        outcomes: { submission: bellOutcome() },
        environment: { framework: { name: "qiskit" }, numpy: 42 },
      },
    });
    expect(record!.environment.framework.version).toBeNull();
    expect(record!.environment.dependencies.numpy).toBeNull();
  });
});

// ========================================
// Scenario A — equivalent behavior, different structure
// ========================================

describe("scenario A: equivalent behavior", () => {
  // Same Bell behavior, same resource profile, different gate vocabulary
  // (Ry(pi/2) decomposition vs H): structurally different, behaviorally
  // equivalent.
  const a = recordFrom(bellOutcome(), "A");
  const b = recordFrom(ryBellOutcome(), "B");

  it("is behaviorally equivalent", () => {
    const cmp = compareSemanticRecords(a, b, DEFAULT_COMPARISON_POLICY);
    expect(cmp.overallStatus).toBe("BEHAVIORALLY_EQUIVALENT");
    expect(cmp.structural?.status).toBe("DIFFERENT");
    expect(cmp.measurement?.status).toBe("PASS");
  });

  it("distinguishes structural from behavioral identity", () => {
    const cmp = compareSemanticRecords(a, b, DEFAULT_COMPARISON_POLICY);
    expect(cmp.overallStatus).not.toBe("EQUIVALENT");
  });

  it("does not compare source text", () => {
    // The source fingerprints differ (different programs, same behavior):
    // textual identity is never the comparison basis.
    const aRec = recordFrom(bellOutcome(), "A", "result = QuantumCircuit(2,2)\nresult.h(0)\nresult.cx(0,1)\nresult.measure([0,1],[0,1])");
    const bRec = recordFrom(ryBellOutcome(), "B", "from qiskit import QuantumCircuit\nimport math\nresult = QuantumCircuit(2,2)\nresult.ry(math.pi/2,0)\nresult.cx(0,1)");
    expect(aRec.sourceFingerprint).not.toBe(bRec.sourceFingerprint);
    const cmp = compareSemanticRecords(aRec, bRec, DEFAULT_COMPARISON_POLICY);
    expect(cmp.overallStatus).toBe("BEHAVIORALLY_EQUIVALENT");
  });
});

// ========================================
// Scenario B — real behavioral difference
// ========================================

describe("scenario B: behavioral difference", () => {
  const a = recordFrom(bellOutcome(), "A");
  const b = recordFrom(bellOutcomeWithX(), "B");

  it("detects the difference with evidence", () => {
    const cmp = compareSemanticRecords(a, b, DEFAULT_COMPARISON_POLICY);
    expect(cmp.overallStatus).toBe("DIFFERENT");
    expect(cmp.measurement?.status).toBe("DIFFERENT");
    expect(cmp.measurement?.metric).toBe("hellinger");
    expect(cmp.measurement?.threshold).toBe(0.05);
  });

  it("localizes the first structural divergence", () => {
    // Step 0 (H vs X) is already divergent.
    expect(structuralDivergenceStep(a, b)).toBe(0);
  });

  it("is also caught by the exact policy", () => {
    const cmp = compareSemanticRecords(a, b, EXACT_COMPARISON_POLICY);
    expect(cmp.overallStatus).toBe("DIFFERENT");
  });
});

// ========================================
// Scenario C — resource-only regression
// ========================================

describe("scenario C: resource regression", () => {
  it("classifies growth as a warning, not a correctness failure", () => {
    // Behaviorally identical circuits, B carries +2 cancelling gates.
    const a = recordFrom(bellOutcome(), "A");
    const b = recordFrom(deepVariantOutcome(), "B");
    const cmp = compareSemanticRecords(a, b, DEFAULT_COMPARISON_POLICY);
    expect(cmp.resource?.status).toBe("WARNING");
    expect(cmp.overallStatus).toBe("RESOURCE_REGRESSION");
    expect(cmp.resource?.message).toContain("not a correctness difference");
  });
});

// ========================================
// Scenario D — environment difference
// ========================================

describe("scenario D: environment difference", () => {
  it("reports environment separately from behavior", () => {
    const a = recordFrom(bellOutcome(), "A");
    const bRecord = structuredClone(recordFrom(bellOutcome(), "B")) as SemanticRecord;
    bRecord.environment = {
      ...bRecord.environment,
      framework: { name: "qiskit", version: "9.9.9" },
    };
    const cmp = compareSemanticRecords(a, bRecord, DEFAULT_COMPARISON_POLICY);
    expect(cmp.environment?.status).toBe("WARNING");
    expect(cmp.environment?.message).toContain("qiskit");
    // Behavior compared on its own dimension.
    expect(cmp.measurement?.status).toBe("PASS");
  });

  it("treats different shot counts as an environment difference", () => {
    const a = recordFrom(bellOutcome(), "A");
    const bRecord = structuredClone(recordFrom(bellOutcome(), "B")) as SemanticRecord;
    bRecord.environment = {
      ...bRecord.environment,
      execution: { ...bRecord.environment.execution, shots: 128 },
    };
    const cmp = compareSemanticRecords(a, bRecord);
    expect(cmp.environment?.status).toBe("WARNING");
    expect(cmp.environment?.message).toContain("Shots");
  });
});

// ========================================
// Global phase and equivalence classes
// ========================================

describe("global phase", () => {
  it("does not treat global-phase-only differences as behavioral", () => {
    // Rotationally identical states: identical magnitudes, phases shifted.
    const a = stateRecord([
      [0.6, 0.0],
      [0.0, 0.8],
    ]);
    const b = stateRecord([
      [-0.6, 0.0],
      [0.0, -0.8],
    ]);
    const cmp = compareSemanticRecords(a, b, DEFAULT_COMPARISON_POLICY);
    expect(cmp.state?.status).toBe("PASS");
  });

  it("still detects relative-phase differences", () => {
    const a = stateRecord([
      [0.6, 0.0],
      [0.0, 0.8],
    ]);
    const b = stateRecord([
      [0.6, 0.0],
      [0.0, -0.8],
    ]);
    const cmp = compareSemanticRecords(a, b, DEFAULT_COMPARISON_POLICY);
    expect(cmp.state?.status).toBe("DIFFERENT");
  });
});

// ========================================
// Policies and insufficient evidence
// ========================================

describe("policies", () => {
  it("resolves known policies and falls back for unknown ones", () => {
    expect(resolveComparisonPolicy("exact").name).toBe("exact");
    expect(resolveComparisonPolicy("statistical-default").name).toBe(
      "statistical-default",
    );
    expect(resolveComparisonPolicy("nonsense").name).toBe("statistical-default");
  });

  it("marks dimensions NOT_COMPARED when a policy excludes them", () => {
    const a = recordFrom(bellOutcome(), "A");
    const b = recordFrom(bellOutcome(), "B");
    const cmp = compareSemanticRecords(a, b, {
      ...DEFAULT_COMPARISON_POLICY,
      compareResource: false,
      compareEnvironment: false,
    });
    expect(cmp.resource?.status).toBe("NOT_COMPARED");
    expect(cmp.environment?.status).toBe("NOT_COMPARED");
  });

  it("returns INSUFFICIENT_EVIDENCE when no behavioral data exists", () => {
    const bare = (id: string): SemanticRecord => ({
      schemaVersion: "quantoo.semantic.v1",
      semanticRecordId: `sem_${id}`,
      submissionId: id,
      userId: "u",
      problemId: "p",
      sourceFingerprint: null,
      circuit: {
        qubits: 2,
        clbits: 2,
        depth: 2,
        operations: null,
        gateHistogram: { h: 1, cx: 1 },
        totalOperations: 2,
      },
      fingerprint: {
        structural: "x",
        operational: null,
        probability: null,
        measurement: null,
        resource: "x",
        environment: "x",
        combined: "x",
      },
      probabilities: null,
      measurementFrequencies: null,
      shots: null,
      seed: null,
      statevector: null,
      scenarioNames: ["submission"],
      environment: {
        python: null,
        framework: { name: "unknown", version: null },
        simulator: { name: "unknown", version: null },
        dependencies: {},
        execution: { shots: null, seed: null, optimization: null },
      },
      capturedAt: new Date().toISOString(),
    });
    const cmp = compareSemanticRecords(bare("a"), bare("b"));
    expect(cmp.overallStatus).toBe("STRUCTURALLY_EQUIVALENT");
  });

  it("flags low-shot statistical comparisons as weak evidence", () => {
    const a = recordFrom(bellOutcome(64), "A");
    const b = recordFrom(bellOutcome(64), "B");
    const cmp = compareSemanticRecords(a, b, DEFAULT_COMPARISON_POLICY);
    expect(
      cmp.limitations.some((l) => l.includes("fewer than 1024 shots")),
    ).toBe(true);
  });
});

// ========================================
// Test helpers
// ========================================

function recordFrom(
  outcome: ScenarioOutcome,
  id: string,
  sourceCode: string | null = null,
): SemanticRecord {
  const artifact: StoredArtifact = {
    outcomes: { submission: outcome },
    environment: {
      python: "3.11.4",
      framework: { name: "qiskit", version: "1.2.4" },
      simulator: { name: "qiskit_aer", version: "0.15.1" },
      numpy: "2.1.3",
    },
  };
  const record = extractSemanticRecord({
    submissionId: id,
    userId: "u",
    problemId: "p",
    sourceCode,
    artifact,
  });
  if (!record) throw new Error("fixture failed to produce a record");
  return record;
}

function stateRecord(pairs: [number, number][]): SemanticRecord {
  const record = recordFrom(bellOutcome(), "s");
  return { ...record, statevector: { pairs, globalPhase: 0 } };
}
