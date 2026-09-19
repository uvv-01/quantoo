/**
 * GET /api/compatibility/environments
 *
 * Lists the deployment's registered execution environments with their
 * measured availability. Availability is probed, never assumed: a profile
 * whose runtime image has not been built is reported UNAVAILABLE with the
 * measured reason.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listEnvironmentDescriptors } from "@/lib/compat/environments";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const environments = await listEnvironmentDescriptors();
    return NextResponse.json({ environments });
  } catch {
    return NextResponse.json(
      { error: "Unable to list environments." },
      { status: 500 },
    );
  }
}
