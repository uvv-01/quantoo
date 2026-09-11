import { describe, it, expect, vi } from "vitest";

// Mock Prisma module
vi.mock("@/lib/prisma", () => ({
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
}));

describe("/api/health", () => {
  it("returns health status", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("service", "quantoo");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("version");
    expect(data.status).toBe("ok");
  });

  it("returns a valid timestamp", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const data = await response.json();

    const timestamp = new Date(data.timestamp);
    expect(timestamp.getTime()).not.toBeNaN();
  });

  it("returns database status", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty("database");
    expect(["connected", "disconnected", "not_configured"]).toContain(data.database);
  });
});
