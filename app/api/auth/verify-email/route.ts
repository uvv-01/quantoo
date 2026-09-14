import { NextResponse } from "next/server";
import { verifyEmail } from "@/lib/auth/service";

/**
 * GET /api/auth/verify-email?token=...
 * Verify a user's email address using the token from the verification email.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Verification token is required." },
      { status: 400 },
    );
  }

  const result = await verifyEmail(token);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: "Email verified successfully. You can now log in.",
  });
}
