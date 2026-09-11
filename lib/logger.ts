/**
 * Structured logging utility for Quantum Daily.
 *
 * Provides consistent, structured log output with:
 * - Request ID correlation
 * - User ID where appropriate
 * - Event type classification
 * - Severity levels
 * - Timestamps
 *
 * SECURITY: Never log passwords, tokens, secrets, API keys, or credentials.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  eventType?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
}

/**
 * Create a scoped logger with consistent context (e.g., requestId, userId).
 */
export function createLogger(context: { requestId?: string; userId?: string } = {}) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (!shouldLog("debug")) return;
      const entry: LogEntry = {
        level: "debug",
        message,
        timestamp: new Date().toISOString(),
        ...context,
        ...meta,
      };
      console.debug(formatEntry(entry));
    },

    info(message: string, meta?: Record<string, unknown>) {
      if (!shouldLog("info")) return;
      const entry: LogEntry = {
        level: "info",
        message,
        timestamp: new Date().toISOString(),
        ...context,
        ...meta,
      };
      console.info(formatEntry(entry));
    },

    warn(message: string, meta?: Record<string, unknown>) {
      if (!shouldLog("warn")) return;
      const entry: LogEntry = {
        level: "warn",
        message,
        timestamp: new Date().toISOString(),
        ...context,
        ...meta,
      };
      console.warn(formatEntry(entry));
    },

    error(message: string, meta?: Record<string, unknown>) {
      if (!shouldLog("error")) return;
      const entry: LogEntry = {
        level: "error",
        message,
        timestamp: new Date().toISOString(),
        ...context,
        ...meta,
      };
      console.error(formatEntry(entry));
    },
  };
}

/**
 * Default logger instance for general application logging.
 */
export const logger = createLogger();
