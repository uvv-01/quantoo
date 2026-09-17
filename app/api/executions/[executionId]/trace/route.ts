/**
 * GET /api/executions/[executionId]/trace
 *
 * Gate-level execution trace for one of the authenticated user's own
 * executions (submissions). Execution ids are submission ids in the
 * current architecture; the alias exists so future execution records can
 * be introduced without changing the debugger contract.
 *
 * Ownership is enforced server-side; a foreign execution is a 404.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getDebuggerData } from "@/lib/exec/debugger-service";
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
    const result = await getDebuggerData(user.id, executionId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const submission = result.payload.outcomes["submission"] ?? null;
    return NextResponse.json({
      executionId: result.payload.submissionId,
      status: result.payload.status,
      trace: submission?.trace ?? null,
      policy: submission?.trace?.policy ?? null,
      traceAvailability: result.payload.traceAvailability,
    });
  } catch (error) {
    logger.error("trace payload failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load trace data." },
      { status: 500 },
    );
  }
}
