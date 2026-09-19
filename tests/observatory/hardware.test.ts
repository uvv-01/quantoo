/**
 * Hardware abstraction contract tests (Phase 8).
 *
 * These are explicitly mock-level: no real quantum hardware exists in
 * this environment, so nothing here claims hardware results. The tests
 * pin the provider contract for future integrations:
 *
 *   - the local simulator is labeled LOCAL_SIMULATOR, never hardware
 *   - capabilities and limits are declared and consistent
 *   - circuit validation enforces the declared limits
 *   - job submission through the local adapter is refused honestly
 *     (the sandbox pipeline is the local execution path)
 *   - job status/cancel for a synchronous backend is honest
 */

import { describe, expect, it } from "vitest";
import { getBackend, listBackendDescriptors, LOCAL_SIMULATOR_ID } from "@/lib/hardware/registry";
import { createLocalSimulatorBackend, LocalBackendSubmitError } from "@/lib/hardware/local-simulator";
import { getExecutionLimits } from "@/lib/exec/limits";

describe("backend registry", () => {
  it("exposes the local simulator with honest metadata", () => {
    const descriptors = listBackendDescriptors();
    expect(descriptors.length).toBeGreaterThan(0);
    const local = descriptors.find((d) => d.id === LOCAL_SIMULATOR_ID);
    expect(local).toBeDefined();
    expect(local?.kind).toBe("LOCAL_SIMULATOR");
    expect(local?.kind).not.toBe("REAL_QPU");
    expect(getBackend("does-not-exist")).toBeNull();
  });
});

describe("local simulator contract", () => {
  it("declares capabilities consistent with execution limits", () => {
    const backend = createLocalSimulatorBackend();
    const capabilities = backend.listCapabilities();
    const limits = getExecutionLimits();
    expect(capabilities.maxQubits).toBe(limits.maxQubits);
    expect(capabilities.maxShots).toBe(limits.maxShots);
    expect(capabilities.supportsMidCircuitMeasurement).toBe(true);
  });

  it("validates circuits against its declared limits", () => {
    const backend = createLocalSimulatorBackend();
    const limits = getExecutionLimits();
    expect(backend.validateCircuit({ qubits: limits.maxQubits, depth: 10 }).valid).toBe(true);
    const tooBig = backend.validateCircuit({ qubits: limits.maxQubits + 1, depth: 10 });
    expect(tooBig.valid).toBe(false);
    expect(tooBig.reason).toContain("qubits");
    const tooDeep = backend.validateCircuit({ qubits: 2, depth: limits.maxDepth + 1 });
    expect(tooDeep.valid).toBe(false);
    expect(tooDeep.reason).toContain("depth");
  });

  it("refuses OpenQASM job submission honestly (no fabricated jobs)", async () => {
    const backend = createLocalSimulatorBackend();
    await expect(
      backend.submitJob({ circuit: "OPENQASM 3; qubit[2] q;", shots: 1024, seed: 1 }),
    ).rejects.toBeInstanceOf(LocalBackendSubmitError);
  });

  it("reports synchronous job semantics instead of inventing status", async () => {
    const backend = createLocalSimulatorBackend();
    const status = await backend.getJobStatus("no-such-job");
    expect(status.state).toBe("UNKNOWN");
    const cancel = await backend.cancelJob("no-such-job");
    expect(cancel.cancelled).toBe(false);
    expect(cancel.reason).toContain("synchronously");
  });
});
