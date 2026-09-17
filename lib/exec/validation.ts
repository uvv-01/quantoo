/**
 * Execution & draft validation schemas.
 *
 * Server-side validation is authoritative. Limits enforced here mirror
 * lib/exec/limits.ts so that oversized or malformed requests are rejected
 * before reaching the sandbox.
 */

import { z } from "zod";

/** Maximum source code size (matches EXEC_MAX_SOURCE_BYTES default). */
export const MAX_SOURCE_BYTES = 50_000;

export const runRequestSchema = z.object({
  problemSlug: z
    .string()
    .min(1, "Problem is required")
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid problem identifier"),
  sourceCode: z
    .string()
    .min(1, "Source code is required")
    .refine(
      (code) => Buffer.byteLength(code, "utf8") <= MAX_SOURCE_BYTES,
      "Source code is too large",
    ),
  language: z.enum(["python"]).default("python"),
  shots: z
    .number()
    .int()
    .min(1)
    .max(10_000, "Shot count exceeds the allowed maximum")
    .default(4_096),
});

export type RunRequest = z.infer<typeof runRequestSchema>;

export const saveDraftSchema = z.object({
  problemSlug: z
    .string()
    .min(1, "Problem is required")
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid problem identifier"),
  sourceCode: z
    .string()
    .refine(
      (code) => Buffer.byteLength(code, "utf8") <= MAX_SOURCE_BYTES,
      "Source code is too large",
    ),
});

export type SaveDraftRequest = z.infer<typeof saveDraftSchema>;

export const submissionQuerySchema = z.object({
  problemSlug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid problem identifier"),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type SubmissionQuery = z.infer<typeof submissionQuerySchema>;
