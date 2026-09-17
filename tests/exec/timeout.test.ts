/**
 * Sandbox boundary integration test: wall-clock timeout enforcement.
 *
 * Runs an infinite-loop submission through executeInSandbox in
 * host-fallback mode with a short timeout and asserts the boundary
 * terminates it and classifies the failure as TIMEOUT. Kept in its own
 * file so it can be excluded from fast test runs if needed.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { executeInSandbox } from "@/lib/exec/sandbox";
import type { ExecutionLimits } from "@/lib/exec/types";

const shortLimits: ExecutionLimits = {
  maxQubits: 8,
  maxDepth: 200,
  maxOperations: 1_000,
  maxShots: 256,
  maxRuntimeMs: 4_000,
  maxMemoryMb: 512,
  maxOutputBytes: 16_000,
  maxSourceBytes: 50_000,
  maxSnapshotSteps: 32,
  maxDensityQubits: 4,
  maxUnitaryQubits: 3,
};

describe("sandbox timeout enforcement (host-fallback)", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("terminates an infinite loop and reports TIMEOUT", async () => {
    process.env.QUANTOO_SANDBOX_MODE = "host-fallback";
    const started = Date.now();
    const result = await executeInSandbox(
      "while True:\n    x = 1\n",
      ["submission"],
      10,
      shortLimits,
    );
    const elapsed = Date.now() - started;
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("TIMEOUT");
    // Terminated near the 4s ceiling, not the 15s default.
    expect(elapsed).toBeLessThan(8_000);
    expect(elapsed).toBeGreaterThanOrEqual(3_500);
  }, 30_000);

  it("rejects execution when the mode is disabled without spawning", async () => {
    process.env.QUANTOO_SANDBOX_MODE = "disabled";
    const result = await executeInSandbox("print(1)", ["submission"], 10, shortLimits);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("SANDBOX_ERROR");
  });
});
