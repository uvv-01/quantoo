import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSessionToken, hashToken } from "@/lib/auth/tokens";

const SESSION_COOKIE_NAME = "quantoo-session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Session cookie configuration.
 * HttpOnly + Secure in production + SameSite=Lax for CSRF protection.
 */
function getSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  };
}

/**
 * Create a new session for a user.
 * Stores the token hash in the database and sets a secure HTTP-only cookie.
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const { raw, hash } = createSessionToken();

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hash,
      ipAddress,
      userAgent,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  const { name, options } = getSessionCookieOptions();
  cookieStore.set(name, raw, options);

  return raw;
}

/**
 * Get the current session from the cookie.
 * Validates the token hash against the database.
 * Returns null if no valid session exists.
 */
export async function getSession(): Promise<{
  userId: string;
  sessionId: string;
} | null> {
  const cookieStore = await cookies();
  const { name } = getSessionCookieOptions();
  const token = cookieStore.get(name)?.value;

  if (!token) return null;

  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Session expired — clean it up
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return { userId: session.userId, sessionId: session.id };
}

/**
 * Get the current authenticated user with profile data.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      profile: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    emailVerified: !!user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    profile: user.profile
      ? {
          username: user.profile.username,
          displayName: user.profile.displayName,
          bio: user.profile.bio,
          avatarUrl: user.profile.avatarUrl,
        }
      : null,
  };
}

/**
 * Destroy the current session (logout).
 * Removes the session from the database and clears the cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const { name } = getSessionCookieOptions();
  const token = cookieStore.get(name)?.value;

  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }

  cookieStore.delete(name);
}

/**
 * Destroy all sessions for a user (logout everywhere).
 */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
