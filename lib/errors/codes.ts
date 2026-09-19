/**
 * Platform error taxonomy.
 *
 * One consistent set of structured error categories returned to clients
 * across authentication, execution, observatory, and research surfaces.
 * Codes are safe: they never include stack traces, infrastructure
 * details, or user content. Every API error response already pairs the
 * code with a human-readable message; this module defines the codes.
 */

export const ERROR_CODES = [
  "AUTHENTICATION_ERROR",
  "AUTHORIZATION_ERROR",
  "VALIDATION_ERROR",
  "RATE_LIMIT_ERROR",
  "SANDBOX_ERROR",
  "RUNTIME_ERROR",
  "TIMEOUT",
  "RESOURCE_LIMIT",
  "HARDWARE_UNAVAILABLE",
  "BACKEND_ERROR",
  "TRANSPILE_ERROR",
  "COMPATIBILITY_ERROR",
  "REPRODUCTION_ERROR",
  "DATABASE_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Map an execution error code (lib/exec/types) onto the platform
 * taxonomy. Unknown codes stay unknown rather than being narrowed
 * incorrectly.
 */
export function toPlatformErrorCode(executionCode: string): ErrorCode | null {
  switch (executionCode) {
    case "INVALID_REQUEST":
    case "INVALID_CODE":
      return "VALIDATION_ERROR";
    case "SYNTAX_ERROR":
    case "IMPORT_ERROR":
    case "RUNTIME_ERROR":
      return "RUNTIME_ERROR";
    case "TIMEOUT":
      return "TIMEOUT";
    case "MEMORY_LIMIT":
    case "QUBIT_LIMIT":
    case "CIRCUIT_LIMIT":
    case "OUTPUT_LIMIT":
      return "RESOURCE_LIMIT";
    case "SANDBOX_ERROR":
      return "SANDBOX_ERROR";
    case "SIMULATOR_ERROR":
      return "BACKEND_ERROR";
    case "INTERNAL_ERROR":
      return "INTERNAL_ERROR";
    default:
      return null;
  }
}
