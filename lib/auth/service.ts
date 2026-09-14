import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createVerificationToken,
  createPasswordResetToken,
  hashToken,
} from "@/lib/auth/tokens";
import { createSession, destroySession } from "@/lib/auth/session";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/auth/email";
import {
  logSignupSuccess,
  logLoginSuccess,
  logLoginFailure,
  logEmailVerified,
  logVerificationRequested,
  logPasswordResetRequested,
  logPasswordResetSuccess,
  logPasswordChanged,
} from "@/lib/auth/security-events";
import { normalizeEmail } from "@/lib/auth/validation";

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// ========================================
// Types
// ========================================

export interface AuthResult {
  success: boolean;
  error?: string;
  userId?: string;
}

// ========================================
// Signup
// ========================================

/**
 * Register a new user account.
 * Creates the user, hashes the password, generates a verification token,
 * and sends a verification email.
 */
export async function signup(
  email: string,
  password: string,
  options?: { ipAddress?: string; userAgent?: string },
): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  // Check if user already exists (constant-time-ish: always hash regardless)
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, emailVerified: true },
  });

  if (existingUser) {
    // Still do work to avoid timing-based enumeration
    await hashPassword(password);
    return {
      success: false,
      error: "An account with this email already exists.",
    };
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
    },
  });

  // Generate verification token
  const { raw, hash } = createVerificationToken();
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt,
    },
  });

  // Send verification email
  await sendVerificationEmail(normalizedEmail, raw);

  // Log security event
  await logSignupSuccess(user.id, options?.ipAddress, options?.userAgent);

  return { success: true, userId: user.id };
}

// ========================================
// Login
// ========================================

/**
 * Authenticate a user with email and password.
 * Creates a secure session on success.
 */
export async function login(
  email: string,
  password: string,
  options?: { ipAddress?: string; userAgent?: string },
): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      passwordHash: true,
      emailVerified: true,
    },
  });

  // If user doesn't exist, still verify password to prevent timing attacks
  if (!user) {
    await verifyPassword(password, "$2a$12$invalidhashpreventtimingattack");
    await logLoginFailure(
      normalizedEmail,
      options?.ipAddress,
      options?.userAgent,
      "user_not_found",
    );
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    await logLoginFailure(
      normalizedEmail,
      options?.ipAddress,
      options?.userAgent,
      "invalid_password",
    );
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Create session
  await createSession(user.id, options?.ipAddress, options?.userAgent);

  await logLoginSuccess(user.id, options?.ipAddress, options?.userAgent);

  return { success: true, userId: user.id };
}

// ========================================
// Logout
// ========================================

/**
 * Log out the current user by destroying their session.
 */
export async function logout(): Promise<void> {
  await destroySession();
  // Note: We log the event after session destruction; the userId
  // would need to be passed in if we want to log it here.
}

// ========================================
// Email Verification
// ========================================

/**
 * Verify a user's email address using a verification token.
 */
export async function verifyEmail(
  token: string,
): Promise<AuthResult> {
  const tokenHash = hashToken(token);

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!verificationToken) {
    return { success: false, error: "Invalid verification link." };
  }

  if (verificationToken.usedAt) {
    return {
      success: false,
      error: "This verification link has already been used.",
    };
  }

  if (verificationToken.expiresAt < new Date()) {
    return {
      success: false,
      error: "This verification link has expired. Please request a new one.",
    };
  }

  // Mark email as verified and consume token in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await logEmailVerified(verificationToken.userId);

  return { success: true, userId: verificationToken.userId };
}

/**
 * Resend email verification for a user.
 * Rate limiting should be applied before calling this function.
 */
export async function resendVerification(
  email: string,
  options?: { ipAddress?: string },
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, emailVerified: true },
  });

  // Always return the same message to prevent account enumeration
  const genericMessage =
    "If an account with that email exists and needs verification, a new link has been sent.";

  if (!user || user.emailVerified) {
    return { success: true, message: genericMessage };
  }

  // Invalidate any existing unused tokens
  await prisma.emailVerificationToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    data: { usedAt: new Date() }, // Mark as used to invalidate
  });

  // Generate new token
  const { raw, hash } = createVerificationToken();
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt,
    },
  });

  await sendVerificationEmail(normalizedEmail, raw);
  await logVerificationRequested(user.id, options?.ipAddress);

  return { success: true, message: genericMessage };
}

// ========================================
// Password Reset
// ========================================

/**
 * Request a password reset. Sends an email with a reset token.
 * Always returns the same message to prevent account enumeration.
 */
export async function requestPasswordReset(
  email: string,
  options?: { ipAddress?: string },
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = normalizeEmail(email);
  const genericMessage =
    "If an account with that email exists, you'll receive password reset instructions shortly.";

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (!user) {
    return { success: true, message: genericMessage };
  }

  // Invalidate any existing unused reset tokens
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  // Generate new reset token
  const { raw, hash } = createPasswordResetToken();
  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt,
    },
  });

  await sendPasswordResetEmail(normalizedEmail, raw);
  await logPasswordResetRequested(user.id, options?.ipAddress);

  return { success: true, message: genericMessage };
}

/**
 * Reset a user's password using a reset token.
 * Consumes the token and invalidates all existing sessions.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<AuthResult> {
  const tokenHash = hashToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!resetToken) {
    return { success: false, error: "Invalid reset link." };
  }

  if (resetToken.usedAt) {
    return {
      success: false,
      error: "This reset link has already been used.",
    };
  }

  if (resetToken.expiresAt < new Date()) {
    return {
      success: false,
      error: "This reset link has expired. Please request a new one.",
    };
  }

  // Hash new password and update in a transaction
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate all sessions for this user (security measure)
    prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  await logPasswordResetSuccess(resetToken.userId);

  return { success: true, userId: resetToken.userId };
}

// ========================================
// Change Password (authenticated)
// ========================================

/**
 * Change password for an authenticated user.
 * Requires the current password for verification.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return { success: false, error: "User not found." };
  }

  const validPassword = await verifyPassword(currentPassword, user.passwordHash);

  if (!validPassword) {
    return { success: false, error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await logPasswordChanged(userId);

  return { success: true };
}
