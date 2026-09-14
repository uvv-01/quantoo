import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";

/**
 * GET /api/auth/me
 * Get the currently authenticated user's profile.
 * Returns 401 if not authenticated.
 */
export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 },
    );
  }

  return NextResponse.json({ user });
}
