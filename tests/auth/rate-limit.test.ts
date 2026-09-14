import { describe, it, expect } from "vitest";
import {
  checkRateLimit,
  RATE_LIMITS,
  getRateLimitKey,
} from "@/lib/auth/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests within limit", () => {
    const key = `test-allow-${Date.now()}`;
    const result = checkRateLimit(key, { maxRequests: 3, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests over limit", () => {
    const key = `test-block-${Date.now()}`;
    const config = { maxRequests: 2, windowSeconds: 60 };

    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const result = checkRateLimit(key, config);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("returns correct remaining count", () => {
    const key = `test-remaining-${Date.now()}`;
    const config = { maxRequests: 5, windowSeconds: 60 };

    const r1 = checkRateLimit(key, config);
    expect(r1.remaining).toBe(4);

    const r2 = checkRateLimit(key, config);
    expect(r2.remaining).toBe(3);

    const r3 = checkRateLimit(key, config);
    expect(r3.remaining).toBe(2);
  });

  it("different keys are independent", () => {
    const config = { maxRequests: 1, windowSeconds: 60 };
    const key1 = `test-independent-1-${Date.now()}`;
    const key2 = `test-independent-2-${Date.now()}`;

    checkRateLimit(key1, config);
    const r2 = checkRateLimit(key2, config);
    expect(r2.allowed).toBe(true);
  });
});

describe("RATE_LIMITS", () => {
  it("has all required rate limit configs", () => {
    expect(RATE_LIMITS.login).toBeDefined();
    expect(RATE_LIMITS.signup).toBeDefined();
    expect(RATE_LIMITS.forgotPassword).toBeDefined();
    expect(RATE_LIMITS.resetPassword).toBeDefined();
    expect(RATE_LIMITS.resendVerification).toBeDefined();
  });

  it("login allows 5 attempts per 15 minutes", () => {
    expect(RATE_LIMITS.login.maxRequests).toBe(5);
    expect(RATE_LIMITS.login.windowSeconds).toBe(15 * 60);
  });

  it("signup allows 3 attempts per hour", () => {
    expect(RATE_LIMITS.signup.maxRequests).toBe(3);
    expect(RATE_LIMITS.signup.windowSeconds).toBe(60 * 60);
  });
});

describe("getRateLimitKey", () => {
  it("combines IP and action", () => {
    const key = getRateLimitKey("127.0.0.1", "login");
    expect(key).toBe("ratelimit:login:127.0.0.1");
  });
});
