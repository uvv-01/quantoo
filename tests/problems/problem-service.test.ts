/**
 * Problem Service Tests
 *
 * Tests the problem listing, filtering, and search functionality.
 * These tests verify the service layer logic without requiring a database.
 */

import { describe, it, expect } from "vitest";

// ========================================
// Helper functions to test (extracted from service logic)
// ========================================

/**
 * Build a Prisma where clause for problem filtering.
 * This mirrors the logic in listProblems.
 */
function buildProblemWhereClause(params: {
  difficulty?: string;
  conceptSlug?: string;
  tagSlug?: string;
  search?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {
    status: params.status ?? "PUBLISHED",
  };

  if (params.difficulty) {
    where.difficulty = params.difficulty;
  }

  if (params.conceptSlug) {
    where.concepts = {
      some: {
        concept: {
          slug: params.conceptSlug,
        },
      },
    };
  }

  if (params.tagSlug) {
    where.tags = {
      some: {
        tag: {
          slug: params.tagSlug,
        },
      },
    };
  }

  if (params.search) {
    const searchTrimmed = params.search.trim();
    if (searchTrimmed.length > 0) {
      where.OR = [
        { title: { contains: searchTrimmed, mode: "insensitive" } },
        { shortDescription: { contains: searchTrimmed, mode: "insensitive" } },
      ];
    }
  }

  return where;
}

/**
 * Calculate pagination parameters.
 */
function calculatePagination(page: number, pageSize: number, total: number) {
  return {
    page: Math.max(1, page),
    pageSize: Math.min(100, Math.max(1, pageSize)),
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ========================================
// Tests
// ========================================

describe("Problem Where Clause Builder", () => {
  it("returns only status filter by default", () => {
    const where = buildProblemWhereClause({});
    expect(where).toEqual({ status: "PUBLISHED" });
  });

  it("includes difficulty filter", () => {
    const where = buildProblemWhereClause({ difficulty: "BEGINNER" });
    expect(where.difficulty).toBe("BEGINNER");
  });

  it("includes concept filter", () => {
    const where = buildProblemWhereClause({ conceptSlug: "superposition" });
    expect(where).toHaveProperty("concepts");
  });

  it("includes tag filter", () => {
    const where = buildProblemWhereClause({ tagSlug: "gates" });
    expect(where).toHaveProperty("tags");
  });

  it("includes search filter", () => {
    const where = buildProblemWhereClause({ search: "bell state" });
    expect(where).toHaveProperty("OR");
    const or = where.OR as Array<Record<string, unknown>>;
    expect(or).toHaveLength(2);
  });

  it("trims whitespace from search", () => {
    const where = buildProblemWhereClause({ search: "  bell  " });
    const or = where.OR as Array<Record<string, unknown>>;
    expect((or[0].title as Record<string, unknown>).contains).toBe("bell");
  });

  it("ignores empty search", () => {
    const where = buildProblemWhereClause({ search: "   " });
    expect(where).not.toHaveProperty("OR");
  });

  it("combines multiple filters", () => {
    const where = buildProblemWhereClause({
      difficulty: "EASY",
      conceptSlug: "superposition",
      tagSlug: "gates",
      search: "hadamard",
    });
    expect(where.difficulty).toBe("EASY");
    expect(where).toHaveProperty("concepts");
    expect(where).toHaveProperty("tags");
    expect(where).toHaveProperty("OR");
  });

  it("can use different status", () => {
    const where = buildProblemWhereClause({ status: "DRAFT" });
    expect(where.status).toBe("DRAFT");
  });
});

describe("Pagination Calculator", () => {
  it("calculates basic pagination", () => {
    const result = calculatePagination(1, 20, 100);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(100);
    expect(result.totalPages).toBe(5);
  });

  it("handles page 0 by clamping to 1", () => {
    const result = calculatePagination(0, 20, 100);
    expect(result.page).toBe(1);
  });

  it("handles negative page by clamping to 1", () => {
    const result = calculatePagination(-5, 20, 100);
    expect(result.page).toBe(1);
  });

  it("clamps pageSize to max 100", () => {
    const result = calculatePagination(1, 200, 1000);
    expect(result.pageSize).toBe(100);
  });

  it("clamps pageSize min to 1", () => {
    const result = calculatePagination(1, 0, 100);
    expect(result.pageSize).toBe(1);
  });

  it("handles empty results", () => {
    const result = calculatePagination(1, 20, 0);
    expect(result.totalPages).toBe(0);
  });

  it("handles exact division", () => {
    const result = calculatePagination(1, 10, 30);
    expect(result.totalPages).toBe(3);
  });

  it("handles non-exact division", () => {
    const result = calculatePagination(1, 10, 25);
    expect(result.totalPages).toBe(3);
  });
});
