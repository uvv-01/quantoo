/**
 * Integrity and artifact validation unit tests (Phase 8).
 */

import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Canonical, verifyHash } from "@/lib/artifacts/integrity";
import { validateArtifactExport } from "@/lib/artifacts/validation";
import type { ResearchArtifactDocument } from "@/lib/artifacts/types";

describe("canonical JSON", () => {
  it("sorts object keys deterministically", () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it("handles nesting, arrays, and null", () => {
    expect(canonicalJson({ x: [1, { y: null }] })).toBe('{"x":[1,{"y":null}]}');
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("s")).toBe('"s"');
  });

  it("produces stable sha-256 digests regardless of key order", () => {
    const doc = { alpha: 1, beta: { gamma: [3, 2, 1], delta: "x" } };
    const reordered = { beta: { delta: "x", gamma: [3, 2, 1] }, alpha: 1 };
    expect(sha256Canonical(doc)).toBe(sha256Canonical(reordered));
    expect(sha256Canonical(doc)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies hashes and detects changes", () => {
    const doc = { a: 1 };
    const hash = sha256Canonical(doc);
    expect(verifyHash(doc, hash)).toBe(true);
    expect(verifyHash({ a: 2 }, hash)).toBe(false);
  });
});

function validExport(): { envelope: Record<string, unknown>; document: ResearchArtifactDocument } {
  const document: ResearchArtifactDocument = {
    schemaVersion: "quantoo.artifact.v1",
    artifactType: "COMPATIBILITY_EXPERIMENT",
    title: "Unit fixture",
    description: null,
    provenance: {
      createdBy: "artifact-owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      problem: { slug: "bell-state", title: "Bell State" },
      sourceExperimentId: null,
    },
    source: {
      sourceCode: "from qiskit import QuantumCircuit",
      language: "python",
      shots: 1024,
      seed: 7,
      policyName: "statistical-default",
    },
    evidence: { capsules: [], compatibilityReport: null, reproductions: [] },
  };
  return {
    envelope: {
      schemaVersion: "quantoo.artifact.v1",
      kind: "quantoo-artifact",
      exportedAt: "2026-01-01T00:00:00.000Z",
      documentHash: sha256Canonical(document),
      document,
    },
    document,
  };
}

describe("artifact import validation", () => {
  it("accepts a well-formed export and verifies integrity", () => {
    const { envelope } = validExport();
    const result = validateArtifactExport(JSON.stringify(envelope));
    expect(result.integrityVerified).toBe(true);
    expect(result.document.title).toBe("Unit fixture");
  });

  it("flags a tampered document instead of silently accepting it", () => {
    const { envelope, document } = validExport();
    const tampered = { ...envelope, document: { ...document, title: "Changed" } };
    const result = validateArtifactExport(JSON.stringify(tampered));
    expect(result.integrityVerified).toBe(false);
  });

  it("rejects wrong schema version, kind, and structure", () => {
    const { envelope } = validExport();
    expect(() =>
      validateArtifactExport(JSON.stringify({ ...envelope, schemaVersion: "other.v9" })),
    ).toThrow();
    expect(() =>
      validateArtifactExport(JSON.stringify({ ...envelope, kind: "not-an-artifact" })),
    ).toThrow();
    expect(() => validateArtifactExport("not json")).toThrow();
  });

  it("rejects oversized documents", () => {
    const { envelope, document } = validExport();
    const bloated = {
      ...envelope,
      document: { ...document, source: { ...document.source, sourceCode: "x".repeat(200_001) } },
    };
    expect(() => validateArtifactExport(JSON.stringify(bloated))).toThrow();
  });

  it("rejects deeply nested payloads", () => {
    let node: unknown = { leaf: true };
    for (let i = 0; i < 40; i += 1) node = { nested: node };
    const { envelope } = validExport();
    expect(() =>
      validateArtifactExport(JSON.stringify({ ...envelope, document: { nested: node } })),
    ).toThrow();
  });
});
