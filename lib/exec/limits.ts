/**
 * Execution resource policy.
 *
 * Limits are configurable via environment variables so deployments can
 * tune them without code changes. Values are clamped to safe bounds —
 * configuration cannot disable a limit entirely.
 */

import type { ExecutionLimits } from "@/lib/exec/types";

/** Hard upper bounds that environment configuration cannot exceed. */
export const LIMIT_CEILINGS = {
  maxQubits: 16,
  maxDepth: 1_000,
  maxOperations: 5_000,
  maxShots: 10_000,
  maxRuntimeMs: 60_000,
  maxMemoryMb: 1_024,
  maxOutputBytes: 64_000,
  maxSourceBytes: 100_000,
  maxSnapshotSteps: 128,
  maxDensityQubits: 8,
  maxUnitaryQubits: 6,
} as const;

/** Lower bounds so configuration cannot produce a broken/zero limit. */
export const LIMIT_FLOORS = {
  maxQubits: 1,
  maxDepth: 10,
  maxOperations: 10,
  maxShots: 1,
  maxRuntimeMs: 1_000,
  maxMemoryMb: 128,
  maxOutputBytes: 1_000,
  maxSourceBytes: 1_000,
  maxSnapshotSteps: 1,
  maxDensityQubits: 1,
  maxUnitaryQubits: 1,
} as const;

function clampInt(
  raw: string | undefined,
  fallback: number,
  key: keyof typeof LIMIT_CEILINGS,
): number {
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(LIMIT_CEILINGS[key], Math.max(LIMIT_FLOORS[key], value));
}

/**
 * Resolve the effective execution limits from environment configuration.
 * Defaults are conservative: 8 qubits keeps worst-case statevector memory
 * modest (16 complex amplitudes) while still allowing meaningful problems.
 */
export function getExecutionLimits(): ExecutionLimits {
  return {
    maxQubits: clampInt(process.env.EXEC_MAX_QUBITS, 8, "maxQubits"),
    maxDepth: clampInt(process.env.EXEC_MAX_DEPTH, 200, "maxDepth"),
    maxOperations: clampInt(
      process.env.EXEC_MAX_OPERATIONS,
      1_000,
      "maxOperations",
    ),
    maxShots: clampInt(process.env.EXEC_MAX_SHOTS, 4_096, "maxShots"),
    maxRuntimeMs: clampInt(process.env.EXEC_TIMEOUT_MS, 15_000, "maxRuntimeMs"),
    maxMemoryMb: clampInt(process.env.EXEC_MEMORY_MB, 512, "maxMemoryMb"),
    maxOutputBytes: clampInt(
      process.env.EXEC_MAX_OUTPUT_BYTES,
      16_000,
      "maxOutputBytes",
    ),
    maxSourceBytes: clampInt(
      process.env.EXEC_MAX_SOURCE_BYTES,
      50_000,
      "maxSourceBytes",
    ),
    maxSnapshotSteps: clampInt(
      process.env.EXEC_SNAPSHOT_MAX_STEPS,
      32,
      "maxSnapshotSteps",
    ),
    maxDensityQubits: clampInt(
      process.env.EXEC_DENSITY_MAX_QUBITS,
      4,
      "maxDensityQubits",
    ),
    maxUnitaryQubits: clampInt(
      process.env.EXEC_UNITARY_MAX_QUBITS,
      3,
      "maxUnitaryQubits",
    ),
  };
}
