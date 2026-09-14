import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { SecurityEventType, Prisma } from "@prisma/client";

/**
 * Security event logging service.
 *
 * Logs authentication-related events for audit trails.
 * Events are stored in the database and also logged via the application logger.
 *
 * Privacy:
 *   - Never log passwords, tokens, or session IDs
 *   - Use user IDs rather than emails in structured logs
 *   - Mask sensitive metadata
 */

interface SecurityEventOptions {
  userId?: string;
  type: SecurityEventType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a security event in the database and application logs.
 */
export async function recordSecurityEvent(
  options: SecurityEventOptions,
): Promise<void> {
  const { userId, type, ipAddress, userAgent, metadata } = options;

  // Log to application logger (structured)
  logger.info(`Security event: ${type}`, {
    eventType: type,
    userId: userId ?? "anonymous",
    ipAddress: ipAddress ?? "unknown",
  });

  // Store in database for audit trail
  try {
    await prisma.securityEvent.create({
      data: {
        userId: userId ?? null,
        type,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (error) {
    // Never let security logging failure break the auth flow
    logger.error("Failed to record security event:", {
      eventType: "SECURITY_LOG_FAILURE",
      attemptedType: type,
      error: error instanceof Error ? error.message : "Unknown",
    });
  }
}

// ========================================
// Convenience functions for common events
// ========================================

export function logSignupSuccess(
  userId: string,
  ip?: string,
  ua?: string,
) {
  return recordSecurityEvent({
    userId,
    type: "SIGNUP_SUCCESS",
    ipAddress: ip,
    userAgent: ua,
  });
}

export function logLoginSuccess(
  userId: string,
  ip?: string,
  ua?: string,
) {
  return recordSecurityEvent({
    userId,
    type: "LOGIN_SUCCESS",
    ipAddress: ip,
    userAgent: ua,
  });
}

export function logLoginFailure(
  email: string,
  ip?: string,
  ua?: string,
  reason?: string,
) {
  return recordSecurityEvent({
    type: "LOGIN_FAILURE",
    ipAddress: ip,
    userAgent: ua,
    metadata: { reason: reason ?? "invalid_credentials" },
  });
}

export function logLogout(userId: string, ip?: string, ua?: string) {
  return recordSecurityEvent({
    userId,
    type: "LOGOUT",
    ipAddress: ip,
    userAgent: ua,
  });
}

export function logEmailVerified(userId: string) {
  return recordSecurityEvent({
    userId,
    type: "EMAIL_VERIFIED",
  });
}

export function logVerificationRequested(userId: string, ip?: string) {
  return recordSecurityEvent({
    userId,
    type: "VERIFICATION_REQUESTED",
    ipAddress: ip,
  });
}

export function logPasswordResetRequested(userId: string, ip?: string) {
  return recordSecurityEvent({
    userId,
    type: "PASSWORD_RESET_REQUESTED",
    ipAddress: ip,
  });
}

export function logPasswordResetSuccess(userId: string) {
  return recordSecurityEvent({
    userId,
    type: "PASSWORD_RESET_SUCCESS",
  });
}

export function logPasswordChanged(userId: string) {
  return recordSecurityEvent({
    userId,
    type: "PASSWORD_CHANGED",
  });
}

export function logSessionRevoked(userId: string, ip?: string) {
  return recordSecurityEvent({
    userId,
    type: "SESSION_REVOKED",
    ipAddress: ip,
  });
}
