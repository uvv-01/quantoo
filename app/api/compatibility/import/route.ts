/**
 * POST /api/compatibility/import
 *
 * Imports a versioned reproducibility package (quantoo.experiment.v1) as
 * untrusted input. The package's source is stored on a new experiment
 * owned by the importing user and is executed only later, only through
 * the standard sandboxed pipeline, and only in registered environments.
 * No field of the package is ever interpreted as a command, path, or
 * dependency instruction. Environment ids are filtered against this
 * deployment's registry: unknown ids are skipped, never fetched.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { importPackageSchema } from "@/lib/compat/validation";
import { importExperimentPackage, MAX_PACKAGE_BYTES } from "@/lib/compat/experiment";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(
      getRateLimitKey(user.id, "compatibility"),
      RATE_LIMITS.compatibility,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
            ),
          },
        },
      );
    }

    const rawText = await request.text();
    if (Buffer.byteLength(rawText, "utf8") > MAX_PACKAGE_BYTES) {
      return NextResponse.json({ error: "Package is too large." }, { status: 413 });
    }

    const body: unknown = (() => {
      try {
        return JSON.parse(rawText);
      } catch {
        return null;
      }
    })();

    const parsed = importPackageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid package." },
        { status: 400 },
      );
    }

    // Resolve the problem the package belongs to. The package may carry a
    // problem slug, but only as a *hint*: the import is attached to a
    // problem that exists and is published in this deployment.
    let problemId: string | null = null;
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as Record<string, unknown>).problem === "object" &&
      (body as Record<string, unknown>).problem !== null
    ) {
      const problemMeta = (body as Record<string, unknown>).problem as Record<string, unknown>;
      if (typeof problemMeta.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problemMeta.slug)) {
        const problem = await prisma.problem.findUnique({
          where: { slug: problemMeta.slug },
          select: { id: true, status: true, publishedAt: true },
        });
        if (problem && problem.status === "PUBLISHED" && problem.publishedAt) {
          problemId = problem.id;
        }
      }
    }
    if (!problemId) {
      return NextResponse.json(
        { error: "The package's problem does not exist in this deployment. Open the problem first and import from there." },
        { status: 400 },
      );
    }

    const result = await importExperimentPackage(user.id, problemId, rawText);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.code });
    }

    logger.info("compatibility package import accepted", {
      userId: user.id,
      experimentId: result.experimentId,
      candidates: result.acceptedEnvironmentIds.length,
    });

    return NextResponse.json({
      experimentId: result.experimentId,
      acceptedEnvironmentIds: result.acceptedEnvironmentIds,
      message:
        "Imported. Run the experiment to execute the program in this deployment's environments.",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to import the package." },
      { status: 500 },
    );
  }
}
