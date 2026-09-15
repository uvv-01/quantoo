/**
 * GET /api/progress
 *
 * Get the current user's problem progress summary.
 * Requires authentication.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getUserProblemProgress,
  getProgressSummary,
} from "@/lib/server/progress-service";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const [progress, summary] = await Promise.all([
      getUserProblemProgress(user.id),
      getProgressSummary(user.id),
    ]);

    return NextResponse.json({ progress, summary });
  } catch (error) {
    console.error("Error fetching progress:", error);
    return NextResponse.json(
      { error: "Failed to load progress" },
      { status: 500 },
    );
  }
}
