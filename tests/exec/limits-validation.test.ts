/**
 * Execution limits and validation tests.
 *
 * Configuration must be clamped to safe bounds, and the run request schema
 * must reject malformed or oversized input before it reaches the sandbox.
 */

import { describe, it, expect, afterEach } from "vitest";
import { getExecutionLimits, LIMIT_CEILINGS, LIMIT_FLOORS } from "@/lib/exec/limits";
import { runRequestSchema, saveDraftSchema } from "@/lib/exec/validation";
import {
  parseTestSpecification,
  requiredScenarios,
} from "@/lib/exec/service";

describe("getExecutionLimits", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns safe defaults without configuration", () => {
    const limits = getExecutionLimits();
    expect(limits.maxQubits).toBe(8);
    expect(limits.maxShots).toBe(4_096);
    expect(limits.maxRuntimeMs).toBeGreaterThanOrEqual(LIMIT_FLOORS.maxRuntimeMs);
  });

  it("clamps configuration above the ceiling", () => {
    process.env.EXEC_MAX_QUBITS = "40";
    process.env.EXEC_MAX_SHOTS = "9999999";
    const limits = getExecutionLimits();
    expect(limits.maxQubits).toBe(LIMIT_CEILINGS.maxQubits);
    expect(limits.maxShots).toBe(LIMIT_CEILINGS.maxShots);
  });

  it("clamps configuration below the floor", () => {
    process.env.EXEC_MAX_QUBITS = "0";
    process.env.EXEC_TIMEOUT_MS = "10";
    const limits = getExecutionLimits();
    expect(limits.maxQubits).toBe(LIMIT_FLOORS.maxQubits);
    expect(limits.maxRuntimeMs).toBe(LIMIT_FLOORS.maxRuntimeMs);
  });

  it("ignores non-numeric configuration", () => {
    process.env.EXEC_MAX_QUBITS = "not-a-number";
    const limits = getExecutionLimits();
    expect(limits.maxQubits).toBe(8);
  });
});

describe("runRequestSchema", () => {
  const validRequest = {
    problemSlug: "bell-state",
    sourceCode: "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2)",
  };

  it("accepts a valid request", () => {
    const parsed = runRequestSchema.safeParse(validRequest);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.language).toBe("python");
      expect(parsed.data.shots).toBe(4_096);
    }
  });

  it("rejects empty source code", () => {
    const parsed = runRequestSchema.safeParse({ ...validRequest, sourceCode: "" });
    expect(parsed.success).toBe(false);
  });

  it("rejects oversized source code", () => {
    const parsed = runRequestSchema.safeParse({
      ...validRequest,
      sourceCode: "x = 1\n" + "# " + "a".repeat(60_000),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid slugs", () => {
    for (const slug of ["../etc/passwd", "Bell State", "bell_state!", ""]) {
      const parsed = runRequestSchema.safeParse({ ...validRequest, problemSlug: slug });
      expect(parsed.success).toBe(false);
    }
  });

  it("rejects out-of-range shots", () => {
    const parsed = runRequestSchema.safeParse({ ...validRequest, shots: 100_000 });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-python languages", () => {
    const parsed = runRequestSchema.safeParse({ ...validRequest, language: "javascript" });
    expect(parsed.success).toBe(false);
  });
});

describe("saveDraftSchema", () => {
  it("accepts a valid draft", () => {
    const parsed = saveDraftSchema.safeParse({
      problemSlug: "bell-state",
      sourceCode: "qc = 1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects injection-style slugs", () => {
    const parsed = saveDraftSchema.safeParse({
      problemSlug: "bell-state?userId=other",
      sourceCode: "qc = 1",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("parseTestSpecification", () => {
  it("parses a valid spec array", () => {
    const raw = JSON.stringify([
      { type: "STATE", description: "d", expected: { statevector: [1, 0] } },
      { type: "DISTRIBUTION", description: "d2", expected: { distribution: { "00": 0.5 } } },
    ]);
    const specs = parseTestSpecification(raw);
    expect(specs).toHaveLength(2);
    expect(specs[0].type).toBe("STATE");
  });

  it("returns an empty array for null or malformed data", () => {
    expect(parseTestSpecification(null)).toEqual([]);
    expect(parseTestSpecification("not json")).toEqual([]);
    expect(parseTestSpecification(JSON.stringify({ not: "an array" }))).toEqual([]);
    expect(parseTestSpecification(JSON.stringify([42, "x", null]))).toEqual([]);
  });
});

describe("requiredScenarios", () => {
  it("always includes the submission scenario", () => {
    expect(requiredScenarios([])).toEqual(["submission"]);
  });

  it("collects scenario inputs from distribution specs", () => {
    const specs = parseTestSpecification(
      JSON.stringify([
        { type: "DISTRIBUTION", description: "a", expected: { input: "zero_state", distribution: { "0": 1 } } },
        { type: "DISTRIBUTION", description: "b", expected: { input: "superposition", distribution: { "0": 0.5 } } },
        { type: "STATE", description: "c", expected: { statevector: [1, 0] } },
      ]),
    );
    const scenarios = requiredScenarios(specs);
    expect(scenarios).toContain("submission");
    expect(scenarios).toContain("zero_state");
    expect(scenarios).toContain("superposition");
  });
});
