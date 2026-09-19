/**
 * Local simulator backend adapter.
 *
 * Executes through the application's own sandboxed Qiskit runtime — the
 * same pipeline used by the workspace, semantic observatory, and
 * compatibility lab. It is reported as LOCAL_SIMULATOR, never as
 * quantum hardware, and its availability reflects measured sandbox
 * health, not configuration optimism.
 */

import type {
  BackendAvailability,
  BackendCapabilities,
  BackendDescriptor,
  BackendLimits,
  HardwareExecutionResult,
  HardwareJobHandle,
  HardwareJobMetadata,
  JobStatus,
  QuantumBackend,
  SubmitJobParams,
} from "@/lib/hardware/types";
import { describeSandboxAvailability } from "@/lib/hardware/availability";
import { getExecutionLimits } from "@/lib/exec/limits";

/**
 * An execution performed through this adapter. The result is recorded by
 * the caller (the run service) as a standard submission; this module
 * itself never persists anything and never invents counts.
 */
export interface LocalSimulationRequest {
  sourceCode: string;
  shots: number;
  seed: number | null;
}

export interface LocalSimulationOutcome {
  status: "COMPLETED" | "FAILED";
  counts: Record<string, number> | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export const LOCAL_SIMULATOR_ID = "local-aer";

export const localSimulatorDescriptor: BackendDescriptor = {
  id: LOCAL_SIMULATOR_ID,
  name: "Local Aer Simulator",
  kind: "LOCAL_SIMULATOR",
  provider: "local",
  description:
    "The platform's sandboxed Qiskit Aer runtime. Deterministic seeded sampling is supported. This is a simulator, not quantum hardware.",
};

/** Measured sandbox health, translated into honest backend availability. */
export async function probeLocalSimulator(): Promise<BackendAvailability> {
  const health = await describeSandboxAvailability();
  return {
    backendId: LOCAL_SIMULATOR_ID,
    status: health.status,
    checkedAt: health.checkedAt,
    reason: health.reason,
  };
}

export function createLocalSimulatorBackend(): QuantumBackend {
  const limits = getExecutionLimits();
  return {
    descriptor: localSimulatorDescriptor,

    listCapabilities(): BackendCapabilities {
      return {
        maxQubits: limits.maxQubits,
        maxShots: limits.maxShots,
        supportsMidCircuitMeasurement: true,
        supportsParametricCircuits: true,
        supportsTranspilation: true,
      };
    },

    getLimits(): BackendLimits {
      return {
        maxQubits: limits.maxQubits,
        maxShots: limits.maxShots,
        maxDepth: limits.maxDepth,
        // The local simulator is bounded by the shared execution rate
        // limit rather than a provider job quota.
        maxJobsPerWindow: null,
      };
    },

    async checkAvailability(): Promise<BackendAvailability> {
      return probeLocalSimulator();
    },

    validateCircuit(circuit: { qubits: number; depth: number }): { valid: boolean; reason: string | null } {
      if (circuit.qubits > limits.maxQubits) {
        return {
          valid: false,
          reason: `Circuit uses ${circuit.qubits} qubits; this backend supports at most ${limits.maxQubits}.`,
        };
      }
      if (circuit.depth > limits.maxDepth) {
        return {
          valid: false,
          reason: `Circuit depth ${circuit.depth} exceeds the supported maximum of ${limits.maxDepth}.`,
        };
      }
      return { valid: true, reason: null };
    },

    async submitJob(params: SubmitJobParams): Promise<HardwareJobHandle> {
      // OpenQASM submission is not part of the local execution path: the
      // sandbox compiles Python source directly. QASM entry will arrive
      // with a provider integration; until then the request is refused
      // honestly rather than translated behind the caller's back.
      void params;
      const now = new Date().toISOString();
      const metadata: HardwareJobMetadata = {
        backendId: localSimulatorDescriptor.id,
        backendName: localSimulatorDescriptor.name,
        kind: localSimulatorDescriptor.kind,
        provider: localSimulatorDescriptor.provider,
        jobId: null,
        submittedAt: now,
        completedAt: null,
        queueInfo: null,
        shots: null,
        qubits: null,
      };
      throw new LocalBackendSubmitError(metadata);
    },

    async getJobStatus(jobId: string): Promise<JobStatus> {
      void jobId;
      return {
        jobId: null,
        state: "UNKNOWN",
        result: null,
      };
    },

    async cancelJob(jobId: string): Promise<{ cancelled: boolean; reason: string | null }> {
      void jobId;
      return {
        cancelled: false,
        reason: "The local simulator executes synchronously; there is nothing to cancel.",
      };
    },
  };
}

/** Error carrying the honest job metadata for a refused local submission. */
export class LocalBackendSubmitError extends Error {
  constructor(public readonly metadata: HardwareJobMetadata) {
    super(
      "The local simulator executes Python source through the sandboxed runtime, not OpenQASM job submission.",
    );
    this.name = "LocalBackendSubmitError";
  }
}

/**
 * Classification helper used by callers that already executed through the
 * sandbox: it converts a sandbox outcome into the hardware-neutral result
 * shape without adding or dropping any measured facts.
 */
export function toHardwareExecutionResult(
  outcome: LocalSimulationOutcome,
): HardwareExecutionResult {
  return {
    status: outcome.status === "COMPLETED" ? "COMPLETED" : "FAILED",
    counts: outcome.counts,
    error: outcome.errorMessage,
  };
}
