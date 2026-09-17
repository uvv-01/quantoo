/**
 * GET /api/submissions/[submissionId]/debug
 *
 * Debugger payload for one of the authenticated user's own submissions.
 * Ownership is enforced server-side: the session user must own the
 * submission, and a foreign submission is indistinguishable from a
 * missing one (404 for both).
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getDebuggerData } from "@/lib/exec/debugger-service";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { submissionId } = await params;
    const result = await getDebuggerData(user.id, submissionId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      submission: result.payload,
      localization: result.localization,
    });
  } catch (error) {
    logger.error("debugger payload failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load debugger data." },
      { status: 500 },
    );
  }
}
