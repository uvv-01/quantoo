import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware — Route Protection
 *
 * Runs on every matched request. Checks for valid session cookies
 * and redirects unauthenticated users away from protected routes.
 *
 * This is a lightweight check using the cookie token hash.
 * Full session validation happens in server components and API routes.
 */

const SESSION_COOKIE = "quantoo-session";

const protectedRoutes = ["/dashboard", "/settings", "/profile", "/projects"];

const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

function isAuthRoute(pathname: string): boolean {
  return authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  // For protected routes, check if session token exists
  // (Full validation happens server-side; this is a fast redirect check)
  if (isProtectedRoute(pathname) && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For auth routes, redirect to dashboard if already logged in
  // This prevents logged-in users from seeing login/signup pages
  if (isAuthRoute(pathname) && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/projects/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
