/**
 * Project API validation schemas.
 */

import { z } from "zod";

export const projectIdSchema = z.string().uuid("Invalid project id");

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(120, "Project name is too long"),
  description: z.string().trim().max(2_000, "Description is too long").optional(),
});

export const addItemSchema = z.object({
  itemType: z.enum(["PROBLEM", "SUBMISSION", "COMPATIBILITY_EXPERIMENT", "RESEARCH_ARTIFACT"]),
  itemId: z.string().uuid("Invalid item reference"),
  note: z.string().trim().max(500).optional(),
});
