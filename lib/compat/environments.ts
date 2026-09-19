/**
 * Environment registry (Phase 7).
 *
 * A registry of explicitly provisioned execution environments. Profiles
 * are declared in code — users can select among them but never define new
 * ones, install packages, or supply URLs. Availability is measured by
 * probing the actual runtime, and results are cached briefly so the probe
 * does not run on every request.
 *
 * The baseline profile is the deployment's standard runtime image. The
 * legacy profile maps to a separately built, pinned image defined in
 * services/quantum-runtime (see requirements-legacy.txt / Dockerfile ARG).
 * It is NEVER installed on demand: when the image is absent the profile is
 * reported UNAVAILABLE with a measured reason.
 */

import { execFile } from "node:child_process";
import type {
  EnvironmentAvailability,
  EnvironmentDescriptor,
  EnvironmentProfile,
} from "@/lib/compat/types";

// ========================================
// Registry
// ========================================

/** The deployment's standard runtime image (Phase 4 sandbox default). */
const DEFAULT_IMAGE = "quantoo/quantum-runtime:latest";
/** Controlled second environment: separately built, pinned image. */
const LEGACY_IMAGE = "quantoo/quantum-runtime:legacy-1.1";

/**
 * Registered environment profiles. Immutability rule: changing what a
 * profile *means* (its image or its environment payload) requires a new
 * profile id — stored records must keep describing exactly what ran.
 */
export const ENVIRONMENT_PROFILES: EnvironmentProfile[] = [
  {
    id: "qiskit-1-2-4",
    name: "Qiskit 1.2.4 (default)",
    description:
      "The deployment's standard runtime: qiskit 1.2.4, qiskit-aer 0.15.1, numpy 2.1.3 on Python 3.11.",
    image: DEFAULT_IMAGE,
    isDefault: true,
  },
  {
    id: "qiskit-1-1-3",
    name: "Qiskit 1.1.3 (legacy)",
    description:
      "Controlled legacy environment: qiskit 1.1.3, qiskit-aer 0.14.2, numpy 1.26.4 on Python 3.11. Built as a separate pinned image; availability depends on the deployment having built it.",
    image: LEGACY_IMAGE,
    isDefault: false,
  },
];

/** Hard cap on candidate environments per experiment (server-enforced). */
export const MAX_CANDIDATE_ENVIRONMENTS = 5;

/** Look up a registered profile by id. */
export function getEnvironmentProfile(id: string): EnvironmentProfile | null {
  return ENVIRONMENT_PROFILES.find((profile) => profile.id === id) ?? null;
}

/** All registered profile ids (accepted inputs for API validation). */
export const ENVIRONMENT_IDS = ENVIRONMENT_PROFILES.map((p) => p.id) as [
  string,
  ...string[],
];

// ========================================
// Availability probing
// ========================================

const PROBE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry = { value: EnvironmentAvailability; expiresAt: number };
const availabilityCache = new Map<string, CacheEntry>();

/**
 * Probe one image with `docker image inspect --format '{{.Id}}'`.
 * Only container-tool presence and image existence are measured here —
 * never any network or registry operation.
 */
function probeImage(image: string): Promise<{ present: boolean; reason: string | null }> {
  return new Promise((resolve) => {
    execFile(
      "docker",
      ["image", "inspect", "--format", "{{.Id}}", image],
      { timeout: 10_000 },
      (error, stdout) => {
        if (!error && stdout && stdout.trim().length > 0) {
          resolve({ present: true, reason: null });
          return;
        }
        const message =
          error instanceof Error ? error.message.trim() : String(error ?? "unknown error");
        if (message.includes("ENOENT") || message.includes("not found") || message.includes("Cannot find")) {
          resolve({
            present: false,
            reason: "Container tooling is not available in this deployment.",
          });
          return;
        }
        if (message.includes("No such image") || message.includes("no such image")) {
          resolve({
            present: false,
            reason: `Runtime image "${image}" has not been built in this deployment.`,
          });
          return;
        }
        resolve({ present: false, reason: "Runtime image could not be inspected." });
      },
    );
  });
}

/**
 * Measure (or reuse a cached measurement of) a profile's availability.
 * Results describe the *current deployment*; a profile listed in the
 * registry is not claimed usable until its image has actually been probed.
 */
export async function getEnvironmentAvailability(
  profileId: string,
): Promise<EnvironmentAvailability> {
  const profile = getEnvironmentProfile(profileId);
  if (!profile) {
    return {
      profileId,
      status: "UNAVAILABLE",
      imagePresent: null,
      checkedAt: null,
      reason: "Unknown environment profile.",
    };
  }

  const cached = availabilityCache.get(profileId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const probe = await probeImage(profile.image);
  const availability: EnvironmentAvailability = {
    profileId,
    status: probe.present ? "AVAILABLE" : "UNAVAILABLE",
    imagePresent: probe.present,
    checkedAt: new Date().toISOString(),
    reason: probe.reason,
  };
  availabilityCache.set(profileId, { value: availability, expiresAt: now + PROBE_TTL_MS });
  return availability;
}

/** Registry + measured availability for every profile. */
export async function listEnvironmentDescriptors(): Promise<EnvironmentDescriptor[]> {
  const descriptors = await Promise.all(
    ENVIRONMENT_PROFILES.map(async (profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      isDefault: profile.isDefault,
      availability: await getEnvironmentAvailability(profile.id),
    })),
  );
  return descriptors;
}

/** Invalidate cached availability (used by tests and image builds). */
export function clearAvailabilityCache(): void {
  availabilityCache.clear();
}

/**
 * Compare two environment fingerprints recorded by the runtime. Returns
 * the differing component names; an empty array means every recorded
 * component matched. Versions compared only when both sides recorded one;
 * a missing version on either side is reported rather than guessed.
 */
export function compareEnvironmentFingerprints(
  a: {
    python: string | null;
    framework: { name: string; version: string | null };
    simulator: { name: string; version: string | null };
  } | null,
  b: {
    python: string | null;
    framework: { name: string; version: string | null };
    simulator: { name: string; version: string | null };
  } | null,
): { same: boolean; differences: string[] } {
  if (!a || !b) {
    return { same: false, differences: ["environment metadata not recorded"] };
  }
  const differences: string[] = [];
  const pairs: Array<[string, string | null, string | null]> = [
    ["python", a.python, b.python],
    ["framework", a.framework.name, b.framework.name],
    ["frameworkVersion", a.framework.version, b.framework.version],
    ["simulator", a.simulator.name, b.simulator.name],
    ["simulatorVersion", a.simulator.version, b.simulator.version],
  ];
  for (const [name, valueA, valueB] of pairs) {
    if (valueA !== valueB) {
      differences.push(
        valueA === null || valueB === null
          ? `${name}: one side not recorded`
          : `${name}: ${valueA} -> ${valueB}`,
      );
    }
  }
  return { same: differences.length === 0, differences };
}