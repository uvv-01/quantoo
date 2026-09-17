/**
 * Execution system types.
 *
 * Shared between the execution service, the sandbox boundary, the judge,
 * and the UI. The execution artifact is intentionally extensible so that
 * future phases (debugger, analytics, portfolio) can add fields without
 * breaking the existing contract.
 */

// ========================================
// Execution status
// ========================================

/**
 * Status of an execution. Only statuses actually produced by the
 * current runtime are used; future phases may extend this set.
 */
export type ExecutionStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "TIMED_OUT"
  | "RESOURCE_LIMIT";

/** Structured, safe error categories returned to clients. Never include stack traces. */
export type ExecutionErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_CODE"
  | "SYNTAX_ERROR"
  | "IMPORT_ERROR"
  | "RUNTIME_ERROR"
  | "TIMEOUT"
  | "MEMORY_LIMIT"
  | "QUBIT_LIMIT"
  | "CIRCUIT_LIMIT"
  | "OUTPUT_LIMIT"
  | "SANDBOX_ERROR"
  | "SIMULATOR_ERROR"
  | "INTERNAL_ERROR";

// ========================================
// Resource policy
// ========================================

/** Resource limits applied to every sandbox execution. */
export interface ExecutionLimits {
  maxQubits: number;
  maxDepth: number;
  maxOperations: number;
  maxShots: number;
  /** Wall-clock timeout for the whole sandbox process, in milliseconds. */
  maxRuntimeMs: number;
  maxMemoryMb: number;
  /** Maximum stdout bytes collected from the program. */
  maxOutputBytes: number;
  /** Maximum source code size in bytes. */
  maxSourceBytes: number;
}

// ========================================
// Sandbox result (raw runtime output)
// ========================================

/** Circuit metadata reported by the runtime. Only measured facts are present. */
export interface CircuitMetadata {
  qubits: number;
  clbits: number;
  depth: number;
  gateCounts: Record<string, number>;
  /** Product of gate counts. */
  totalGates: number;
}

/** Raw outcome payload produced by the quantum runtime for one scenario. */
export interface ScenarioOutcome {
  /** Scenario identifier. "submission" is the user's own circuit. */
  scenario: string;
  circuit: CircuitMetadata;
  /**
   * Statevector amplitudes as [real, imaginary] pairs when the scenario was
   * simulated without measurement. Absent when the circuit was measured.
   */
  statevectorPairs?: [number, number][];
  /** Global phase of the circuit, when reported by the runtime. */
  globalPhase?: number;
  /** Measurement counts keyed by bitstring, when the scenario has measurements. */
  counts?: Record<string, number>;
  /** Number of shots used for counts, when applicable. */
  shots?: number;
}

/** Raw result returned by the sandbox boundary. */
export interface SandboxResult {
  ok: boolean;
  /** Scenario outcomes keyed by scenario name. */
  outcomes: Record<string, ScenarioOutcome>;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: {
    code: ExecutionErrorCode;
    message: string;
  };
}

// ========================================
// Judge
// ========================================

/** A single judge check outcome. */
export interface JudgeCheck {
  name: string;
  description: string;
  status: "PASS" | "FAIL" | "SKIPPED";
  message?: string;
  /** Safe, educational actual/expected values (numbers, strings, small objects). */
  actual?: unknown;
  expected?: unknown;
}

/** Result of judging an execution artifact against a problem's test specification. */
export interface JudgeResult {
  passed: boolean;
  summary: string;
  checks: JudgeCheck[];
  failures: JudgeCheck[];
}

// ========================================
// API contracts
// ========================================

/** Run action response. */
export interface RunResponse {
  submissionId: string;
  status: ExecutionStatus;
  passed: boolean | null;
  durationMs: number | null;
  error?: { code: ExecutionErrorCode; message: string } | null;
  judge: JudgeResult | null;
  /** Real runtime data for display. Never fabricated. */
  execution: {
    circuit: CircuitMetadata | null;
    counts: Record<string, number> | null;
    probabilities: Record<string, number> | null;
    shots: number | null;
    stdout: string;
    stderr: string;
  } | null;
}
