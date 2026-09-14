import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 * Destroy the current session and clear the cookie.
 */
export async function POST() {
  await destroySession();
  return NextResponse.json({ message: "Logged out successfully." });
}
