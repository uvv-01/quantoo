import { NextResponse } from "next/server";

/**
 * Health check endpoint.
 * Returns application status. Database connectivity is checked
 * only when DATABASE_URL is configured.
 */

interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  version: string;
  database?: "connected" | "disconnected" | "not_configured";
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const timestamp = new Date().toISOString();

  let databaseStatus: "connected" | "disconnected" | "not_configured" = "not_configured";

  if (process.env.DATABASE_URL) {
    try {
      const { checkDatabaseConnection } = await import("@/lib/prisma");
      const connected = await checkDatabaseConnection();
      databaseStatus = connected ? "connected" : "disconnected";
    } catch {
      databaseStatus = "disconnected";
    }
  }

  const status = databaseStatus === "disconnected" ? "degraded" : "ok";

  return NextResponse.json({
    status,
    service: "quantoo",
    timestamp,
    version: process.env.npm_package_version ?? "0.1.0",
    database: databaseStatus,
  });
}
