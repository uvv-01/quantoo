import { z } from "zod";

/**
 * Server-only environment variables (not exposed to client).
 * These are validated at startup and never bundled into client code.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters")
    .default("development-secret-change-in-production-at-least-32-chars"),
  APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  EMAIL_FROM: z
    .string()
    .default("noreply@quantoo.dev"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
});

/**
 * Client-exposed environment variables.
 * These are safe to bundle into client-side code.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z
    .string()
    .default("Quantum Daily"),
});

/**
 * Parse and validate all environment variables.
 * Throws in production if validation fails; warns in development.
 */
function createEnv() {
  const serverParsed = serverEnvSchema.safeParse(process.env);
  const clientParsed = clientEnvSchema.safeParse(process.env);

  if (!serverParsed.success) {
    console.error(
      "❌ Invalid server environment variables:",
      serverParsed.error.flatten().fieldErrors,
    );
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid server environment variables. Check .env file.");
    }
  }

  if (!clientParsed.success) {
    console.error(
      "❌ Invalid client environment variables:",
      clientParsed.error.flatten().fieldErrors,
    );
  }

  return {
    // Server
    DATABASE_URL: serverParsed.data?.DATABASE_URL ?? "",
    AUTH_SECRET:
      serverParsed.data?.AUTH_SECRET ??
      "development-secret-change-in-production-at-least-32-chars",
    APP_URL: serverParsed.data?.APP_URL ?? "http://localhost:3000",
    EMAIL_FROM: serverParsed.data?.EMAIL_FROM ?? "noreply@quantoo.dev",
    SMTP_HOST: serverParsed.data?.SMTP_HOST,
    SMTP_PORT: serverParsed.data?.SMTP_PORT,
    SMTP_USER: serverParsed.data?.SMTP_USER,
    SMTP_PASSWORD: serverParsed.data?.SMTP_PASSWORD,
    LOG_LEVEL: serverParsed.data?.LOG_LEVEL ?? "info",
    // Client
    NEXT_PUBLIC_APP_URL:
      clientParsed.data?.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_APP_NAME:
      clientParsed.data?.NEXT_PUBLIC_APP_NAME ?? "Quantum Daily",
  };
}

export const env = createEnv();
