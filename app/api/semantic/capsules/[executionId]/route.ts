/**
 * GET /api/semantic/capsules/[executionId]
 *
 * Export the authenticated user's execution capsule for one of their own
 * executions. The capsule is a versioned JSON artifact containing
 * technical data only — source code of the user's own run, canonical
 * circuit, configuration, semantic record, environment, judge result,
 * and trace. No secrets, no other users' data.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { buildExecutionCapsule, serializeCapsule } from "@/lib/semantic/capsule";
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

    const capsule = await buildExecutionCapsule(executionId);
    if (!capsule) {
      return NextResponse.json(
        { error: "Execution not found or has no exportable artifact." },
        { status: 404 },
      );
    }
    if (capsule.semanticRecord && capsule.semanticRecord.userId !== user.id) {
      // Foreign execution: indistinguishable from nonexistent.
      return NextResponse.json(
        { error: "Execution not found or has no exportable artifact." },
        { status: 404 },
      );
    }

    const json = serializeCapsule(capsule);
    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="quantoo-capsule-${capsule.submissionId}.json"`,
      },
    });
  } catch (error) {
    logger.error("capsule export failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to export the execution capsule." },
      { status: 500 },
    );
  }
}
