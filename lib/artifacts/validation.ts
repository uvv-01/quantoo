/**
 * Artifact validation (untrusted input path).
 *
 * Imported artifact exports are data, never instructions: validation is
 * structural with hard size/depth caps, and importing never executes
 * code, installs dependencies, or fetches remote resources.
 */

import { z } from "zod";
import { MAX_ARTIFACT_BYTES } from "@/lib/artifacts/service";
import { verifyHash } from "@/lib/artifacts/integrity";

// ========================================
// API request schemas
// ========================================

export const publishArtifactSchema = z.object({
  experimentId: z.string().uuid("Invalid experiment id"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
});

export const artifactIdSchema = z.string().uuid("Invalid artifact id");

export const artifactVersionSchema = z.object({
  artifactId: z.string().uuid("Invalid artifact id"),
  version: z.coerce.number().int().positive().max(10_000),
});

export const artifactVersionNumberSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(10_000, "Invalid version.");

export const artifactVisibilitySchema = z.object({
  visibility: z.enum(["PRIVATE", "PUBLIC"]),
});

// ========================================
// Import (untrusted)
// ========================================

/** Recursive depth guard for arbitrary nested JSON. */
function assertDepth(value: unknown, maxDepth: number, current = 0): void {
  if (current > maxDepth) {
    throw new Error("Artifact JSON exceeds the maximum nesting depth.");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertDepth(item, maxDepth, current + 1);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      assertDepth(item, maxDepth, current + 1);
    }
  }
}

/**
 * Structural schema for the evidence section. Embedded capsules and
 * reports are treated as opaque bounded JSON — they were validated by
 * their own engines at production time and are preserved verbatim here.
 */
const boundedJsonSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(200_000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(boundedJsonSchema).max(500),
    // Record breadth is bounded by the depth guard and the overall byte
    // cap; this zod version does not expose .max() on record schemas.
    z.record(z.string(), boundedJsonSchema),
  ]),
);

const importSchema = z.object({
  schemaVersion: z.literal("quantoo.artifact.v1"),
  kind: z.literal("quantoo-artifact"),
  exportedAt: z.string().max(64),
  documentHash: z.string().length(64, "Integrity hash has an unexpected length."),
  document: z.object({
    schemaVersion: z.literal("quantoo.artifact.v1"),
    artifactType: z.literal("COMPATIBILITY_EXPERIMENT"),
    title: z.string().min(1).max(200),
    description: z.string().max(2_000).nullable(),
    provenance: z.object({
      createdBy: z.string().max(200),
      createdAt: z.string().max(64),
      problem: z
        .object({
          slug: z.string().max(200).nullable(),
          title: z.string().max(300).nullable(),
        })
        .nullable(),
      sourceExperimentId: z.string().max(128).nullable(),
    }),
    source: z.object({
      sourceCode: z.string().max(100_000),
      language: z.string().max(32),
      shots: z.number().int().nonnegative().nullable(),
      seed: z.number().int().nonnegative().nullable(),
      policyName: z.string().max(64).nullable(),
    }),
    evidence: z.object({
      capsules: z
        .array(
          z.object({
            role: z.enum(["BASELINE", "CANDIDATE"]),
            environmentId: z.string().max(64).nullable(),
            capsule: boundedJsonSchema,
          }),
        )
        .max(8),
      compatibilityReport: boundedJsonSchema.nullable(),
      reproductions: z
        .array(
          z.object({
            originalSubmissionId: z.string().max(64),
            reproductionSubmissionId: z.string().max(64),
            overallStatus: z.string().max(64),
            report: boundedJsonSchema,
          }),
        )
        .max(20),
    }),
  }),
});

export interface ImportedArtifact {
  document: import("@/lib/artifacts/types").ResearchArtifactDocument;
  /** True when the embedded hash matched the canonical document. */
  integrityVerified: boolean;
}

/**
 * Validate an untrusted artifact export string. Throws with a safe
 * message on any structural violation; verifies the embedded integrity
 * hash and reports the result explicitly instead of guessing.
 */
export function validateArtifactExport(json: string): ImportedArtifact {
  if (Buffer.byteLength(json, "utf8") > MAX_ARTIFACT_BYTES) {
    throw new Error("Artifact is too large.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Artifact is not valid JSON.");
  }
  assertDepth(parsed, 24);

  const result = importSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Artifact structure is invalid.");
  }

  const integrityVerified = verifyHash(result.data.document, result.data.documentHash);
  return {
    document: result.data.document as import("@/lib/artifacts/types").ResearchArtifactDocument,
    integrityVerified,
  };
}
