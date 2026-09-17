/**
 * Semantic fingerprint (Phase 6).
 *
 * A deterministic, layered fingerprint over normalized observable
 * information — deliberately NOT a hash of the source text. Two
 * textually different programs with the same observable behavior share
 * behavioral layers; the source fingerprint exists only for identity.
 *
 * Layers (independently inspectable, never collapsed into one blob):
 *
 *   structural    qubit/clbit counts, depth, normalized gate histogram
 *   operational   ordered canonical operations (null without trace data)
 *   probability   exact computational-basis probabilities
 *   measurement   sampled frequencies at fixed rounding
 *   resource      depth and operation count
 *   environment   safe environment/configuration fingerprint
 *   combined      hash over every available layer
 */

import { layerHash } from "@/lib/semantic/canonical";
import type {
  CanonicalCircuit,
  EnvironmentFingerprint,
  SemanticFingerprint,
} from "@/lib/semantic/types";

/** Rounding applied to sampled frequencies before hashing (sampling noise). */
const MEASUREMENT_ROUNDING = 4;

function roundMap(
  map: Record<string, number>,
  decimals: number,
): Record<string, number> {
  const factor = 10 ** decimals;
  const rounded: Record<string, number> = {};
  for (const key of Object.keys(map).sort()) {
    rounded[key] = Math.round(map[key] * factor) / factor;
  }
  return rounded;
}

/** Structural layer: circuit shape and normalized gate multiset. */
export function structuralLayer(circuit: CanonicalCircuit): unknown {
  return {
    qubits: circuit.qubits,
    clbits: circuit.clbits,
    depth: circuit.depth,
    gateHistogram: circuit.gateHistogram,
  };
}

/** Operational layer: ordered canonical operations, when known. */
export function operationalLayer(circuit: CanonicalCircuit): unknown | null {
  return circuit.operations ? { operations: circuit.operations } : null;
}

/** Resource layer: execution cost figures. */
export function resourceLayer(circuit: CanonicalCircuit): unknown {
  return { depth: circuit.depth, totalOperations: circuit.totalOperations };
}

/**
 * Environment layer. Volatile per-run values (shots, seed) are part of the
 * execution configuration and intentionally included: two executions with
 * different shot counts are genuinely different observations.
 */
export function environmentLayer(environment: EnvironmentFingerprint): unknown {
  return environment;
}

/** Compute every available fingerprint layer for a semantic record's inputs. */
export function computeSemanticFingerprint(input: {
  circuit: CanonicalCircuit;
  probabilities: Record<string, number> | null;
  measurementFrequencies: Record<string, number> | null;
  environment: EnvironmentFingerprint;
}): SemanticFingerprint {
  const structural = layerHash(structuralLayer(input.circuit));
  const operationalValue = operationalLayer(input.circuit);
  const operational = operationalValue === null ? null : layerHash(operationalValue);
  const probability = input.probabilities
    ? layerHash(roundMap(input.probabilities, 10))
    : null;
  const measurement = input.measurementFrequencies
    ? layerHash(roundMap(input.measurementFrequencies, MEASUREMENT_ROUNDING))
    : null;
  const resource = layerHash(resourceLayer(input.circuit));
  const environment = layerHash(environmentLayer(input.environment));
  const combined = layerHash({
    structural,
    operational,
    probability,
    measurement,
    resource,
    environment,
  });
  return {
    structural,
    operational,
    probability,
    measurement,
    resource,
    environment,
    combined,
  };
}
