/**
 * Problem Service
 *
 * Server-side service for managing quantum problems.
 * Handles CRUD, search, filtering, pagination, and publication lifecycle.
 */

import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";
import type {
  ProblemDifficulty,
  ProblemStatus,
  Prisma,
} from "@prisma/client";

// ========================================
// Types
// ========================================

export interface ProblemListItem {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  difficulty: ProblemDifficulty;
  status: ProblemStatus;
  estimatedMinutes: number | null;
  publishedAt: Date | null;
  concepts: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
}

export interface ProblemDetail {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  difficulty: ProblemDifficulty;
  status: ProblemStatus;
  estimatedMinutes: number | null;
  prerequisites: string | null;
  learningObjectives: string | null;
  hints: Prisma.JsonValue;
  solutionExplanation: Prisma.JsonValue;
  requirements: Prisma.JsonValue;
  expectedOutcome: Prisma.JsonValue;
  testSpecification: Prisma.JsonValue;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  concepts: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  relatedProblems: {
    relationType: string;
    problem: {
      id: string;
      slug: string;
      title: string;
      shortDescription: string;
      difficulty: ProblemDifficulty;
    };
  }[];
}

export interface ProblemListParams {
  page?: number;
  pageSize?: number;
  difficulty?: ProblemDifficulty;
  conceptSlug?: string;
  tagSlug?: string;
  search?: string;
  status?: ProblemStatus;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ========================================
// Service Functions
// ========================================

/**
 * List problems with filtering, search, and pagination.
 * Only returns published problems for public use.
 */
export async function listProblems(
  params: ProblemListParams = {},
): Promise<PaginatedResult<ProblemListItem>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const status = params.status ?? "PUBLISHED";

  const where: Prisma.ProblemWhereInput = {
    status,
  };

  // Difficulty filter
  if (params.difficulty) {
    where.difficulty = params.difficulty;
  }

  // Concept filter
  if (params.conceptSlug) {
    where.concepts = {
      some: {
        concept: {
          slug: params.conceptSlug,
        },
      },
    };
  }

  // Tag filter
  if (params.tagSlug) {
    where.tags = {
      some: {
        tag: {
          slug: params.tagSlug,
        },
      },
    };
  }

  // Search across title, shortDescription
  if (params.search) {
    const searchTrimmed = params.search.trim();
    if (searchTrimmed.length > 0) {
      where.OR = [
        { title: { contains: searchTrimmed, mode: "insensitive" } },
        { shortDescription: { contains: searchTrimmed, mode: "insensitive" } },
      ];
    }
  }

  const [items, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        difficulty: true,
        status: true,
        estimatedMinutes: true,
        publishedAt: true,
        concepts: {
          select: {
            concept: {
              select: { name: true, slug: true },
            },
          },
        },
        tags: {
          select: {
            tag: {
              select: { name: true, slug: true },
            },
          },
        },
      },
      orderBy: [{ difficulty: "asc" }, { title: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.problem.count({ where }),
  ]);

  const mapped = items.map((p) => ({
    ...p,
    concepts: p.concepts.map((c) => c.concept),
    tags: p.tags.map((t) => t.tag),
  }));

  return {
    items: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get a single problem by slug with full detail.
 * Only returns published problems for public access.
 */
export async function getProblemBySlug(
  slug: string,
): Promise<ProblemDetail | null> {
  const problem = await prisma.problem.findUnique({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      description: true,
      difficulty: true,
      status: true,
      estimatedMinutes: true,
      prerequisites: true,
      learningObjectives: true,
      hints: true,
      solutionExplanation: true,
      requirements: true,
      expectedOutcome: true,
      testSpecification: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      concepts: {
        select: {
          concept: {
            select: { name: true, slug: true },
          },
        },
      },
      tags: {
        select: {
          tag: {
            select: { name: true, slug: true },
          },
        },
      },
      relatedFrom: {
        select: {
          type: true,
          toProblem: {
            select: {
              id: true,
              slug: true,
              title: true,
              shortDescription: true,
              difficulty: true,
            },
          },
        },
      },
    },
  });

  if (!problem) return null;

  return {
    ...problem,
    concepts: problem.concepts.map((c) => c.concept),
    tags: problem.tags.map((t) => t.tag),
    relatedProblems: problem.relatedFrom.map((r) => ({
      relationType: r.type,
      problem: r.toProblem,
    })),
  };
}

/**
 * Get a problem by ID (for internal use, e.g. progress tracking).
 * Returns the problem regardless of status.
 */
export async function getProblemById(id: string) {
  return prisma.problem.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      status: true,
    },
  });
}

/**
 * Get all available concepts for filtering.
 */
export async function listConcepts() {
  return prisma.concept.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      _count: {
        select: {
          problems: {
            where: {
              problem: { status: "PUBLISHED" },
            },
          },
        },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

/**
 * Get all available tags for filtering.
 */
export async function listTags() {
  return prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          problems: {
            where: {
              problem: { status: "PUBLISHED" },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Get available difficulties with problem counts.
 */
export async function getDifficultyCounts() {
  const counts = await prisma.problem.groupBy({
    by: ["difficulty"],
    where: { status: "PUBLISHED" },
    _count: true,
  });

  return counts.map((c) => ({
    difficulty: c.difficulty,
    count: c._count,
  }));
}
