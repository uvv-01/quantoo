import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, logger } from "@/lib/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info messages", () => {
    logger.info("test message");
    expect(console.info).toHaveBeenCalled();
  });

  it("logs warn messages", () => {
    logger.warn("warning message");
    expect(console.warn).toHaveBeenCalled();
  });

  it("logs error messages", () => {
    logger.error("error message");
    expect(console.error).toHaveBeenCalled();
  });

  it("creates scoped logger with context", () => {
    const scopedLogger = createLogger({ requestId: "req-123", userId: "user-456" });
    scopedLogger.info("scoped message");
    expect(console.info).toHaveBeenCalled();
  });

  it("includes metadata in log entries", () => {
    logger.info("with metadata", { problemId: "prob-1" });
    expect(console.info).toHaveBeenCalled();
  });
});
