/**
 * GET /api/problems/[slug]
 *
 * Get a single problem by slug with full detail.
 * Only returns published problems.
 */

import { NextResponse } from "next/server";
import { getProblemBySlug } from "@/lib/server/problem-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { error: "Invalid problem slug" },
        { status: 400 },
      );
    }

    const problem = await getProblemBySlug(slug);

    if (!problem) {
      return NextResponse.json(
        { error: "Problem not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ problem });
  } catch (error) {
    console.error("Error fetching problem:", error);
    return NextResponse.json(
      { error: "Failed to load problem" },
      { status: 500 },
    );
  }
}
