import { createHash, randomBytes } from "crypto";

/**
 * Generate a cryptographically secure random token.
 * Returns a URL-safe hex string of the specified byte length.
 */
export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("hex");
}

/**
 * Hash a token using SHA-256 for secure storage.
 * Tokens are stored as hashes in the database;
 * the raw token is only sent to the user via email.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a session token with its hash.
 * Returns both the raw token (for the cookie) and the hash (for the database).
 */
export function createSessionToken(): {
  raw: string;
  hash: string;
} {
  const raw = generateToken(32);
  const hash = hashToken(raw);
  return { raw, hash };
}

/**
 * Create a verification token with its hash.
 */
export function createVerificationToken(): {
  raw: string;
  hash: string;
} {
  const raw = generateToken(32);
  const hash = hashToken(raw);
  return { raw, hash };
}

/**
 * Create a password reset token with its hash.
 */
export function createPasswordResetToken(): {
  raw: string;
  hash: string;
} {
  const raw = generateToken(32);
  const hash = hashToken(raw);
  return { raw, hash };
}
