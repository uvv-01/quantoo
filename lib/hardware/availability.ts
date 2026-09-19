/**
 * Backend availability probing.
 *
 * Availability is measured, never assumed. The local simulator is usable
 * when the deployment's sandbox can actually execute jobs: the docker
 * image is present (docker mode), or the explicitly-enabled host
 * fallback is configured. Disabling the sandbox disables the backend.
 */

import { execFile } from "node:child_process";
import { getSandboxMode } from "@/lib/exec/sandbox";
import { ENVIRONMENT_PROFILES } from "@/lib/compat/environments";
import type { BackendAvailability } from "@/lib/hardware/types";

const LOCAL_SIMULATOR_ID = "local-aer";
const PROBE_TTL_MS = 5 * 60 * 1000;

type Cached = { value: BackendAvailability; checkedAt: number };
let cache: Cached | null = null;

/** Clear the cached probe result (used by tests). */
export function clearAvailabilityCache(): void {
  cache = null;
}

/**
 * Describe measured sandbox health in backend terms. The result is
 * evidence-based: docker mode probes image presence; host fallback is
 * reported as available only when explicitly configured; a disabled
 * sandbox is never available.
 */
export async function describeSandboxAvailability(): Promise<BackendAvailability> {
  const now = Date.now();
  if (cache && now - cache.checkedAt < PROBE_TTL_MS) {
    return cache.value;
  }

  const checkedAt = new Date().toISOString();
  const mode = getSandboxMode();

  if (mode === "disabled") {
    const value: BackendAvailability = {
      backendId: LOCAL_SIMULATOR_ID,
      status: "UNAVAILABLE",
      checkedAt,
      reason: "The execution sandbox is disabled for this deployment.",
    };
    cache = { value, checkedAt: now };
    return value;
  }

  if (mode === "host-fallback") {
    const value: BackendAvailability = {
      backendId: LOCAL_SIMULATOR_ID,
      status: "AVAILABLE",
      checkedAt,
      reason: null,
    };
    cache = { value, checkedAt: now };
    return value;
  }

  // docker mode: probe the default runtime image.
  const present = await probeDefaultImage();
  const value: BackendAvailability = {
    backendId: LOCAL_SIMULATOR_ID,
    status: present ? "AVAILABLE" : "UNAVAILABLE",
    checkedAt,
    reason: present
      ? null
      : "The runtime image is not present on this host; build it or switch the sandbox mode.",
  };
  cache = { value, checkedAt: now };
  return value;
}

/** Probe the default runtime image with `docker image inspect`. */
function probeDefaultImage(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      "docker",
      ["image", "inspect", "--format", "{{.Id}}", ENVIRONMENT_PROFILES[0].image],
      { timeout: 10_000 },
      (error, stdout) => {
        resolve(Boolean(!error && stdout && stdout.trim().length > 0));
      },
    );
  });
}
