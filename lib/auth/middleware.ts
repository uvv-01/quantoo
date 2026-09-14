import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * Middleware helper to check if a request is authenticated.
 * Use in Next.js middleware or in route handlers.
 */

/**
 * Check if the current request has a valid session.
 * Returns the session if authenticated, null otherwise.
 */
export async function requireAuth() {
  const session = await getSession();
  return session;
}

/**
 * Middleware function for Next.js middleware.ts.
 * Protects routes that require authentication.
 */
export async function authMiddleware(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    // Redirect to login with the original URL as callback
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Check if a route requires authentication.
 * Used in the middleware matcher configuration.
 */
const protectedRoutes = ["/dashboard", "/settings", "/profile", "/projects"];

const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

export function isAuthRoute(pathname: string): boolean {
  return authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}
