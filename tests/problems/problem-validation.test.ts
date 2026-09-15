import { describe, it, expect } from "vitest";
import {
  problemListQuerySchema,
  problemSlugParamSchema,
  problemAttemptSchema,
  problemSolveSchema,
} from "@/lib/validation/problem-validation";

describe("Problem List Query Schema", () => {
  it("accepts empty query with defaults", () => {
    const result = problemListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("parses page and pageSize", () => {
    const result = problemListQuerySchema.safeParse({
      page: "2",
      pageSize: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("rejects page 0", () => {
    const result = problemListQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects pageSize above 100", () => {
    const result = problemListQuerySchema.safeParse({ pageSize: "200" });
    expect(result.success).toBe(false);
  });

  it("accepts valid difficulty", () => {
    const result = problemListQuerySchema.safeParse({
      difficulty: "BEGINNER",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difficulty).toBe("BEGINNER");
    }
  });

  it("rejects invalid difficulty", () => {
    const result = problemListQuerySchema.safeParse({
      difficulty: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("accepts search query", () => {
    const result = problemListQuerySchema.safeParse({ search: "bell state" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.search).toBe("bell state");
    }
  });

  it("accepts concept and tag filters", () => {
    const result = problemListQuerySchema.safeParse({
      concept: "superposition",
      tag: "gates",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concept).toBe("superposition");
      expect(result.data.tag).toBe("gates");
    }
  });
});

describe("Problem Slug Param Schema", () => {
  it("accepts valid slug", () => {
    const result = problemSlugParamSchema.safeParse({ slug: "bell-state" });
    expect(result.success).toBe(true);
  });

  it("accepts slug with numbers", () => {
    const result = problemSlugParamSchema.safeParse({
      slug: "problem-1-quantum",
    });
    expect(result.success).toBe(true);
  });

  it("rejects slug with uppercase", () => {
    const result = problemSlugParamSchema.safeParse({ slug: "Bell-State" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = problemSlugParamSchema.safeParse({ slug: "bell state" });
    expect(result.success).toBe(false);
  });

  it("rejects empty slug", () => {
    const result = problemSlugParamSchema.safeParse({ slug: "" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with special characters", () => {
    const result = problemSlugParamSchema.safeParse({
      slug: "bell@state!",
    });
    expect(result.success).toBe(false);
  });
});

describe("Problem Attempt Schema", () => {
  it("accepts valid attempt", () => {
    const result = problemAttemptSchema.safeParse({
      problemId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts attempt with timeMs", () => {
    const result = problemAttemptSchema.safeParse({
      problemId: "550e8400-e29b-41d4-a716-446655440000",
      timeMs: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = problemAttemptSchema.safeParse({ problemId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects negative timeMs", () => {
    const result = problemAttemptSchema.safeParse({
      problemId: "550e8400-e29b-41d4-a716-446655440000",
      timeMs: -100,
    });
    expect(result.success).toBe(false);
  });
});

describe("Problem Solve Schema", () => {
  it("accepts valid solve", () => {
    const result = problemSolveSchema.safeParse({
      problemId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts solve with timeMs", () => {
    const result = problemSolveSchema.safeParse({
      problemId: "550e8400-e29b-41d4-a716-446655440000",
      timeMs: 12000,
    });
    expect(result.success).toBe(true);
  });
});
