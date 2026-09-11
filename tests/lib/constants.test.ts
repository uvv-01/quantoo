import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_DESCRIPTION,
  QUANTUM_LANGUAGES,
  DIFFICULTY_LEVELS,
  PROBLEM_STATUSES,
  ACTIVITY_TYPES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ROUTES,
} from "@/lib/constants";

describe("Constants", () => {
  it("has correct app name", () => {
    expect(APP_NAME).toBe("Quantum Daily");
  });

  it("has non-empty description", () => {
    expect(APP_DESCRIPTION.length).toBeGreaterThan(0);
  });

  it("defines quantum languages", () => {
    expect(QUANTUM_LANGUAGES).toContain("python");
  });

  it("defines difficulty levels", () => {
    expect(DIFFICULTY_LEVELS).toContain("beginner");
    expect(DIFFICULTY_LEVELS).toContain("expert");
  });

  it("defines problem statuses", () => {
    expect(PROBLEM_STATUSES).toContain("draft");
    expect(PROBLEM_STATUSES).toContain("published");
  });

  it("defines activity types", () => {
    expect(ACTIVITY_TYPES).toContain("problem_attempt");
    expect(ACTIVITY_TYPES).toContain("problem_solved");
  });

  it("has valid pagination defaults", () => {
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(MAX_PAGE_SIZE).toBeGreaterThanOrEqual(DEFAULT_PAGE_SIZE);
  });

  it("defines all routes", () => {
    expect(ROUTES.home).toBe("/");
    expect(ROUTES.dashboard).toBe("/dashboard");
    expect(ROUTES.problems).toBe("/problems");
    expect(ROUTES.learn).toBe("/learn");
    expect(ROUTES.projects).toBe("/projects");
    expect(ROUTES.profile).toBe("/profile");
    expect(ROUTES.settings).toBe("/settings");
    expect(ROUTES.settingsSecurity).toBe("/settings/security");
    expect(ROUTES.health).toBe("/api/health");
  });

  it("generates dynamic route paths", () => {
    expect(ROUTES.problemDetail("my-problem")).toBe("/problems/my-problem");
  });
});
