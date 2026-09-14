import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth/validation";
import { login } from "@/lib/auth/service";
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitKey,
} from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/login
 * Authenticate user and create a session.
 */
export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  // Rate limit check
  const rlKey = getRateLimitKey(ipAddress, "login");
  const rl = checkRateLimit(rlKey, RATE_LIMITS.login);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const result = await login(email, password, { ipAddress, userAgent });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({ message: "Logged in successfully." });
}
