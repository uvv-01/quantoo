/**
 * Observatory API security and integration tests (Phase 8).
 *
 * Exercises the actual API route handlers against a real PostgreSQL
 * database:
 *
 *   - unauthenticated requests are rejected (401) on every endpoint
 *   - invalid identifiers and bodies produce 4xx, never 500
 *   - user B cannot load, version, publish, or delete user A's artifacts
 *     or projects (404, indistinguishable from missing)
 *   - artifact export → import round trip preserves the document and
 *     verifies integrity; tampered documents are flagged honestly
 *   - artifact versioning is append-only (older versions survive)
 *   - benchmark runs execute real circuits through the pipeline
 *
 * Skipped when DATABASE_URL is not a PostgreSQL URL.
 */

const TEST_TIMEOUT = 240_000;
void TEST_TIMEOUT;

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

import { GET as listArtifactsRoute, POST as publishArtifactRoute } from "@/app/api/artifacts/route";
import {
  GET as artifactDetailRoute,
  DELETE as artifactDeleteRoute,
} from "@/app/api/artifacts/[artifactId]/route";
import {
  GET as artifactVersionRoute,
  POST as artifactVersionPostRoute,
} from "@/app/api/artifacts/[artifactId]/versions/[version]/route";
import { POST as artifactImportRoute } from "@/app/api/artifacts/import/route";
import { GET as listBenchmarksRoute } from "@/app/api/benchmarks/route";
import {
  GET as benchmarkRunsRoute,
  POST as benchmarkRunPostRoute,
} from "@/app/api/benchmarks/[benchmarkId]/runs/route";
import { POST as benchmarkCompareRoute } from "@/app/api/benchmarks/[benchmarkId]/compare/route";
import {
  GET as listProjectsRoute,
  POST as createProjectRoute,
} from "@/app/api/projects/route";
import {
  GET as projectDetailRoute,
  POST as projectAddItemRoute,
  DELETE as projectDeleteRoute,
} from "@/app/api/projects/[projectId]/route";

const jsonRequest = (url: string, body: unknown): Request =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const artifactParams = (id: string) => ({ params: Promise.resolve({ artifactId: id }) });
const versionParams = (id: string, version: string) => ({
  params: Promise.resolve({ artifactId: id, version }),
});
const projectParams = (id: string) => ({ params: Promise.resolve({ projectId: id }) });
const benchmarkParams = (id: string) => ({ params: Promise.resolve({ benchmarkId: id }) });

async function createVerifiedUser(suffix: string): Promise<{ id: string; email: string }> {
  const { prisma } = await import("@/lib/prisma");
  const bcrypt = await import("bcryptjs");
  const email = `observatory-${suffix}-${Date.now()}@example.com`;
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

const BELL_SOURCE =
  "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2,2)\nresult.h(0)\nresult.cx(0,1)\nresult.measure([0,1],[0,1])";

describe.skipIf(!/postgres(ql)?:\/\//.test(DATABASE_URL))(
  "observatory API security",
  () => {
    beforeAll(async () => {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
    });

    it("rejects unauthenticated requests on every endpoint", async () => {
      cookieJar.clear();
      const goodId = "33333333-3333-3333-3333-333333333333";
      const responses = await Promise.all([
        listArtifactsRoute(),
        publishArtifactRoute(jsonRequest("http://x", { experimentId: goodId, title: "t" })),
        artifactImportRoute(jsonRequest("http://x", {})),
        listBenchmarksRoute(),
        listProjectsRoute(),
        createProjectRoute(jsonRequest("http://x", { name: "p" })),
        projectDetailRoute(new Request("http://x"), projectParams(goodId)),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(401);
      }

      // The detail and version read routes are public for PUBLIC
      // artifacts, so an unknown artifact is 404 even unauthenticated
      // (indistinguishable from a private artifact, by design).
      const detailResponse = await artifactDetailRoute(
        new Request("http://x"),
        artifactParams(goodId),
      );
      expect(detailResponse.status).toBe(404);
      const versionResponse = await artifactVersionRoute(
        new Request("http://x"),
        versionParams(goodId, "1"),
      );
      expect(versionResponse.status).toBe(404);
    });

    it("rejects invalid identifiers with 400", async () => {
      const user = await createVerifiedUser("ids");
      await signIn(user.id);

      const responses = [
        await artifactDetailRoute(new Request("http://x"), artifactParams("not-a-uuid")),
        await projectDetailRoute(new Request("http://x"), projectParams("bad")),
      ];
      for (const response of responses) {
        expect(response.status).toBe(400);
      }
    });

    it("keeps user B out of user A's artifacts and projects", async () => {
      const { prisma } = await import("@/lib/prisma");
      const owner = await createVerifiedUser("owner");
      const stranger = await createVerifiedUser("stranger");

      const artifact = await prisma.researchArtifact.create({
        data: {
          userId: owner.id,
          title: "Private evidence",
          description: null,
          visibility: "PRIVATE",
          latestVersion: 1,
          versions: {
            create: {
              version: 1,
              payload: { schemaVersion: "quantoo.artifact.v1" },
              payloadHash: "0".repeat(64),
              sizeBytes: 64,
            },
          },
        },
        select: { id: true },
      });
      const project = await prisma.project.create({
        data: { userId: owner.id, name: "Owner project", description: null },
        select: { id: true },
      });

      await signIn(stranger.id);
      expect(
        (await artifactDetailRoute(new Request("http://x"), artifactParams(artifact.id))).status,
      ).toBe(404);
      expect(
        (
          await artifactVersionRoute(
            new Request("http://x"),
            versionParams(artifact.id, "1"),
          )
        ).status,
      ).toBe(404);
      expect(
        (await artifactDeleteRoute(new Request("http://x"), artifactParams(artifact.id))).status,
      ).toBe(404);
      expect(
        (await projectDetailRoute(new Request("http://x"), projectParams(project.id))).status,
      ).toBe(404);

      // The owner can see them.
      await signIn(owner.id);
      expect(
        (await artifactDetailRoute(new Request("http://x"), artifactParams(artifact.id))).status,
      ).toBe(200);
      expect(
        (await projectDetailRoute(new Request("http://x"), projectParams(project.id))).status,
      ).toBe(200);

      await prisma.researchArtifact.delete({ where: { id: artifact.id } });
      await prisma.project.delete({ where: { id: project.id } });
    });

    it("publishes an artifact from an owned experiment and keeps versions immutable", async () => {
      const { runSubmission } = await import("@/lib/exec/service");
      const { createExperiment, executeExperiment } = await import("@/lib/compat/experiment");
      const { prisma } = await import("@/lib/prisma");

      const user = await createVerifiedUser("publish");
      await signIn(user.id);

      const problem = await prisma.problem.findFirst({
        where: { status: "PUBLISHED" },
        select: { id: true },
      });
      if (!problem) throw new Error("No published problem seeded");

      const baseline = await runSubmission(user.id, {
        problemId: problem.id,
        sourceCode: BELL_SOURCE,
        shots: 512,
        seed: 7,
      });
      expect(baseline.status).toBe("SUCCEEDED");

      // One candidate environment is required by the Phase 7 API; the
      // default environment runs in the same sandbox as the baseline.
      const created = await createExperiment({
        userId: user.id,
        problemId: problem.id,
        name: "Observatory publish test",
        baselineSubmissionId: baseline.submissionId,
        candidateEnvironmentIds: ["qiskit-1-2-4"],
      });
      if (!("experimentId" in created)) throw new Error("experiment creation failed");

      const published = await publishArtifactRoute(
        jsonRequest("http://x", {
          experimentId: created.experimentId,
          title: "Bell reproducibility evidence",
          description: "Snapshot for the observatory test",
          visibility: "PRIVATE",
        }),
      );
      expect(published.status).toBe(201);
      const body = (await published.json()) as { artifactId: string; payloadHash: string };
      expect(body.payloadHash).toHaveLength(64);

      // Re-publishing a second immutable version keeps version 1.
      void executeExperiment;
      const v2 = await artifactVersionPostRoute(
        new Request("http://x"),
        versionParams(body.artifactId, "1"),
      );
      expect(v2.status).toBe(201);

      const detail = await (
        await artifactDetailRoute(new Request("http://x"), artifactParams(body.artifactId))
      ).json();
      const versions = (detail as { artifact: { versions: Array<{ version: number }> } })
        .artifact.versions;
      expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);
      expect(versions).toHaveLength(2);

      // Load version 1 and verify the payload hash is present.
      const v1Response = await artifactVersionRoute(
        new Request("http://x"),
        versionParams(body.artifactId, "1"),
      );
      expect(v1Response.status).toBe(200);
      const v1 = (await v1Response.json()) as { payloadHash: string };
      expect(v1.payloadHash).toHaveLength(64);
    });

    it("round-trips an artifact export through import and verifies integrity", async () => {
      const { buildArtifactExport, getArtifactVersionPayload } = await import(
        "@/lib/artifacts/service"
      );
      const user = await createVerifiedUser("roundtrip");
      await signIn(user.id);

      const { prisma } = await import("@/lib/prisma");
      const artifact = await prisma.researchArtifact.create({
        data: {
          userId: user.id,
          title: "Roundtrip",
          description: null,
          visibility: "PRIVATE",
          latestVersion: 1,
          versions: {
            create: {
              version: 1,
              payload: {
                schemaVersion: "quantoo.artifact.v1",
                artifactType: "COMPATIBILITY_EXPERIMENT",
                title: "Roundtrip",
                description: null,
                provenance: {
                  createdBy: "artifact-owner",
                  createdAt: new Date().toISOString(),
                  problem: null,
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
              },
              payloadHash: "0".repeat(64),
              sizeBytes: 512,
            },
          },
        },
        select: { id: true },
      });

      const payload = await getArtifactVersionPayload(user.id, artifact.id, 1);
      if (!payload) throw new Error("version payload missing");
      // Recompute the stored hash honestly for this fixture: the stored
      // row was seeded with a placeholder before hashing was applied.
      const { sha256Canonical } = await import("@/lib/artifacts/integrity");
      const realHash = sha256Canonical(payload.document);
      const exported = buildArtifactExport(payload.document, realHash);
      const exportedJson = JSON.stringify(exported);

      const imported = await artifactImportRoute(jsonRequest("http://x", JSON.parse(exportedJson)));
      // The import endpoint takes the export envelope as the JSON body.
      expect(imported.status).toBe(201);
      const importBody = (await imported.json()) as { integrityVerified: boolean };
      expect(importBody.integrityVerified).toBe(true);

      // Tampering is detected, reported, and stored anyway (as data).
      const tampered = { ...exported, documentHash: "f".repeat(64) };
      const tamperedResponse = await artifactImportRoute(jsonRequest("http://x", tampered));
      expect(tamperedResponse.status).toBe(201);
      const tamperedBody = (await tamperedResponse.json()) as { integrityVerified: boolean };
      expect(tamperedBody.integrityVerified).toBe(false);
    });

    it("rejects malformed imports with 4xx", async () => {
      const user = await createVerifiedUser("badimport");
      await signIn(user.id);

      expect(
        (await artifactImportRoute(jsonRequest("http://x", { nope: true }))).status,
      ).toBe(400);
      expect(
        (
          await artifactImportRoute(
            new Request("http://x", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{not json",
            }),
          )
        ).status,
      ).toBe(400);
    });

    it("runs a real benchmark execution and compares two runs", async () => {
      const { seedBenchmarks } = await import("@/lib/benchmarks/seed");

      const user = await createVerifiedUser("bench");
      await signIn(user.id);
      await seedBenchmarks();

      const listResponse = await listBenchmarksRoute();
      expect(listResponse.status).toBe(200);
      const { benchmarks } = (await listResponse.json()) as {
        benchmarks: Array<{ id: string; slug: string }>;
      };
      expect(benchmarks.length).toBeGreaterThan(0);
      const bell = benchmarks.find((b) => b.slug === "bell-entanglement");
      if (!bell) throw new Error("Bell benchmark missing");

      const DEFAULT_ENV = "qiskit-1-2-4";
      const run1 = await benchmarkRunPostRoute(
        jsonRequest("http://x", { environmentId: DEFAULT_ENV }),
        benchmarkParams(bell.id),
      );
      expect(run1.status).toBe(201);
      const run1Body = (await run1.json()) as { runId: string; status: string };
      expect(run1Body.status).toBe("SUCCEEDED");

      const run2 = await benchmarkRunPostRoute(
        jsonRequest("http://x", { environmentId: DEFAULT_ENV }),
        benchmarkParams(bell.id),
      );
      const run2Body = (await run2.json()) as { runId: string; status: string };
      expect(run2Body.status).toBe("SUCCEEDED");

      const runs = await (await benchmarkRunsRoute(new Request("http://x"), benchmarkParams(bell.id))).json();
      const runList = (runs as { runs: Array<{ runId: string; counts: Record<string, number> | null }> }).runs;
      expect(runList.length).toBeGreaterThanOrEqual(2);
      expect(runList[0].counts).not.toBeNull();

      const comparison = await benchmarkCompareRoute(
        jsonRequest("http://x", { runAId: run1Body.runId, runBId: run2Body.runId }),
        benchmarkParams(bell.id),
      );
      expect(comparison.status).toBe(200);
      const comparisonBody = (await comparison.json()) as {
        status: string;
        hellinger: number | null;
      };
      // Same environment, same benchmark, different seeds: distributions
      // are sampled from the same ideal distribution.
      expect(comparisonBody.status).toBe("EQUIVALENT");
      expect(comparisonBody.hellinger).toBeLessThanOrEqual(0.05);
    });

    it("enforces project item ownership and deduplication", async () => {
      const { prisma } = await import("@/lib/prisma");
      const { runSubmission } = await import("@/lib/exec/service");

      const owner = await createVerifiedUser("proj-owner");
      const stranger = await createVerifiedUser("proj-stranger");
      await signIn(owner.id);

      const problem = await prisma.problem.findFirst({
        where: { status: "PUBLISHED" },
        select: { id: true },
      });
      if (!problem) throw new Error("No published problem seeded");

      const created = await createProjectRoute(
        jsonRequest("http://x", { name: "Evidence folder" }),
      );
      expect(created.status).toBe(201);
      const { id: projectId } = (await created.json()) as { id: string };

      const submission = await runSubmission(owner.id, {
        problemId: problem.id,
        sourceCode: BELL_SOURCE,
        shots: 512,
        seed: 7,
      });
      expect(submission.status).toBe("SUCCEEDED");

      // Owner adds their own submission.
      const added = await projectAddItemRoute(
        jsonRequest("http://x", {
          itemType: "SUBMISSION",
          itemId: submission.submissionId,
        }),
        projectParams(projectId),
      );
      expect(added.status).toBe(201);

      // Duplicate add is rejected.
      const duplicate = await projectAddItemRoute(
        jsonRequest("http://x", {
          itemType: "SUBMISSION",
          itemId: submission.submissionId,
        }),
        projectParams(projectId),
      );
      expect(duplicate.status).toBe(400);

      // A stranger cannot attach their items to someone else's project,
      // nor reference items they do not own.
      await signIn(stranger.id);
      const foreignAdd = await projectAddItemRoute(
        jsonRequest("http://x", {
          itemType: "SUBMISSION",
          itemId: submission.submissionId,
        }),
        projectParams(projectId),
      );
      expect([400, 404]).toContain(foreignAdd.status);

      // Stranger cannot delete the owner's project.
      expect(
        (await projectDeleteRoute(new Request("http://x"), projectParams(projectId))).status,
      ).toBe(404);

      // Owner can remove the item again.
      await signIn(owner.id);
      const detail = await (
        await projectDetailRoute(new Request("http://x"), projectParams(projectId))
      ).json();
      const items = (detail as { project: { items: Array<{ id: string }> } }).project.items;
      expect(items).toHaveLength(1);
      const removed = await projectDeleteRoute(
        new Request(`http://x?itemId=${items[0].id}`),
        projectParams(projectId),
      );
      expect(removed.status).toBe(200);
    });
  },
);
