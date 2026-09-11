/**
 * Application constants for Quantum Daily.
 *
 * Centralize values that may change across environments
 * or that need to be shared across client and server code.
 */

export const APP_NAME = "Quantum Daily";
export const APP_DESCRIPTION = "Practice quantum computing like an engineer";

/** Maximum file upload size in bytes (for future code submissions). */
export const MAX_SUBMISSION_SIZE = 1024 * 100; // 100KB

/** Supported quantum programming languages. */
export const QUANTUM_LANGUAGES = ["python"] as const;
export type QuantumLanguage = (typeof QUANTUM_LANGUAGES)[number];

/** Problem difficulty levels. */
export const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/** Problem statuses. */
export const PROBLEM_STATUSES = ["draft", "published", "archived"] as const;
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];

/** User activity types. */
export const ACTIVITY_TYPES = [
  "problem_attempt",
  "problem_solved",
  "project_created",
  "project_updated",
  "daily_challenge_attempt",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Pagination defaults. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Route paths. */
export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  problems: "/problems",
  problemDetail: (slug: string) => `/problems/${slug}`,
  learn: "/learn",
  projects: "/projects",
  profile: "/profile",
  settings: "/settings",
  settingsSecurity: "/settings/security",
  health: "/api/health",
} as const;
