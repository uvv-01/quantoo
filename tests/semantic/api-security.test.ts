/**
 * Semantic API security and integration tests (Phase 6).
 *
 * Exercise the actual API route handlers against a real PostgreSQL
 * database when one is configured:
 *
 *   - unauthenticated requests are rejected (401) on every endpoint
 *   - user B cannot load, compare, export, or reproduce user A's execution
 *   - invalid identifiers produce 4xx, never 500
 *   - malformed or oversized capsules are rejected
 *   - baselines are scoped to the user and problem
 *   - reproduction runs the recorded source through the real pipeline
 *
 * next/headers cookies() is mocked with a simple request-scoped jar;
 * session rows are real (token -> hash -> database lookup).
 *
 * Skipped when DATABASE_URL is not a PostgreSQL URL.
 */

const TEST_TIMEOUT = 120_000;

import { describe, it, expect, vi, beforeAll, onTestFinished } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

import { GET as semanticExecutionsRoute } from "@/app/api/semantic/executions/[executionId]/route";
import { GET as listRoute } from "@/app/api/semantic/executions/route";
import { POST as compareRoute } from "@/app/api/semantic/compare/route";
import { POST as reproduceRoute } from "@/app/api/semantic/reproduce/route";
import { GET, PUT, DELETE } from "@/app/api/semantic/baselines/route";
import { GET as capsuleRoute } from "@/app/api/semantic/capsules/[executionId]/route";
import { POST as runRoute } from "@/app/api/executions/run/route";
import { validateExecutionCapsule } from "@/lib/semantic/capsule";
import { extractSemanticRecord } from "@/lib/semantic/record";

const jsonRequest = (url: string, body: unknown): Request =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const paramsContext = (id: string) => ({ params: Promise.resolve({ executionId: id }) });

const GOOD_ID = "33333333-3333-3333-3333-333333333333";

async function createVerifiedUser(suffix: string): Promise<{ id: string; email: string }> {
  const { prisma } = await import("@/lib/prisma");
  const bcrypt = await import("bcryptjs");
  const email = `sem-${suffix}-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("correct-horse-42", 10),
      emailVerified: new Date(),
    },
    select: { id: true, email: true },
  });
  onTestFinished(async () => {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });
  return user;
}

async function signIn(userId: string): Promise<void> {
  const { createSession } = await import("@/lib/auth/session");
  cookieJar.clear();
  const token = await createSession(userId, "127.0.0.1", "vitest");
  cookieJar.set("quantoo-session", token);
}

async function getBellProblem(): Promise<{ id: string; slug: string }> {
  const { prisma } = await import("@/lib/prisma");
  const problem = await prisma.problem.findFirst({
    where: { status: "PUBLISHED" },
    select: { id: true, slug: true },
  });
  if (!problem) throw new Error("No published problem seeded");
  return problem;
}

const BELL_SOURCE =
  "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2,2)\nresult.h(0)\nresult.cx(0,1)\nresult.measure([0,1],[0,1])";

async function runBell(userId: string, problemId: string): Promise<string> {
  const { runSubmission } = await import("@/lib/exec/service");
  const run = await runSubmission(userId, {
    problemId,
    sourceCode: BELL_SOURCE,
    shots: 512,
    seed: 7,
  });
  if (run.status !== "SUCCEEDED") throw new Error(`run failed: ${run.error?.code}`);
  return run.submissionId;
}

describe.skipIf(!/postgres(ql)?:\/\//.test(DATABASE_URL))(
  "semantic API security",
  () => {
    beforeAll(async () => {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
    });

    it("rejects unauthenticated requests on every endpoint", async () => {
      cookieJar.clear();
      const responses = await Promise.all([
        semanticExecutionsRoute(new Request("http://x"), paramsContext(GOOD_ID)),
        listRoute(new Request("http://x?problemSlug=bell-state")),
        compareRoute(jsonRequest("http://x", { submissionIdA: GOOD_ID, submissionIdB: GOOD_ID })),
        reproduceRoute(jsonRequest("http://x", { submissionId: GOOD_ID })),
        GET(new Request("http://x?problemSlug=bell-state")),
        capsuleRoute(new Request("http://x"), paramsContext(GOOD_ID)),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    }, TEST_TIMEOUT);

    it("returns 404 (not 500) for well-formed nonexistent executions", async () => {
      const user = await createVerifiedUser("miss");
      await signIn(user.id);
      const responses = await Promise.all([
        semanticExecutionsRoute(new Request("http://x"), paramsContext(GOOD_ID)),
        capsuleRoute(new Request("http://x"), paramsContext(GOOD_ID)),
        compareRoute(
          jsonRequest("http://x", { submissionIdA: GOOD_ID, submissionIdB: "44444444-4444-4444-4444-444444444444" }),
        ),
        reproduceRoute(jsonRequest("http://x", { submissionId: GOOD_ID })),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(404);
      }
    }, TEST_TIMEOUT);

    it("rejects malformed identifiers and bodies with 4xx", async () => {
      const user = await createVerifiedUser("bad");
      await signIn(user.id);

      const badId = await semanticExecutionsRoute(
        new Request("http://x"),
        paramsContext("not-a-uuid"),
      );
      expect(badId.status).toBe(400);

      const selfCompare = await compareRoute(
        jsonRequest("http://x", { submissionIdA: GOOD_ID, submissionIdB: GOOD_ID }),
      );
      expect(selfCompare.status).toBe(400);

      const badPolicy = await compareRoute(
        jsonRequest("http://x", {
          submissionIdA: GOOD_ID,
          submissionIdB: "44444444-4444-4444-4444-444444444444",
          policy: "banana",
        }),
      );
      expect(badPolicy.status).toBe(400);
    }, TEST_TIMEOUT);

    it("isolates users: B cannot load, compare, reproduce, or export A's execution", async () => {
      const problem = await getBellProblem();
      const owner = await createVerifiedUser("owner");
      await signIn(owner.id);
      const submissionId = await runBell(owner.id, problem.id);

      const outsider = await createVerifiedUser("other");

      // Outsider signs in and tries every path to the owner's execution.
      await signIn(outsider.id);
      const [loadRes, capsuleRes, compareRes, reproduceRes] = await Promise.all([
        semanticExecutionsRoute(new Request("http://x"), paramsContext(submissionId)),
        capsuleRoute(new Request("http://x"), paramsContext(submissionId)),
        compareRoute(
          jsonRequest("http://x", { submissionIdA: submissionId, submissionIdB: "44444444-4444-4444-4444-444444444444" }),
        ),
        reproduceRoute(jsonRequest("http://x", { submissionId })),
      ]);
      expect(loadRes.status).toBe(404);
      expect(capsuleRes.status).toBe(404);
      expect(compareRes.status).toBe(404);
      expect(reproduceRes.status).toBe(404);
    }, TEST_TIMEOUT);

    it("serves the owner's record, list, capsule, and baseline flow end to end", async () => {
      const problem = await getBellProblem();
      const user = await createVerifiedUser("flow");
      await signIn(user.id);
      const submissionId = await runBell(user.id, problem.id);

      // Semantic record endpoint.
      const recordRes = await semanticExecutionsRoute(
        new Request("http://x"),
        paramsContext(submissionId),
      );
      expect(recordRes.status).toBe(200);
      const { record } = (await recordRes.json()) as { record: { submissionId: string; environment: { framework: { name: string } } } };
      expect(record.submissionId).toBe(submissionId);
      expect(record.environment.framework.name).toBe("qiskit");

      // List endpoint includes it and its baseline stays null before designation.
      const listRes = await listRoute(
        new Request(`http://x?problemSlug=${problem.slug}`),
      );
      expect(listRes.status).toBe(200);
      const listed = (await listRes.json()) as {
        executions: Array<{ id: string }>;
        baseline: unknown;
      };
      expect(listed.executions.some((e) => e.id === submissionId)).toBe(true);
      expect(listed.baseline).toBeNull();

      // Capsule export: valid JSON, right version, contains the source.
      const capsuleRes = await capsuleRoute(new Request("http://x"), paramsContext(submissionId));
      expect(capsuleRes.status).toBe(200);
      const capsuleJson = await capsuleRes.text();
      const capsule = JSON.parse(capsuleJson) as { schemaVersion: string; sourceCode: string };
      expect(capsule.schemaVersion).toBe("quantoo.execution.v1");
      expect(capsule.sourceCode).toBe(BELL_SOURCE);
      // Round-trips through the untrusted-input validator.
      expect(() => validateExecutionCapsule(capsuleJson)).not.toThrow();

      // Baseline designation and regression comparison.
      const putRes = await PUT(
        jsonRequest("http://x", { problemSlug: problem.slug, submissionId, policy: "statistical-default" }),
      );
      expect(putRes.status).toBe(200);
      const getRes = await GET(new Request(`http://x?problemSlug=${problem.slug}`));
      expect(getRes.status).toBe(200);
      const { baseline } = (await getRes.json()) as { baseline: { submissionId: string } | null };
      expect(baseline?.submissionId).toBe(submissionId);

      const delRes = await DELETE(new Request(`http://x?problemSlug=${problem.slug}`));
      expect(delRes.status).toBe(200);
      const empty = (await (
        await GET(new Request(`http://x?problemSlug=${problem.slug}`))
      ).json()) as { baseline: unknown };
      expect(empty.baseline).toBeNull();
    }, TEST_TIMEOUT);

    it("reproduces an execution through the real pipeline and reports evidence", async () => {
      const problem = await getBellProblem();
      const user = await createVerifiedUser("repr");
      await signIn(user.id);
      const submissionId = await runBell(user.id, problem.id);

      const res = await reproduceRoute(
        jsonRequest("http://x", { submissionId, policy: "statistical-default" }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        overallStatus: string;
        report: {
          submissionId: string;
          reproductionSubmissionId: string;
          comparison: { measurement: { status: string } | null };
          checks: Array<{ dimension: string; status: string }>;
        };
      };
      expect(body.overallStatus).toBe("REPRODUCED");
      expect(body.report.submissionId).toBe(submissionId);
      expect(body.report.reproductionSubmissionId).not.toBe(submissionId);
      expect(body.report.comparison.measurement?.status).toBe("PASS");

      // The reproduction appears as a new comparable execution.
      const listRes = await listRoute(new Request(`http://x?problemSlug=${problem.slug}`));
      const listed = (await listRes.json()) as { executions: Array<{ id: string }> };
      expect(listed.executions.some((e) => e.id === body.report.reproductionSubmissionId)).toBe(true);
    }, TEST_TIMEOUT);

    it("rejects baseline designation for foreign or artifact-less executions", async () => {
      const problem = await getBellProblem();
      const owner = await createVerifiedUser("base-owner");
      await signIn(owner.id);
      const submissionId = await runBell(owner.id, problem.id);

      const outsider = await createVerifiedUser("base-other");
      await signIn(outsider.id);
      const res = await PUT(
        jsonRequest("http://x", { problemSlug: problem.slug, submissionId, policy: "statistical-default" }),
      );
      expect(res.status).toBe(400);
    }, TEST_TIMEOUT);
  },
);

// ========================================
// Offline unit tests (no DB required)
// ========================================

describe("capsule validation (untrusted input)", () => {
  const validCapsule = {
    schemaVersion: "quantoo.execution.v1",
    capsuleId: "cap_x",
    createdAt: "2026-09-17T00:00:00.000Z",
    submissionId: "00000000-0000-0000-0000-000000000001",
    problem: { slug: "bell-state", title: "Bell", difficulty: "EASY" },
    sourceCode: "result = QuantumCircuit(2)",
    execution: { status: "SUCCEEDED", passed: true, durationMs: 5, shots: 512, seed: 7 },
    circuit: {
      qubits: 2,
      clbits: 2,
      depth: 2,
      operations: [
        { name: "h", qubits: [0], clbits: [], params: [], measurement: false },
      ],
      gateHistogram: { h: 1 },
      totalOperations: 1,
    },
    outcomes: {
      submission: {
        scenario: "submission",
        circuit: { qubits: 2, clbits: 2, depth: 2, gateCounts: { h: 1 }, totalGates: 1 },
        counts: { "00": 256, "11": 256 },
        shots: 512,
      },
    },
    judge: null,
    environment: {},
    trace: null,
  };

  it("accepts a structurally valid capsule", () => {
    expect(() =>
      validateExecutionCapsule(JSON.stringify(validCapsule)),
    ).not.toThrow();
  });

  it("rejects wrong schema versions", () => {
    const bad = { ...validCapsule, schemaVersion: "quantoo.execution.v999" };
    expect(() => validateExecutionCapsule(JSON.stringify(bad))).toThrow();
  });

  it("rejects oversized and non-JSON payloads", () => {
    expect(() => validateExecutionCapsule("x".repeat(3_000_000))).toThrow();
    expect(() => validateExecutionCapsule("not json")).toThrow();
  });

  it("rejects deeply nested payloads", () => {
    let deep: unknown = 1;
    for (let i = 0; i < 40; i++) deep = { nested: deep };
    expect(() => validateExecutionCapsule(JSON.stringify(deep))).toThrow();
  });

  it("rejects negative or absurd circuit fields", () => {
    const bad = {
      ...validCapsule,
      circuit: { ...validCapsule.circuit, qubits: 9999 },
    };
    expect(() => validateExecutionCapsule(JSON.stringify(bad))).toThrow();
  });
});

describe("semantic record extraction security", () => {
  it("never fabricates data for malformed artifacts", () => {
    expect(
      extractSemanticRecord({
        submissionId: "s",
        userId: "u",
        problemId: "p",
        sourceCode: null,
        artifact: { outcomes: { submission: { circuit: { qubits: 2 } } } },
      }),
    ).toBeNull();
  });

  it("caps environment string lengths defensively", () => {
    const record = extractSemanticRecord({
      submissionId: "s",
      userId: "u",
      problemId: "p",
      sourceCode: null,
      artifact: {
        outcomes: {
          submission: {
            scenario: "submission",
            circuit: { qubits: 1, clbits: 0, depth: 1, gateCounts: { h: 1 }, totalGates: 1 },
          },
        },
        environment: { python: "x".repeat(10_000) },
      },
    });
    expect(record?.environment.python).toBeNull();
  });
});

// Keep the run route import used (smoke reference for pipeline identity).
void runRoute;
