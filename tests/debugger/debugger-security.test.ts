/**
 * Debugger security tests.
 *
 * The debugger exposes execution internals, so ownership enforcement is
 * security-critical. These tests verify:
 *
 *  - malformed identifiers are rejected before any database query
 *  - foreign submissions are indistinguishable from missing ones (404)
 *  - owners receive their own data
 *  - payloads never contain host paths, container details, or stack traces
 *
 * The database calls are mocked; the ownership contract itself is also
 * covered by the live E2E manual verification and by the real-DB API tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    problem: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { getDebuggerData } from "@/lib/exec/debugger-service";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const SUBMISSION_ID = "33333333-3333-3333-3333-333333333333";
const PROBLEM_ID = "44444444-4444-4444-4444-444444444444";

function ownedSubmission(userId: string) {
  return {
    id: SUBMISSION_ID,
    userId,
    status: "SUCCEEDED",
    errorCode: null,
    errorMessage: null,
    judgeResult: null,
    executionResult: {
      submission: {
        scenario: "submission",
        circuit: {
          qubits: 2,
          clbits: 2,
          depth: 3,
          gateCounts: { h: 1, cx: 1, measure: 2 },
          totalGates: 4,
        },
        counts: { "00": 260, "11": 252 },
        shots: 512,
        trace: {
          policy: {
            available: true,
            representation: "statevector",
            subsampled: false,
            stride: 1,
            reason: null,
          },
          steps: [
            {
              stepIndex: 0,
              operationIndex: 0,
              gateName: "h",
              qubits: [0],
              clbits: [],
              params: [],
              measurement: false,
            },
          ],
        },
      },
    },
    createdAt: new Date(),
    problem: { slug: "bell-state" },
  };
}

describe("debugger ownership enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.problem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PROBLEM_ID,
    });
    (prisma.submission.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
  });

  it("rejects malformed identifiers without querying the database", async () => {
    const result = await getDebuggerData(USER_A, "not-a-uuid");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(prisma.submission.findUnique).not.toHaveBeenCalled();
  });

  it("rejects SQL-injection-shaped identifiers", async () => {
    const result = await getDebuggerData(
      USER_A,
      "'; DROP TABLE submissions; --",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(prisma.submission.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a nonexistent submission", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    const result = await getDebuggerData(USER_A, SUBMISSION_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("returns 404 (not 403) for another user's submission", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      ownedSubmission(USER_B),
    );
    const result = await getDebuggerData(USER_A, SUBMISSION_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("never leaks another user's data in the error response", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      ownedSubmission(USER_B),
    );
    const result = await getDebuggerData(USER_A, SUBMISSION_ID);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("counts");
    expect(serialized).not.toContain("trace");
  });

  it("returns the payload to the owner with trace availability", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      ownedSubmission(USER_A),
    );
    const result = await getDebuggerData(USER_A, SUBMISSION_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.submissionId).toBe(SUBMISSION_ID);
    expect(result.payload.problemSlug).toBe("bell-state");
    expect(result.payload.outcomes["submission"].counts).toEqual({
      "00": 260,
      "11": 252,
    });
    expect(
      result.payload.traceAvailability["submission"].trace,
    ).toBe(true);
  });

  it("reports unavailable traces factually", async () => {
    const noTrace = ownedSubmission(USER_A);
    (noTrace.executionResult as Record<string, unknown>)["submission"] = {
      scenario: "submission",
      circuit: {
        qubits: 2,
        clbits: 2,
        depth: 3,
        gateCounts: { h: 1 },
        totalGates: 1,
      },
    };
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      noTrace,
    );
    const result = await getDebuggerData(USER_A, SUBMISSION_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.payload.traceAvailability["submission"].trace,
    ).toBe(false);
    expect(
      result.payload.traceAvailability["submission"].reason,
    ).toContain("No trace was recorded");
  });
});

describe("debugger payload hygiene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.problem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PROBLEM_ID,
    });
    (prisma.submission.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
  });

  it("serializes without host paths, container ids, or stack frames", async () => {
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      ownedSubmission(USER_A),
    );
    const result = await getDebuggerData(USER_A, SUBMISSION_ID);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/at .+:\d+:\d+/); // stack frames
    expect(serialized).not.toContain("/app/");
    expect(serialized).not.toContain("container");
    expect(serialized).not.toContain("DATABASE_URL");
  });
});
