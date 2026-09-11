import { z } from "zod";

/**
 * Environment variable validation schema.
 * Validates all required environment variables at build/startup time.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().min(1)),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Quantum Daily"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/**
 * Parsed and validated environment variables.
 * Access via `env.VARIABLE_NAME` throughout the application.
 */
function createEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    // During build time, throw to prevent building with invalid env
    // During runtime in development, allow graceful degradation
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment variables. Check the .env file.");
    }
  }

  return {
    DATABASE_URL: parsed.data?.DATABASE_URL ?? "",
    NEXT_PUBLIC_APP_URL: parsed.data?.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_APP_NAME: parsed.data?.NEXT_PUBLIC_APP_NAME ?? "Quantum Daily",
    LOG_LEVEL: parsed.data?.LOG_LEVEL ?? "info",
  };
}

export const env = createEnv();
