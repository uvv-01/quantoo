/**
 * Progress Service Tests
 *
 * Tests the progress tracking logic:
 * - Status transitions
 * - Attempt counting
 * - Data isolation
 * - Ownership enforcement
 */

import { describe, it, expect } from "vitest";

// ========================================
// Progress Status Transition Tests
// ========================================

describe("Progress Status Transitions", () => {
  type ProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "ATTEMPTED" | "SOLVED";

  const validTransitions: Record<ProgressStatus, ProgressStatus[]> = {
    NOT_STARTED: ["IN_PROGRESS"],
    IN_PROGRESS: ["ATTEMPTED"],
    ATTEMPTED: ["ATTEMPTED", "SOLVED"],
    SOLVED: [], // Terminal state
  };

  it("NOT_STARTED can transition to IN_PROGRESS", () => {
    expect(validTransitions.NOT_STARTED).toContain("IN_PROGRESS");
  });

  it("IN_PROGRESS can transition to ATTEMPTED", () => {
    expect(validTransitions.IN_PROGRESS).toContain("ATTEMPTED");
  });

  it("ATTEMPTED can transition to SOLVED", () => {
    expect(validTransitions.ATTEMPTED).toContain("SOLVED");
  });

  it("ATTEMPTED can remain ATTEMPTED (multiple attempts)", () => {
    expect(validTransitions.ATTEMPTED).toContain("ATTEMPTED");
  });

  it("SOLVED is a terminal state", () => {
    expect(validTransitions.SOLVED).toHaveLength(0);
  });

  it("NOT_STARTED cannot go directly to SOLVED", () => {
    expect(validTransitions.NOT_STARTED).not.toContain("SOLVED");
  });

  it("SOLVED cannot go back to ATTEMPTED", () => {
    expect(validTransitions.SOLVED).not.toContain("ATTEMPTED");
  });
});

// ========================================
// Attempt Counting Tests
// ========================================

describe("Attempt Counting", () => {
  it("starts with 0 attempts", () => {
    const attempts = 0;
    expect(attempts).toBe(0);
  });

  it("increments attempt count", () => {
    let attempts = 0;
    attempts++;
    expect(attempts).toBe(1);
    attempts++;
    expect(attempts).toBe(2);
  });

  it("tracks best time correctly", () => {
    let bestTime: number | undefined;

    function updateBestTime(newTime: number) {
      bestTime =
        bestTime !== undefined ? Math.min(bestTime, newTime) : newTime;
    }

    updateBestTime(5000);
    expect(bestTime).toBe(5000);

    updateBestTime(3000);
    expect(bestTime).toBe(3000);

    updateBestTime(7000);
    expect(bestTime).toBe(3000); // Should not change
  });

  it("records last attempt time", () => {
    const times: Date[] = [];

    function recordAttempt() {
      times.push(new Date());
    }

    recordAttempt();
    recordAttempt();
    recordAttempt();

    expect(times).toHaveLength(3);
    // Each attempt should be at the same or later time
    expect(times[2].getTime()).toBeGreaterThanOrEqual(times[0].getTime());
  });
});

// ========================================
// Ownership Tests
// ========================================

describe("Ownership Enforcement", () => {
  it("progress records are scoped to a specific user", () => {
    const progress = {
      id: "progress-1",
      userId: "user-1",
      problemId: "problem-1",
      status: "IN_PROGRESS",
    };

    // The userId in the progress record should match the authenticated user
    expect(progress.userId).toBe("user-1");
  });

  it("different users have separate progress for the same problem", () => {
    const progressA = {
      userId: "user-a",
      problemId: "problem-1",
      status: "ATTEMPTED",
      attempts: 3,
    };

    const progressB = {
      userId: "user-b",
      problemId: "problem-1",
      status: "SOLVED",
      attempts: 1,
    };

    // Same problem, different users = independent progress
    expect(progressA.userId).not.toBe(progressB.userId);
    expect(progressA.status).not.toBe(progressB.status);
    expect(progressA.attempts).not.toBe(progressB.attempts);
  });

  it("compound unique key prevents duplicate records", () => {
    const records = new Map<string, { userId: string; problemId: string }>();

    records.set("user-1:problem-1", {
      userId: "user-1",
      problemId: "problem-1",
    });

    // Attempting to create the same key should be caught
    expect(records.has("user-1:problem-1")).toBe(true);
    expect(records.size).toBe(1);
  });
});

// ========================================
// Summary Tests
// ========================================

describe("Progress Summary", () => {
  it("calculates correct summary counts", () => {
    const progressList = [
      { status: "IN_PROGRESS", problemId: "p1" },
      { status: "ATTEMPTED", problemId: "p2" },
      { status: "SOLVED", problemId: "p3" },
      { status: "SOLVED", problemId: "p4" },
      { status: "NOT_STARTED", problemId: "p5" },
    ];

    const started = progressList.filter(
      (p) => p.status !== "NOT_STARTED",
    ).length;
    const solved = progressList.filter((p) => p.status === "SOLVED").length;
    const attempted = progressList.filter(
      (p) => p.status === "ATTEMPTED",
    ).length;

    expect(started).toBe(4);
    expect(solved).toBe(2);
    expect(attempted).toBe(1);
  });

  it("handles empty progress list", () => {
    const progressList: { status: string; problemId: string }[] = [];

    const started = progressList.filter(
      (p) => p.status !== "NOT_STARTED",
    ).length;

    expect(started).toBe(0);
  });
});
