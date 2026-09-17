/**
 * Debugger API integration tests.
 *
 * Exercise the actual API route handlers (auth -> ownership -> payload)
 * against a real PostgreSQL database when one is configured. The privacy
 * contract is verified end to end:
 *
 *   - unauthenticated requests are rejected (401)
 *   - user B cannot read user A's submission (404, indistinguishable)
 *   - user A can read their own submission's debugger data and trace
 *   - invalid identifiers produce 404, not 500
 *
 * next/headers cookies() is mocked with a simple request-scoped jar; the
 * session rows themselves are real (token -> hash -> database lookup), so
 * the authentication path is exercised for real.
 *
 * Skipped when DATABASE_URL is not a PostgreSQL URL.
 */

const TEST_TIMEOUT = 60_000;

import { describe, it, expect, vi, beforeAll, onTestFinished } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

/** Simple mutable cookie jar backing the next/headers mock. */
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

import { GET as debugRoute } from "@/app/api/submissions/[submissionId]/debug/route";
import { GET as traceRoute } from "@/app/api/executions/[executionId]/trace/route";

const debugContext = (id: string): Parameters<typeof debugRoute>[1] => ({
  params: Promise.resolve({ submissionId: id }),
});
const traceContext = (id: string): Parameters<typeof traceRoute>[1] => ({
  params: Promise.resolve({ executionId: id }),
});

function request(): Request {
  return new Request("http://localhost:3000/api/test");
}

describe.skipIf(!/postgres(ql)?:\/\//.test(DATABASE_URL))(
  "debugger API authorization",
  () => {
    beforeAll(async () => {
      // Ensure the database schema exists for the real session/submission rows.
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
    });

    it("rejects unauthenticated debugger requests", async () => {
      cookieJar.clear();
      const response = await debugRoute(
        request(),
        debugContext("33333333-3333-3333-3333-333333333333"),
      );
      expect(response.status).toBe(401);

      const traceResponse = await traceRoute(
        request(),
        traceContext("33333333-3333-3333-3333-333333333333"),
      );
      expect(traceResponse.status).toBe(401);
    }, TEST_TIMEOUT);

    it("returns 404 (not 500) for a well-formed but nonexistent submission", async () => {
      const { prisma } = await import("@/lib/prisma");
      const { createSession } = await import("@/lib/auth/session");
      const bcrypt = await import("bcryptjs");

      const suffix = Date.now();
      const passwordHash = await bcrypt.hash("correct-horse-42", 10);
      const user = await prisma.user.create({
        data: { email: `dbg-miss-${suffix}@example.com`, passwordHash },
        select: { id: true },
      });
      onTestFinished(async () => {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      });

      cookieJar.clear();
      const token = await createSession(user.id, "127.0.0.1", "vitest");
      cookieJar.set("quantoo-session", token);

      const missingId = "99999999-9999-9999-9999-999999999999";
      const response = await debugRoute(request(), debugContext(missingId));
      expect(response.status).toBe(404);
    }, TEST_TIMEOUT);

    it("hides user B's submission from user A with 404", async () => {
      const { prisma } = await import("@/lib/prisma");
      const { createSession } = await import("@/lib/auth/session");
      const bcrypt = await import("bcryptjs");

      const suffix = Date.now();
      const passwordHash = await bcrypt.hash("correct-horse-42", 10);

      const userA = await prisma.user.create({
        data: { email: `dbg-a-${suffix}@example.com`, passwordHash },
        select: { id: true },
      });
      onTestFinished(async () => {
        await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
      });
      const userB = await prisma.user.create({
        data: { email: `dbg-b-${suffix}@example.com`, passwordHash },
        select: { id: true },
      });
      onTestFinished(async () => {
        await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
      });

      const problem = await prisma.problem.findFirst({
        where: { status: "PUBLISHED" },
        select: { id: true },
      });
      if (!problem) throw new Error("seeded published problem missing");

      const submission = await prisma.submission.create({
        data: {
          userId: userB.id,
          problemId: problem.id,
          sourceCode: "result = None\n",
          status: "SUCCEEDED",
          executionResult: {
            submission: {
              scenario: "submission",
              circuit: {
                qubits: 1,
                clbits: 0,
                depth: 0,
                gateCounts: {},
                totalGates: 0,
              },
            },
          },
        },
        select: { id: true },
      });

      cookieJar.clear();
      const token = await createSession(userA.id, "127.0.0.1", "vitest");
      cookieJar.set("quantoo-session", token);

      const response = await debugRoute(request(), debugContext(submission.id));
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    }, TEST_TIMEOUT);

    it("serves the owner their debugger payload and trace", async () => {
      const { prisma } = await import("@/lib/prisma");
      const { createSession } = await import("@/lib/auth/session");
      const bcrypt = await import("bcryptjs");

      const suffix = Date.now();
      const passwordHash = await bcrypt.hash("correct-horse-42", 10);
      const user = await prisma.user.create({
        data: { email: `dbg-own-${suffix}@example.com`, passwordHash },
        select: { id: true },
      });
      onTestFinished(async () => {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      });

      const problem = await prisma.problem.findFirst({
        where: { status: "PUBLISHED" },
        select: { id: true },
      });
      if (!problem) throw new Error("seeded published problem missing");

      const submission = await prisma.submission.create({
        data: {
          userId: user.id,
          problemId: problem.id,
          sourceCode: "result = None\n",
          status: "SUCCEEDED",
          executionResult: {
            submission: {
              scenario: "submission",
              circuit: {
                qubits: 1,
                clbits: 0,
                depth: 0,
                gateCounts: {},
                totalGates: 0,
              },
            },
          },
        },
        select: { id: true },
      });

      cookieJar.clear();
      const token = await createSession(user.id, "127.0.0.1", "vitest");
      cookieJar.set("quantoo-session", token);

      const response = await debugRoute(request(), debugContext(submission.id));
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        submission: { submissionId: string; problemSlug: string };
      };
      expect(body.submission.submissionId).toBe(submission.id);

      // The execution-trace route serves the same ownership contract.
      const traceResponse = await traceRoute(
        request(),
        traceContext(submission.id),
      );
      expect(traceResponse.status).toBe(200);
      const traceBody = (await traceResponse.json()) as {
        executionId: string;
        trace: unknown;
      };
      expect(traceBody.executionId).toBe(submission.id);
      expect(traceBody.trace).toBeNull(); // fixture stores no trace
    }, TEST_TIMEOUT);
  },
);
