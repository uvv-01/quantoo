/**
 * Canonical circuit representation and hashing helpers (Phase 6).
 *
 * The canonical form is derived from the persisted gate trace — the
 * circuit's actual operation order as executed — with gate names
 * normalized. When an execution artifact carries no trace (large circuits,
 * subsampling, older runs), the canonical form falls back to the gate
 * histogram from circuit metadata and explicitly reports operations as
 * unavailable rather than reconstructing a plausible-looking order.
 *
 * Operations are never reordered: operation order is quantum-mechanically
 * significant, and equivalence via reordering is only proven by dedicated
 * circuit-identity analysis, which Phase 6 does not perform.
 */

import { createHash } from "node:crypto";
import type { ScenarioOutcome, TraceStep } from "@/lib/exec/types";
import type { CanonicalCircuit, CanonicalOperation } from "@/lib/semantic/types";

/**
 * Gate-name aliases normalized to a canonical vocabulary. Only syntactic
 * aliases of the same operation are folded; parameterized and controlled
 * variants stay distinct.
 */
const GATE_ALIASES: Record<string, string> = {
  cnot: "cx",
  cz_gate: "cz",
  x_gate: "x",
  h_gate: "h",
};

/** Normalize one gate name; unknown names are lowercased and kept. */
export function normalizeGateName(name: string): string {
  const lower = name.toLowerCase();
  return GATE_ALIASES[lower] ?? lower;
}

/**
 * Build the canonical circuit from a persisted scenario outcome.
 * Returns operations only when the artifact carries a real trace.
 */
export function canonicalCircuitFromOutcome(
  outcome: ScenarioOutcome | undefined,
): CanonicalCircuit | null {
  if (!outcome) return null;
  const circuit = outcome.circuit;
  const gateHistogram: Record<string, number> = {};
  for (const [name, count] of Object.entries(circuit.gateCounts)) {
    gateHistogram[normalizeGateName(name)] = count;
  }

  const steps: TraceStep[] | undefined = outcome.trace?.steps;
  if (!steps || steps.length === 0) {
    return {
      qubits: circuit.qubits,
      clbits: circuit.clbits,
      depth: circuit.depth,
      operations: null,
      gateHistogram,
      totalOperations: circuit.totalGates,
    };
  }

  const operations: CanonicalOperation[] = steps.map((step) => ({
    name: normalizeGateName(step.gateName),
    qubits: [...step.qubits],
    clbits: [...step.clbits],
    params: [...step.params],
    measurement: step.measurement,
  }));

  return {
    qubits: circuit.qubits,
    clbits: circuit.clbits,
    depth: circuit.depth,
    operations,
    gateHistogram,
    totalOperations: operations.length,
  };
}

// ========================================
// Stable hashing
// ========================================

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Deterministic JSON serialization: object keys sorted, arrays in order.
 * Ensures fingerprint stability across key insertion orders.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Short layer hash: sha256 of the stable serialization, full hex. */
export function layerHash(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

/** Text fingerprint: sha256 hex of the raw source. Identity only. */
export function sourceFingerprint(source: string): string {
  return sha256Hex(source);
}

/**
 * Compare canonical circuits structurally. Returns a factual description
 * of the first observed structural difference, or null when the two forms
 * agree on every compared field. Circuit forms without operations are
 * compared on the gate histogram only, with a limitation note.
 */
export function firstStructuralDifference(
  a: CanonicalCircuit,
  b: CanonicalCircuit,
): {
  message: string;
  operationIndex?: number;
  qubits?: number[];
} | null {
  if (a.qubits !== b.qubits) {
    return {
      message: `Qubit count differs: ${a.qubits} vs ${b.qubits}.`,
      qubits: undefined,
    };
  }
  if (a.clbits !== b.clbits) {
    return { message: `Classical bit count differs: ${a.clbits} vs ${b.clbits}.` };
  }

  if (a.operations && b.operations) {
    const n = Math.min(a.operations.length, b.operations.length);
    for (let i = 0; i < n; i++) {
      const opA = a.operations[i];
      const opB = b.operations[i];
      const sameShape =
        opA.name === opB.name &&
        opA.qubits.join(",") === opB.qubits.join(",") &&
        opA.clbits.join(",") === opB.clbits.join(",");
      if (!sameShape) {
        return {
          message: `First observed structural divergence at operation ${i}: ${opA.name} on qubits [${opA.qubits.join(", ")}] vs ${opB.name} on qubits [${opB.qubits.join(", ")}].`,
          operationIndex: i,
          qubits: opA.qubits,
        };
      }
      // Parameters compared with a small numeric tolerance.
      if (opA.params.length !== opB.params.length) {
        return {
          message: `Parameter count differs at operation ${i} (${opA.name}): ${opA.params.length} vs ${opB.params.length}.`,
          operationIndex: i,
          qubits: opA.qubits,
        };
      }
      for (let p = 0; p < opA.params.length; p++) {
        if (Math.abs(opA.params[p] - opB.params[p]) > 1e-9) {
          return {
            message: `Parameter value differs at operation ${i} (${opA.name}).`,
            operationIndex: i,
            qubits: opA.qubits,
          };
        }
      }
    }
    if (a.operations.length !== b.operations.length) {
      return {
        message: `Operation count differs: ${a.operations.length} vs ${b.operations.length}.`,
        operationIndex: Math.min(a.operations.length, b.operations.length),
      };
    }
    return null;
  }

  // Histogram-only fallback: same multiset of gates is all we can claim.
  const names = new Set([
    ...Object.keys(a.gateHistogram),
    ...Object.keys(b.gateHistogram),
  ]);
  for (const name of names) {
    if ((a.gateHistogram[name] ?? 0) !== (b.gateHistogram[name] ?? 0)) {
      return {
        message: `Gate multiset differs: ${name} appears ${a.gateHistogram[name] ?? 0} time(s) vs ${b.gateHistogram[name] ?? 0}.`,
      };
    }
  }
  return null;
}
