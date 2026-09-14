import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { resendVerification } from "@/lib/auth/service";
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitKey,
} from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/resend-verification
 * Resend the email verification link.
 */
export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit check
  const rlKey = getRateLimitKey(ipAddress, "resend-verification");
  const rl = checkRateLimit(rlKey, RATE_LIMITS.resendVerification);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many requests. Please wait before requesting another verification email.",
      },
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

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const result = await resendVerification(parsed.data.email, { ipAddress });

  return NextResponse.json({ message: result.message });
}
