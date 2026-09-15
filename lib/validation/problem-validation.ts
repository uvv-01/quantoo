/**
 * Problem & Progress Validation Schemas
 *
 * Zod schemas for validating API route inputs (query params, request bodies).
 * Server-side validation is authoritative.
 */

import { z } from "zod";

// ========================================
// Problem List Query
// ========================================

export const problemListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  difficulty: z
    .enum(["BEGINNER", "EASY", "MEDIUM", "HARD", "EXPERT"])
    .optional(),
  concept: z.string().min(1).max(100).optional(),
  tag: z.string().min(1).max(100).optional(),
  search: z.string().min(1).max(200).optional(),
});

export type ProblemListQuery = z.infer<typeof problemListQuerySchema>;

// ========================================
// Problem Slug Param
// ========================================

export const problemSlugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
});

export type ProblemSlugParam = z.infer<typeof problemSlugParamSchema>;

// ========================================
// Problem Attempt Body
// ========================================

export const problemAttemptSchema = z.object({
  problemId: z.string().uuid("Invalid problem ID"),
  timeMs: z.number().int().min(0).optional(),
});

export type ProblemAttemptInput = z.infer<typeof problemAttemptSchema>;

// ========================================
// Problem Solve Body
// ========================================

export const problemSolveSchema = z.object({
  problemId: z.string().uuid("Invalid problem ID"),
  timeMs: z.number().int().min(0).optional(),
});

export type ProblemSolveInput = z.infer<typeof problemSolveSchema>;
