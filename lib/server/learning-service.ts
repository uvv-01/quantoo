/**
 * Learning Service
 *
 * Server-side service for managing learning topics and their relationships
 * to concepts and problems.
 */

import { prisma } from "@/lib/prisma";

// ========================================
// Types
// ========================================

export interface LearningTopicListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
  problemCount: number;
  conceptCount: number;
}

export interface LearningTopicDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
  concepts: { name: string; slug: string; description: string | null }[];
  problems: {
    id: string;
    slug: string;
    title: string;
    shortDescription: string;
    difficulty: string;
    estimatedMinutes: number | null;
    sortOrder: number;
  }[];
}

// ========================================
// Service Functions
// ========================================

/**
 * List all learning topics ordered by category and sort order.
 */
export async function listLearningTopics(): Promise<LearningTopicListItem[]> {
  const topics = await prisma.learningTopic.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category: true,
      sortOrder: true,
      _count: {
        select: {
          problems: true,
          concepts: true,
        },
      },
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return topics.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    description: t.description,
    category: t.category,
    sortOrder: t.sortOrder,
    problemCount: t._count.problems,
    conceptCount: t._count.concepts,
  }));
}

/**
 * Get a single learning topic by slug with its concepts and problems.
 */
export async function getLearningTopicBySlug(
  slug: string,
): Promise<LearningTopicDetail | null> {
  const topic = await prisma.learningTopic.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category: true,
      sortOrder: true,
      concepts: {
        select: {
          concept: {
            select: {
              name: true,
              slug: true,
              description: true,
            },
          },
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      problems: {
        select: {
          problem: {
            select: {
              id: true,
              slug: true,
              title: true,
              shortDescription: true,
              difficulty: true,
              estimatedMinutes: true,
            },
          },
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!topic) return null;

  return {
    ...topic,
    concepts: topic.concepts.map((c) => c.concept),
    problems: topic.problems.map((p) => ({
      ...p.problem,
      sortOrder: p.sortOrder,
    })),
  };
}
