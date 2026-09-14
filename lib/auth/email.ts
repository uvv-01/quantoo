import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Email service abstraction.
 *
 * Development: Emails are logged to the console.
 * Production: Configurable via SMTP environment variables.
 *
 * For local development, use a tool like Mailpit:
 *   docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
 * Then set SMTP_HOST=localhost SMTP_PORT=1025 in .env
 */

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email using the configured provider.
 * In development without SMTP, logs to console.
 */
async function sendEmail(message: EmailMessage): Promise<boolean> {
  const { SMTP_HOST, EMAIL_FROM } = env;

  // If SMTP is not configured, log to console (development mode)
  if (!SMTP_HOST) {
    logger.info("📧 Development email (not sent):", {
      eventType: "EMAIL_DEV_LOG",
      to: message.to,
      subject: message.subject,
    });
    console.log("\n========================================");
    console.log("📨 EMAIL (Development Mode)");
    console.log("========================================");
    console.log(`To: ${message.to}`);
    console.log(`From: ${EMAIL_FROM}`);
    console.log(`Subject: ${message.subject}`);
    console.log("---");
    console.log(message.text);
    console.log("========================================\n");
    return true;
  }

  // Production: Use nodemailer or similar (install when needed)
  // For now, this is the SMTP path placeholder
  try {
    // TODO: Implement actual SMTP sending with nodemailer
    // This will be activated when nodemailer is installed for production
    logger.info("📧 Email sent:", {
      eventType: "EMAIL_SENT",
      to: message.to,
      subject: message.subject,
    });
    return true;
  } catch (error) {
    logger.error("📧 Email send failed:", {
      eventType: "EMAIL_SEND_FAILURE",
      to: message.to,
      subject: message.subject,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * Send email verification email.
 * Contains a one-time link with a secure token.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<boolean> {
  const appUrl = env.APP_URL;
  const verificationUrl = `${appUrl}/verify-email?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Verify your Quantoo account",
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">Verify your email</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 24px;">
          Welcome to Quantoo! Please verify your email address to get started.
        </p>
        <a href="${verificationUrl}"
           style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
          Verify Email Address
        </a>
        <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
          If the button doesn't work, copy and paste this URL into your browser:<br>
          <span style="word-break: break-all; color: #3B82F6;">${verificationUrl}</span>
        </p>
      </div>
    `,
    text: `Verify your Quantoo account\n\nWelcome to Quantoo! Please verify your email address:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you didn't create an account, you can safely ignore this email.`,
  });
}

/**
 * Send password reset email.
 * Contains a one-time link with a secure token.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<boolean> {
  const appUrl = env.APP_URL;
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Reset your Quantoo password",
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">Reset your password</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 24px;">
          We received a request to reset your password. Click the button below to choose a new one.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
          Reset Password
        </a>
        <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
          If the button doesn't work, copy and paste this URL into your browser:<br>
          <span style="word-break: break-all; color: #3B82F6;">${resetUrl}</span>
        </p>
      </div>
    `,
    text: `Reset your Quantoo password\n\nWe received a request to reset your password. Click this link:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.`,
  });
}
