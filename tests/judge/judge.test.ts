/**
 * Quantum Judge unit tests.
 *
 * The judge must be deterministic, tolerant of malformed specs, invariant
 * under global phase, sensitive to relative phase, and never judge client
 * data. These tests exercise each check type against real ScenarioOutcome
 * shapes produced by the quantum runtime.
 */

import { describe, it, expect } from "vitest";
import { judgeSubmission, type TestSpec } from "@/lib/judge";
import type { ScenarioOutcome } from "@/lib/exec/types";

function stateOutcome(
  pairs: [number, number][],
  qubits = 1,
): ScenarioOutcome {
  return {
    scenario: "submission",
    circuit: {
      qubits,
      clbits: 0,
      depth: 1,
      gateCounts: { h: 1 },
      totalGates: 1,
    },
    statevectorPairs: pairs,
  };
}

function measuredOutcome(
  counts: Record<string, number>,
  shots: number,
  qubits = 2,
): ScenarioOutcome {
  return {
    scenario: "submission",
    circuit: {
      qubits,
      clbits: qubits,
      depth: 3,
      gateCounts: { h: 1, cx: 1, measure: qubits },
      totalGates: 2 + qubits,
    },
    counts,
    shots,
  };
}

describe("judgeSubmission", () => {
  describe("STATE checks", () => {
    const stateSpec: TestSpec = {
      type: "STATE",
      description: "Verify superposition state",
      expected: { statevector: [0.707, 0.707], tolerance: 0.05 },
    };

    it("passes for the exact expected state", () => {
      const result = judgeSubmission([stateSpec], {
        submission: stateOutcome([
          [0.707, 0],
          [0.707, 0],
        ]),
      });
      expect(result.passed).toBe(true);
      expect(result.checks[0].status).toBe("PASS");
    });

    it("passes up to a global phase", () => {
      // Multiplying BOTH amplitudes by i is a global phase (e^{i pi/2}):
      // physically identical to the expected state.
      const result = judgeSubmission([stateSpec], {
        submission: stateOutcome([
          [0, 0.707],
          [0, 0.707],
        ]),
      });
      expect(result.passed).toBe(true);
    });

    it("fails when relative phase differs", () => {
      // |0> vs |1> relative sign flip produces an orthogonal state.
      const result = judgeSubmission([stateSpec], {
        submission: stateOutcome([
          [0.707, 0],
          [-0.707, 0],
        ]),
      });
      expect(result.passed).toBe(false);
      expect(result.checks[0].status).toBe("FAIL");
    });

    it("fails when amplitudes differ", () => {
      const result = judgeSubmission([stateSpec], {
        submission: stateOutcome([
          [1, 0],
          [0, 0],
        ]),
      });
      expect(result.passed).toBe(false);
    });

    it("fails with an explanatory message when the circuit was measured", () => {
      const result = judgeSubmission([stateSpec], {
        submission: measuredOutcome({ "0": 500, "1": 500 }, 1000, 1),
      });
      expect(result.passed).toBe(false);
      // No trace snapshots either: the state simply was not produced.
      expect(result.checks[0].message).toContain("was not produced");
    });

    it("evaluates the pre-measurement state from trace snapshots", () => {
      // H on |0>: (|0> + |1>)/sqrt(2), then measured. The exact
      // pre-measurement state comes from the runtime trace snapshot.
      const measuredWithTrace = measuredOutcome(
        { "0": 512, "1": 488 },
        1000,
        1,
      );
      measuredWithTrace.trace = {
        policy: {
          available: true,
          representation: "statevector",
          subsampled: false,
          stride: 1,
          reason: null,
        },
        steps: [
          {
            stepIndex: 0,
            operationIndex: 0,
            gateName: "h",
            qubits: [0],
            clbits: [],
            params: [],
            measurement: false,
            afterState: [
              [Math.SQRT1_2, 0],
              [Math.SQRT1_2, 0],
            ],
          },
          {
            stepIndex: 1,
            operationIndex: 1,
            gateName: "measure",
            qubits: [0],
            clbits: [0],
            params: [],
            measurement: true,
            afterState: [
              [Math.SQRT1_2, 0],
              [Math.SQRT1_2, 0],
            ],
          },
        ],
      };
      const result = judgeSubmission([stateSpec], { submission: measuredWithTrace });
      expect(result.checks[0].status).toBe("PASS");
    });

    it("fails when the amplitude count mismatches", () => {
      const result = judgeSubmission([stateSpec], {
        submission: stateOutcome(
          [
            [0.5, 0],
            [0.5, 0],
            [0.5, 0],
            [0.5, 0],
          ],
          2,
        ),
      });
      expect(result.passed).toBe(false);
    });

    it("skips a misconfigured spec instead of failing everything", () => {
      const result = judgeSubmission(
        [{ type: "STATE", description: "broken", expected: {} }],
        { submission: stateOutcome([[1, 0], [0, 0]]) },
      );
      expect(result.checks[0].status).toBe("SKIPPED");
    });
  });

  describe("DISTRIBUTION checks", () => {
    const bellSpec: TestSpec = {
      type: "DISTRIBUTION",
      description: "Bell state distribution",
      expected: {
        distribution: { "00": 0.5, "11": 0.5 },
        tolerance: 0.1,
      },
    };

    it("passes for a matching distribution", () => {
      const result = judgeSubmission([bellSpec], {
        submission: measuredOutcome({ "00": 498, "11": 502 }, 1000),
      });
      expect(result.passed).toBe(true);
    });

    it("fails outside tolerance", () => {
      const result = judgeSubmission([bellSpec], {
        submission: measuredOutcome({ "00": 900, "11": 100 }, 1000),
      });
      expect(result.passed).toBe(false);
      expect(result.checks[0].message).toContain("P(00)");
    });

    it("evaluates scenario-based specs against the named scenario", () => {
      const spec: TestSpec = {
        type: "DISTRIBUTION",
        description: "Measuring |0> always yields 0",
        expected: { input: "zero_state", distribution: { "0": 1.0 }, tolerance: 0.0 },
      };
      const outcomes = {
        submission: measuredOutcome({ "0": 1000 }, 1000, 1),
        zero_state: measuredOutcome({ "0": 1000 }, 1000, 1),
      };
      const result = judgeSubmission([spec], outcomes);
      expect(result.passed).toBe(true);
    });

    it("fails when the scenario required by the spec did not run", () => {
      const spec: TestSpec = {
        type: "DISTRIBUTION",
        description: "Scenario check",
        expected: { input: "superposition", distribution: { "0": 0.5, "1": 0.5 } },
      };
      const result = judgeSubmission([spec], {
        submission: measuredOutcome({ "0": 1000 }, 1000, 1),
      });
      expect(result.passed).toBe(false);
      expect(result.checks[0].message).toContain("scenario");
    });

    it("requires measurements", () => {
      const result = judgeSubmission([bellSpec], {
        submission: stateOutcome(
          [
            [0.707, 0],
            [0, 0],
            [0, 0],
            [0.707, 0],
          ],
          2,
        ),
      });
      expect(result.passed).toBe(false);
    });

    it("skips a misconfigured distribution", () => {
      const result = judgeSubmission(
        [{ type: "DISTRIBUTION", description: "broken", expected: { distribution: "nope" } }],
        { submission: measuredOutcome({ "00": 500, "11": 500 }, 1000) },
      );
      expect(result.checks[0].status).toBe("SKIPPED");
    });
  });

  describe("STRUCTURAL checks", () => {
    it("passes for matching qubit count and gates", () => {
      const spec: TestSpec = {
        type: "STRUCTURAL",
        description: "Bell structure",
        expected: { qubits: 2, gates: ["h", "cx"] },
      };
      const result = judgeSubmission([spec], {
        submission: measuredOutcome({ "00": 500, "11": 500 }, 1000),
      });
      expect(result.passed).toBe(true);
    });

    it("fails on wrong qubit count", () => {
      const spec: TestSpec = {
        type: "STRUCTURAL",
        description: "Two qubits required",
        expected: { qubits: 2 },
      };
      const result = judgeSubmission([spec], {
        submission: measuredOutcome({ "0": 1000 }, 1000, 1),
      });
      expect(result.passed).toBe(false);
      expect(result.checks[0].message).toContain("1 qubit");
    });

    it("fails on a missing required gate", () => {
      const spec: TestSpec = {
        type: "STRUCTURAL",
        description: "Must use H",
        expected: { gates: ["h"] },
      };
      const outcome = measuredOutcome({ "0": 1000 }, 1000, 1);
      outcome.circuit.gateCounts = { x: 1, measure: 1 };
      const result = judgeSubmission([spec], { submission: outcome });
      expect(result.passed).toBe(false);
      expect(result.checks[0].message).toContain("h gate");
    });
  });

  describe("ENTANGLEMENT checks", () => {
    const entSpec: TestSpec = {
      type: "ENTANGLEMENT",
      description: "Qubits must be entangled",
      expected: { correlation: 1.0 },
    };

    it("passes for a Bell state", () => {
      const result = judgeSubmission([entSpec], {
        submission: measuredOutcome({ "00": 498, "11": 502 }, 1000),
      });
      expect(result.passed).toBe(true);
    });

    it("fails when outcomes disagree", () => {
      const result = judgeSubmission([entSpec], {
        submission: measuredOutcome({ "00": 250, "01": 250, "10": 250, "11": 250 }, 1000),
      });
      expect(result.passed).toBe(false);
      expect(result.checks[0].message).toContain("50.0%");
    });

    it("requires measurements", () => {
      const result = judgeSubmission([entSpec], {
        submission: stateOutcome(
          [
            [0.707, 0],
            [0, 0],
            [0, 0],
            [0.707, 0],
          ],
          2,
        ),
      });
      expect(result.passed).toBe(false);
    });
  });

  describe("overall behavior", () => {
    it("fails when the submission did not run", () => {
      const spec: TestSpec = {
        type: "STRUCTURAL",
        description: "One qubit",
        expected: { qubits: 1 },
      };
      const result = judgeSubmission([spec], {});
      expect(result.passed).toBe(false);
      expect(result.checks[0].message).toContain("did not run");
    });

    it("reports unsupported spec types as SKIPPED without failing the run", () => {
      const specs: TestSpec[] = [
        { type: "UNITARY", description: "Future check", expected: {} },
        {
          type: "STRUCTURAL",
          description: "One qubit",
          expected: { qubits: 1 },
        },
      ];
      const result = judgeSubmission(specs, {
        submission: measuredOutcome({ "0": 1000 }, 1000, 1),
      });
      expect(result.checks[0].status).toBe("SKIPPED");
      expect(result.passed).toBe(true);
      expect(result.summary).toContain("1 check");
    });

    it("produces structured failures", () => {
      const specs: TestSpec[] = [
        { type: "STRUCTURAL", description: "Two qubits", expected: { qubits: 2 } },
      ];
      const result = judgeSubmission(specs, {
        submission: measuredOutcome({ "0": 1000 }, 1000, 1),
      });
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].name).toBe("STRUCTURAL");
    });
  });
});
