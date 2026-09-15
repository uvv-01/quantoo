/**
 * GET /api/learn
 *
 * List all learning topics with concept and problem counts.
 */

import { NextResponse } from "next/server";
import { listLearningTopics } from "@/lib/server/learning-service";

export async function GET() {
  try {
    const topics = await listLearningTopics();
    return NextResponse.json({ topics });
  } catch (error) {
    console.error("Error listing learning topics:", error);
    return NextResponse.json(
      { error: "Failed to load learning topics" },
      { status: 500 },
    );
  }
}
