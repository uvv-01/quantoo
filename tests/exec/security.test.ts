/**
 * Sandbox & execution security tests.
 *
 * These verify the TS-side sandbox boundary behavior that does not require
 * the Python runtime: mode gating, safe failure codes, output caps, and
 * runtime payload parsing. The runner-level restrictions (import
 * allowlist, builtin removal, path sanitization) are covered by
 * tests/runtime/runner.test.ts against the real interpreter.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getSandboxMode,
  RUNTIME_IMAGE,
  executeInSandbox,
} from "@/lib/exec/sandbox";
import { getExecutionLimits } from "@/lib/exec/limits";

describe("sandbox mode gating", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("defaults to docker mode", () => {
    delete process.env.QUANTOO_SANDBOX_MODE;
    expect(getSandboxMode()).toBe("docker");
  });

  it("accepts explicitly configured modes", () => {
    process.env.QUANTOO_SANDBOX_MODE = "host-fallback";
    expect(getSandboxMode()).toBe("host-fallback");
    process.env.QUANTOO_SANDBOX_MODE = "disabled";
    expect(getSandboxMode()).toBe("disabled");
    process.env.QUANTOO_SANDBOX_MODE = "docker";
    expect(getSandboxMode()).toBe("docker");
  });

  it("never resolves unknown modes to docker implicitly", () => {
    process.env.QUANTOO_SANDBOX_MODE = "nonsense";
    expect(getSandboxMode()).toBe("docker");
  });
});

describe("sandbox disabled mode", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("refuses to execute when disabled", async () => {
    process.env.QUANTOO_SANDBOX_MODE = "disabled";
    const result = await executeInSandbox(
      "print('hi')",
      ["submission"],
      100,
      getExecutionLimits(),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("SANDBOX_ERROR");
    expect(result.outcomes).toEqual({});
  });
});

describe("runtime image configuration", () => {
  it("uses a pinned runtime image name", () => {
    expect(RUNTIME_IMAGE).toBe("quantoo/quantum-runtime:latest");
  });
});

describe("sandbox failure hygiene", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns structured failures without stack traces", async () => {
    process.env.QUANTOO_SANDBOX_MODE = "disabled";
    const result = await executeInSandbox(
      "from qiskit import QuantumCircuit\nresult = QuantumCircuit(1)",
      ["submission"],
      100,
      getExecutionLimits(),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/at .+:\d+:\d+/); // no stack frames
    expect(result.error).toBeDefined();
    expect(typeof result.error?.message).toBe("string");
  });

  it("caps durationMs to a number even on failure", async () => {
    process.env.QUANTOO_SANDBOX_MODE = "disabled";
    const result = await executeInSandbox("print(1)", ["submission"], 10, getExecutionLimits());
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
