/**
 * Backend registry.
 *
 * The registry is the only source of execution backends for the
 * observatory. Backends are declared in code; availability is measured
 * at query time. The set is intentionally small: one genuinely usable
 * local simulator today, with the interface ready for provider
 * integrations (remote simulators and QPUs) that actually exist.
 */

import { createLocalSimulatorBackend, LOCAL_SIMULATOR_ID } from "@/lib/hardware/local-simulator";
import type { BackendDescriptor, QuantumBackend } from "@/lib/hardware/types";

const backends: QuantumBackend[] = [createLocalSimulatorBackend()];

/** All registered backend descriptors (metadata only, no availability). */
export function listBackendDescriptors(): BackendDescriptor[] {
  return backends.map((backend) => backend.descriptor);
}

/** Look up a backend by id. */
export function getBackend(id: string): QuantumBackend | null {
  return backends.find((backend) => backend.descriptor.id === id) ?? null;
}

/** All registered backend ids (accepted inputs for API validation). */
export const BACKEND_IDS = backends.map((backend) => backend.descriptor.id) as [
  string,
  ...string[],
];

export { LOCAL_SIMULATOR_ID };
