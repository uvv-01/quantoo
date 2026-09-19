/**
 * In-memory rate limiter.
 *
 * NOTE: This is a single-process, in-memory implementation suitable for
 * development and single-server deployments. For production scale:
 *   - Replace with Redis-backed rate limiting
 *   - The abstraction below is designed to make this swap straightforward
 *
 * Limitations:
 *   - Rate limit state is lost on server restart
 *   - Does not work across multiple server instances
 *   - Not suitable for distributed deployments without Redis
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000);

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check rate limit for a given key (e.g., IP address + endpoint).
 * Returns whether the request is allowed and metadata for response headers.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(resetAt),
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

// ========================================
// Predefined rate limit configurations
// ========================================

export const RATE_LIMITS = {
  login: { maxRequests: 5, windowSeconds: 15 * 60 } as RateLimitConfig, // 5 per 15 min
  signup: { maxRequests: 3, windowSeconds: 60 * 60 } as RateLimitConfig, // 3 per hour
  forgotPassword: {
    maxRequests: 3,
    windowSeconds: 60 * 60,
  } as RateLimitConfig, // 3 per hour
  resetPassword: {
    maxRequests: 5,
    windowSeconds: 60 * 60,
  } as RateLimitConfig, // 5 per hour
  resendVerification: {
    maxRequests: 3,
    windowSeconds: 60 * 60,
  } as RateLimitConfig, // 3 per hour
  // Quantum execution is expensive: keep the per-user budget conservative.
  execution: { maxRequests: 20, windowSeconds: 10 * 60 } as RateLimitConfig, // 20 per 10 min
  draftSave: { maxRequests: 60, windowSeconds: 10 * 60 } as RateLimitConfig, // autosave headroom
  // Semantic analysis (compare/reproduce): reproduction runs a real
  // execution, so this shares the conservative execution budget.
  semantic: { maxRequests: 20, windowSeconds: 10 * 60 } as RateLimitConfig,
  // Compatibility experiments execute up to 5 candidate environments plus
  // a baseline run per request, so the per-user budget is tighter than a
  // single execution.
  compatibility: { maxRequests: 6, windowSeconds: 10 * 60 } as RateLimitConfig,
} as const;

/**
 * Get a rate limit key from IP address and action.
 */
export function getRateLimitKey(ipAddress: string, action: string): string {
  return `ratelimit:${action}:${ipAddress}`;
}
