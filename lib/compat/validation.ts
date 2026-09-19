/**
 * Compatibility lab validation schemas (Phase 7).
 *
 * Server-side validation is authoritative. Compatibility verdicts are
 * never accepted from the client: they are recomputed from persisted
 * execution artifacts by the comparison engine.
 */

import { z } from "zod";

/** Known comparison policies (single source: the comparison engine). */
const policySchema = z.enum(["statistical-default", "exact"]);

const uuidSchema = z.string().uuid("Invalid execution id");

/** Environment ids must exist in the code-defined registry. */
export const environmentIdsSchema = z
  .array(z.string().min(1).max(100))
  .min(1, "Select at least one candidate environment.")
  .max(5, "At most 5 candidate environments are allowed.");

export const createExperimentSchema = z.object({
  problemSlug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid problem identifier"),
  name: z.string().min(1, "Experiment name is required.").max(200),
  baselineSubmissionId: uuidSchema,
  candidateEnvironmentIds: environmentIdsSchema,
  policy: policySchema.default("statistical-default"),
});

export const experimentIdSchema = z.string().uuid("Invalid experiment id");

/**
 * Import package schema: only the documented versioned shape is accepted.
 * Fields outside this schema are stripped; embedded capsules and reports
 * are treated as history, never as instructions.
 */
export const importPackageSchema = z.object({
  schemaVersion: z.literal("quantoo.experiment.v1"),
  kind: z.literal("quantoo-experiment"),
  experiment: z.object({
    name: z.string().min(1).max(200).optional(),
    policyName: policySchema.optional(),
  }),
  sourceCode: z
    .string()
    .min(1, "Package source code is required.")
    .max(50_000, "Package source code is too large."),
  candidateEnvironmentIds: z
    .array(z.string().min(1).max(100))
    .min(1, "Package names no candidate environment.")
    .max(5, "Package names too many candidate environments."),
  baselineEnvironmentId: z.string().min(1).max(100).optional(),
});
