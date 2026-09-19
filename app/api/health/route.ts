import { NextResponse } from "next/server";

/**
 * Health check endpoint.
 *
 * Layered, evidence-based checks:
 *   - database: connectivity probed when configured
 *   - runtime: sandbox mode measured (docker image probe / fallback)
 *
 * The runtime check reports the sandbox mode's honest health. A
 * "hardware provider" section appears only when a provider integration
 * actually exists; credentials alone never imply availability.
 */

interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  version: string;
  database?: "connected" | "disconnected" | "not_configured";
  runtime?: "available" | "unavailable" | "not_configured";
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

  let runtimeStatus: "available" | "unavailable" | "not_configured" = "not_configured";
  try {
    const { describeSandboxAvailability } = await import("@/lib/hardware/availability");
    const availability = await describeSandboxAvailability();
    runtimeStatus =
      availability.status === "AVAILABLE"
        ? "available"
        : availability.status === "UNAVAILABLE"
          ? "unavailable"
          : "not_configured";
  } catch {
    runtimeStatus = "unavailable";
  }

  const status =
    databaseStatus === "disconnected" || runtimeStatus === "unavailable"
      ? "degraded"
      : "ok";

  return NextResponse.json({
    status,
    service: "quantoo",
    timestamp,
    version: process.env.npm_package_version ?? "0.1.0",
    database: databaseStatus,
    runtime: runtimeStatus,
  });
}
