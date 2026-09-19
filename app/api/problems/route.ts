/**
 * GET /api/problems
 *
 * List problems with filtering, search, and pagination.
 * Returns only published problems.
 */

import { NextResponse } from "next/server";
import { listProblems, listConcepts, listTags, getDifficultyCounts } from "@/lib/server/problem-service";
import { problemListQuerySchema } from "@/lib/validation/problem-validation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Only present query parameters are validated; absent keys fall back
    // to schema defaults. Passing explicit nulls would fail validation.
    const query = problemListQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!query.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: query.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { page, pageSize, difficulty, concept, tag, search } = query.data;

    const [problems, concepts, tags, difficultyCounts] = await Promise.all([
      listProblems({ page, pageSize, difficulty, conceptSlug: concept, tagSlug: tag, search }),
      listConcepts(),
      listTags(),
      getDifficultyCounts(),
    ]);

    return NextResponse.json({
      problems,
      filters: {
        concepts: concepts.map((c) => ({
          name: c.name,
          slug: c.slug,
          category: c.category,
          count: c._count.problems,
        })),
        tags: tags.map((t) => ({
          name: t.name,
          slug: t.slug,
          count: t._count.problems,
        })),
        difficulties: difficultyCounts,
      },
    });
  } catch (error) {
    console.error("Error listing problems:", error);
    return NextResponse.json(
      { error: "Failed to load problems" },
      { status: 500 },
    );
  }
}
