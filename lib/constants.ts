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
export const DIFFICULTY_LEVELS = ["beginner", "easy", "medium", "hard", "expert"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/** Problem statuses. */
export const PROBLEM_STATUSES = ["draft", "review", "published", "archived"] as const;
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];

/** Progress statuses. */
export const PROGRESS_STATUSES = ["not_started", "in_progress", "attempted", "solved"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

/** User activity types. */
export const ACTIVITY_TYPES = [
  "problem_attempt",
  "problem_solved",
  "problem_viewed",
  "project_created",
  "project_updated",
  "daily_challenge_attempt",
  "learning_topic_started",
  "learning_topic_completed",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Pagination defaults. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Difficulty display config for UI. */
export const DIFFICULTY_CONFIG: Record<DifficultyLevel, { label: string; color: string }> = {
  beginner: { label: "Beginner", color: "text-emerald-600 dark:text-emerald-400" },
  easy: { label: "Easy", color: "text-blue-600 dark:text-blue-400" },
  medium: { label: "Medium", color: "text-amber-600 dark:text-amber-400" },
  hard: { label: "Hard", color: "text-orange-600 dark:text-orange-400" },
  expert: { label: "Expert", color: "text-red-600 dark:text-red-400" },
};

/** Route paths. */
export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  problems: "/problems",
  problemDetail: (slug: string) => `/problems/${slug}`,
  learn: "/learn",
  learnTopic: (slug: string) => `/learn/${slug}`,
  observatory: "/observatory",
  benchmarks: "/benchmarks",
  projects: "/projects",
  profile: "/profile",
  settings: "/settings",
  settingsSecurity: "/settings/security",
  health: "/api/health",
} as const;
