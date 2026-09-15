/**
 * GET /api/learn/[slug]
 *
 * Get a single learning topic by slug with concepts and problems.
 */

import { NextResponse } from "next/server";
import { getLearningTopicBySlug } from "@/lib/server/learning-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { error: "Invalid topic slug" },
        { status: 400 },
      );
    }

    const topic = await getLearningTopicBySlug(slug);

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ topic });
  } catch (error) {
    console.error("Error fetching topic:", error);
    return NextResponse.json(
      { error: "Failed to load topic" },
      { status: 500 },
    );
  }
}
