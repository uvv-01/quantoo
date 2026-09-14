import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { resetPassword } from "@/lib/auth/service";
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitKey,
} from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/reset-password
 * Reset a user's password using a valid reset token.
 */
export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit check
  const rlKey = getRateLimitKey(ipAddress, "reset-password");
  const rl = checkRateLimit(rlKey, RATE_LIMITS.resetPassword);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please request a new reset link." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const result = await resetPassword(token, password);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: "Password reset successfully. Please log in with your new password.",
  });
}
