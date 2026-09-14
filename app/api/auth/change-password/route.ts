import { NextResponse } from "next/server";
import { changePasswordSchema } from "@/lib/auth/validation";
import { changePassword } from "@/lib/auth/service";
import { getSession } from "@/lib/auth/session";

/**
 * POST /api/auth/change-password
 * Change the current user's password.
 * Requires authentication.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
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

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const result = await changePassword(
    session.userId,
    currentPassword,
    newPassword,
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: "Password changed successfully.",
  });
}
