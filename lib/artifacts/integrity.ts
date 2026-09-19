/**
 * Integrity hashing for research artifacts.
 *
 * Conventional sha-256 over canonical JSON (sorted keys, no whitespace
 * differences between equivalent documents). This is an integrity
 * mechanism for tamper-evidence, not a scientific transform.
 */

import { createHash } from "node:crypto";

/** Deterministically stringify a JSON value (sorted object keys). */
export function canonicalJson(value: unknown): string {
  return canonicalValue(value) as string;
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalValue(item))).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key])}`).join(",")}}`;
}

/** sha-256 hex digest over the canonical serialization of a JSON value. */
export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

/** Verify a document against an expected digest. */
export function verifyHash(document: unknown, expectedHash: string): boolean {
  return sha256Canonical(document) === expectedHash;
}
