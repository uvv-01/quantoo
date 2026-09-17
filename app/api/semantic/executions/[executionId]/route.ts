/**
 * GET /api/semantic/executions/[executionId]
 *
 * The authenticated user's semantic record for one of their own
 * executions. Ownership is enforced by user-id lookup: other users'
 * executions are indistinguishable from nonexistent ones (404).
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { loadSemanticRecord } from "@/lib/semantic/service";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { executionId } = await params;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        executionId,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid execution id." },
        { status: 400 },
      );
    }

    const loaded = await loadSemanticRecord(user.id, executionId);
    if (!loaded) {
      return NextResponse.json(
        { error: "Execution not found or has no comparable artifact." },
        { status: 404 },
      );
    }

    return NextResponse.json({ record: loaded.record });
  } catch (error) {
    logger.error("semantic record request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load the semantic record." },
      { status: 500 },
    );
  }
}
