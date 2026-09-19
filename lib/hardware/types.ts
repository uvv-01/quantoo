/**
 * Hardware abstraction layer — domain types.
 *
 * The abstraction distinguishes execution targets honestly:
 *
 *   LOCAL_SIMULATOR    in-process/container simulator (Qiskit Aer)
 *   REMOTE_SIMULATOR   provider-hosted simulator
 *   REAL_QPU           physical quantum hardware
 *   UNAVAILABLE        target known but not currently usable
 *
 * A simulator is never reported as hardware, and a target is never
 * reported as available unless it has actually been verified.
 */

import type { ExecutionLimits } from "@/lib/exec/types";

/** Kind of execution target, as reported to users. */
export type BackendKind = "LOCAL_SIMULATOR" | "REMOTE_SIMULATOR" | "REAL_QPU";

/** Static description of an execution target. */
export interface BackendDescriptor {
  id: string;
  name: string;
  kind: BackendKind;
  /** Provider namespace, e.g. "local" or a vendor identifier. */
  provider: string;
  /** Human-readable summary; never implies availability on its own. */
  description: string;
}

/** What a backend can execute, measured or declared by its adapter. */
export interface BackendCapabilities {
  maxQubits: number | null;
  maxShots: number | null;
  supportsMidCircuitMeasurement: boolean | null;
  supportsParametricCircuits: boolean | null;
  /** null = capability unknown for this backend. */
  supportsTranspilation: boolean | null;
}

/** Result of probing whether a backend can actually execute jobs. */
export interface BackendAvailability {
  backendId: string;
  /** Evidence-based: AVAILABLE only after a successful probe or execution. */
  status: "AVAILABLE" | "UNAVAILABLE" | "NOT_CONFIGURED" | "NOT_VERIFIED";
  checkedAt: string | null;
  /** Plain-language reason when not available. No stack traces. */
  reason: string | null;
}

/** Metadata recorded for a submitted job. Only known fields are populated. */
export interface HardwareJobMetadata {
  backendId: string;
  backendName: string | null;
  kind: BackendKind;
  provider: string;
  /** Provider-assigned job identifier, when the provider issues one. */
  jobId: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  /** Queue position information, when the provider reports it. */
  queueInfo: string | null;
  shots: number | null;
  qubits: number | null;
}

/** Measurement results from a backend, in the canonical counts shape. */
export interface HardwareExecutionResult {
  status: "COMPLETED" | "FAILED" | "CANCELLED";
  counts: Record<string, number> | null;
  /** Error information returned by the provider, verbatim but size-capped. */
  error: string | null;
}

/** Limits a backend applies to submitted circuits/jobs. */
export type BackendLimits = Pick<
  ExecutionLimits,
  "maxQubits" | "maxShots" | "maxDepth"
> & { maxJobsPerWindow: number | null };

/**
 * Provider-independent backend contract. Implementations must never
 * fabricate results: every returned object reflects a real submission,
 * probe, or an explicit unavailability reason.
 */
export interface QuantumBackend {
  readonly descriptor: BackendDescriptor;
  listCapabilities(): BackendCapabilities;
  getLimits(): BackendLimits;
  /** Verify the backend can execute jobs right now. */
  checkAvailability(): Promise<BackendAvailability>;
  /** Validate that a circuit fits the backend's declared constraints. */
  validateCircuit(circuit: { qubits: number; depth: number }): { valid: boolean; reason: string | null };
  /**
   * Submit a job. Implementations receive counts-shaped results only from
   * real executions; local adapters may delegate to the sandbox runtime.
   */
  submitJob(params: SubmitJobParams): Promise<HardwareJobHandle>;
  /** Fetch current status of a previously submitted job. */
  getJobStatus(jobId: string): Promise<JobStatus>;
  /** Request cancellation of a previously submitted job. */
  cancelJob(jobId: string): Promise<{ cancelled: boolean; reason: string | null }>;
}

export interface SubmitJobParams {
  /** OpenQASM 3 or provider-native circuit description. */
  circuit: string;
  shots: number;
  seed: number | null;
}

export interface HardwareJobHandle {
  jobId: string | null;
  metadata: HardwareJobMetadata;
}

export interface JobStatus {
  jobId: string | null;
  state: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN";
  result: HardwareExecutionResult | null;
}
