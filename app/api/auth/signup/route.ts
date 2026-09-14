import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/auth/validation";
import { signup } from "@/lib/auth/service";
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitKey,
} from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/signup
 * Register a new user account.
 */
export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  // Rate limit check
  const rlKey = getRateLimitKey(ipAddress, "signup");
  const rl = checkRateLimit(rlKey, RATE_LIMITS.signup);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again later." },
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

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const result = await signup(email, password, { ipAddress, userAgent });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(
    {
      message:
        "Account created! Please check your email to verify your account.",
      userId: result.userId,
    },
    { status: 201 },
  );
}
