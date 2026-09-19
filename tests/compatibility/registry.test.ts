/**
 * Compatibility lab unit tests (Phase 7).
 *
 * Registry semantics, environment fingerprint comparison, validation
 * schemas, and report classification. Cross-environment execution itself
 * is covered by the real-runtime integration tests (skipped when the
 * legacy image is absent — availability is probed, never faked).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ENVIRONMENT_PROFILES,
  ENVIRONMENT_IDS,
  MAX_CANDIDATE_ENVIRONMENTS,
  getEnvironmentProfile,
  getEnvironmentAvailability,
  listEnvironmentDescriptors,
  clearAvailabilityCache,
  compareEnvironmentFingerprints,
} from "@/lib/compat/environments";
import {
  createExperimentSchema,
  importPackageSchema,
  experimentIdSchema,
} from "@/lib/compat/validation";
import { COMPARISON_POLICY_NAMES, resolveComparisonPolicy } from "@/lib/semantic/compare";

describe("environment registry", () => {
  it("registers profiles with stable ids, real version numbers, and images", () => {
    expect(ENVIRONMENT_PROFILES.length).toBeGreaterThanOrEqual(1);
    for (const profile of ENVIRONMENT_PROFILES) {
      expect(profile.id).toMatch(/^[a-z0-9-]+$/);
      // Immutability rule: names carry concrete versions, never "latest".
      expect(profile.name).not.toMatch(/latest/i);
      expect(profile.image.length).toBeGreaterThan(0);
    }
    const defaults = ENVIRONMENT_PROFILES.filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);
  });

  it("exposes ENVIRONMENT_IDS consistent with the profiles", () => {
    expect(ENVIRONMENT_IDS).toEqual(ENVIRONMENT_PROFILES.map((p) => p.id));
  });

  it("resolves known profiles and rejects unknown ids with null", () => {
    const known = ENVIRONMENT_PROFILES[0];
    expect(getEnvironmentProfile(known.id)?.id).toBe(known.id);
    expect(getEnvironmentProfile("totally-unknown-env")).toBeNull();
    expect(getEnvironmentProfile("")).toBeNull();
  });

  it("caps candidate environments per experiment", () => {
    expect(MAX_CANDIDATE_ENVIRONMENTS).toBeGreaterThanOrEqual(1);
    expect(MAX_CANDIDATE_ENVIRONMENTS).toBeLessThanOrEqual(8);
  });
});

describe("environment availability (measured, never assumed)", () => {
  beforeEach(() => clearAvailabilityCache());

  it("reports unknown profiles as UNAVAILABLE with a reason", async () => {
    const availability = await getEnvironmentAvailability("totally-unknown-env");
    expect(availability.status).toBe("UNAVAILABLE");
    expect(availability.reason).toBeTruthy();
  });

  it("probes every profile and reports exactly one of the honest statuses", async () => {
    const descriptors = await listEnvironmentDescriptors();
    expect(descriptors.length).toBe(ENVIRONMENT_PROFILES.length);
    for (const descriptor of descriptors) {
      expect(["AVAILABLE", "UNAVAILABLE"]).toContain(descriptor.availability.status);
      if (descriptor.availability.status === "UNAVAILABLE") {
        // An unavailable profile must say why — never a bare flag.
        expect(descriptor.availability.reason).toBeTruthy();
      }
    }
  });
});

describe("environment fingerprint comparison", () => {
  const envA = {
    python: "3.11.9",
    framework: { name: "qiskit", version: "1.2.4" },
    simulator: { name: "aer", version: "0.15.1" },
  };
  const envB = {
    python: "3.11.9",
    framework: { name: "qiskit", version: "1.1.2" },
    simulator: { name: "aer", version: "0.14.2" },
  };

  it("reports same when every recorded component matches", () => {
    const result = compareEnvironmentFingerprints(envA, { ...envA });
    expect(result.same).toBe(true);
    expect(result.differences).toEqual([]);
  });

  it("lists each differing component when versions change", () => {
    const result = compareEnvironmentFingerprints(envA, envB);
    expect(result.same).toBe(false);
    expect(result.differences).toContain("frameworkVersion: 1.2.4 -> 1.1.2");
    expect(result.differences).toContain("simulatorVersion: 0.15.1 -> 0.14.2");
    expect(result.differences).not.toContain("python: 3.11.9 -> 3.11.9");
  });

  it("treats missing metadata on either side as a reported difference", () => {
    const partial = {
      python: "3.11.9",
      framework: { name: "qiskit", version: null as string | null },
      simulator: { name: "aer", version: "0.15.1" },
    };
    const result = compareEnvironmentFingerprints(envA, partial);
    expect(result.same).toBe(false);
    expect(result.differences).toContain("frameworkVersion: one side not recorded");
  });

  it("never claims equality when a fingerprint is absent entirely", () => {
    expect(compareEnvironmentFingerprints(envA, null).same).toBe(false);
    expect(compareEnvironmentFingerprints(null, envA).same).toBe(false);
    expect(compareEnvironmentFingerprints(null, null).same).toBe(false);
  });
});

describe("comparison policies", () => {
  it("resolves known policies and falls back to the default for unknown names", () => {
    for (const name of COMPARISON_POLICY_NAMES) {
      expect(resolveComparisonPolicy(name).name).toBe(name);
    }
    const fallback = resolveComparisonPolicy("banana");
    expect(fallback.name).toBe("statistical-default");
  });
});

describe("validation schemas", () => {
  it("accepts a valid create request and rejects unknown fields usage errors", () => {
    const valid = createExperimentSchema.safeParse({
      problemSlug: "bell-state",
      name: "Cross-version check",
      baselineSubmissionId: "33333333-3333-3333-3333-333333333333",
      candidateEnvironmentIds: ENVIRONMENT_IDS.filter((id) => !ENVIRONMENT_PROFILES.find((p) => p.id === id)?.isDefault),
      policy: "exact",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.policy).toBe("exact");
    }
  });

  it("requires at least one candidate environment and a uuid baseline", () => {
    const noCandidates = createExperimentSchema.safeParse({
      problemSlug: "bell-state",
      name: "x",
      baselineSubmissionId: "33333333-3333-3333-3333-333333333333",
      candidateEnvironmentIds: [],
    });
    expect(noCandidates.success).toBe(false);

    const badBaseline = createExperimentSchema.safeParse({
      problemSlug: "bell-state",
      name: "x",
      baselineSubmissionId: "not-a-uuid",
      candidateEnvironmentIds: ["qiskit-1-2-4"],
    });
    expect(badBaseline.success).toBe(false);

    const badSlug = createExperimentSchema.safeParse({
      problemSlug: "Not A Slug",
      name: "x",
      baselineSubmissionId: "33333333-3333-3333-3333-333333333333",
      candidateEnvironmentIds: ["qiskit-1-2-4"],
    });
    expect(badSlug.success).toBe(false);
  });

  it("accepts only the documented import package shape", () => {
    const good = importPackageSchema.safeParse({
      schemaVersion: "quantoo.experiment.v1",
      kind: "quantoo-experiment",
      experiment: { name: "Imported", policyName: "statistical-default" },
      sourceCode: "from qiskit import QuantumCircuit\nresult = QuantumCircuit(1)",
      candidateEnvironmentIds: [ENVIRONMENT_PROFILES[0].id],
    });
    expect(good.success).toBe(true);

    const wrongVersion = importPackageSchema.safeParse({
      schemaVersion: "quantoo.experiment.v9",
      kind: "quantoo-experiment",
      experiment: {},
      sourceCode: "result = 1",
      candidateEnvironmentIds: [ENVIRONMENT_PROFILES[0].id],
    });
    expect(wrongVersion.success).toBe(false);

    const wrongKind = importPackageSchema.safeParse({
      schemaVersion: "quantoo.experiment.v1",
      kind: "shell-command",
      experiment: {},
      sourceCode: "result = 1",
      candidateEnvironmentIds: [ENVIRONMENT_PROFILES[0].id],
    });
    expect(wrongKind.success).toBe(false);

    const missingSource = importPackageSchema.safeParse({
      schemaVersion: "quantoo.experiment.v1",
      kind: "quantoo-experiment",
      experiment: {},
      candidateEnvironmentIds: [ENVIRONMENT_PROFILES[0].id],
    });
    expect(missingSource.success).toBe(false);

    const oversized = importPackageSchema.safeParse({
      schemaVersion: "quantoo.experiment.v1",
      kind: "quantoo-experiment",
      experiment: {},
      sourceCode: "x = 1\n" + "y = 2\n".repeat(20_000),
      candidateEnvironmentIds: [ENVIRONMENT_PROFILES[0].id],
    });
    expect(oversized.success).toBe(false);
  });

  it("rejects malformed experiment ids", () => {
    expect(experimentIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(
      experimentIdSchema.safeParse("33333333-3333-3333-3333-333333333333").success,
    ).toBe(true);
  });
});
