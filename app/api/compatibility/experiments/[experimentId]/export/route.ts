/**
 * GET /api/compatibility/experiments/[experimentId]/export
 *
 * Exports the versioned reproducibility package (quantoo.experiment.v1)
 * for one of the authenticated user's experiments: program source, the
 * baseline execution capsule, the experiment configuration, and the latest
 * compatibility report. Contains technical data only — no secrets, no
 * session data, no other users' information.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { experimentIdSchema } from "@/lib/compat/validation";
import { exportExperimentPackage } from "@/lib/compat/experiment";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { experimentId } = await params;
    const parsed = experimentIdSchema.safeParse(experimentId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid experiment id." }, { status: 400 });
    }

    const result = await exportExperimentPackage(parsed.data, user.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.code });
    }

    return new NextResponse(result.json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="quantoo-experiment.json"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to export the experiment." },
      { status: 500 },
    );
  }
}
