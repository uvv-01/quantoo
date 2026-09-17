/**
 * Semantic observatory validation schemas (Phase 6).
 *
 * Server-side validation is authoritative. Every semantic API endpoint
 * validates input here; client-supplied verdicts are never accepted —
 * comparison, reproduction, and regression results are always recomputed
 * from persisted execution artifacts.
 */

import { z } from "zod";

/** Known comparison policies (validated against the engine's registry). */
const policySchema = z.enum(["statistical-default", "exact"]);

const uuidSchema = z.string().uuid("Invalid execution id");

export const compareRequestSchema = z
  .object({
    submissionIdA: uuidSchema,
    submissionIdB: uuidSchema,
    policy: policySchema.default("statistical-default"),
  })
  .refine((data) => data.submissionIdA !== data.submissionIdB, {
    message: "An execution cannot be compared with itself.",
  });

export const reproduceRequestSchema = z.object({
  submissionId: uuidSchema,
  policy: policySchema.default("statistical-default"),
});

export const setBaselineRequestSchema = z.object({
  problemSlug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid problem identifier"),
  submissionId: uuidSchema,
  policy: policySchema.default("statistical-default"),
  note: z.string().max(500).optional(),
});

export const baselineQuerySchema = z.object({
  problemSlug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid problem identifier"),
});

export const executionsQuerySchema = z.object({
  problemSlug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid problem identifier"),
});

export const capsuleIdSchema = z.string().uuid("Invalid execution id");
