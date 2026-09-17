/**
 * /problems/[slug]/solve - the quantum workspace.
 *
 * Server component: loads the published problem, the current user's draft
 * code, and authentication state, then renders the interactive workspace.
 * Unauthenticated visitors can read the problem and code but cannot run.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProblemBySlug } from "@/lib/server/problem-service";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { QuantumWorkspace } from "@/components/workspace/quantum-workspace";

interface SolvePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: SolvePageProps): Promise<Metadata> {
  const { slug } = await params;
  const problem = await getProblemBySlug(slug);
  if (!problem) return { title: "Problem not found" };
  return {
    title: `Solve: ${problem.title}`,
    description: problem.shortDescription,
  };
}

function parseObjectives(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default async function SolvePage({ params }: SolvePageProps) {
  const { slug } = await params;
  const problem = await getProblemBySlug(slug);
  if (!problem) notFound();

  const user = await getAuthenticatedUser();

  let draft: string | null = null;
  if (user) {
    const saved = await prisma.problemDraft.findUnique({
      where: {
        userId_problemId: { userId: user.id, problemId: problem.id },
      },
      select: { sourceCode: true },
    });
    draft = saved?.sourceCode ?? null;
  }

  return (
    <QuantumWorkspace
      isAuthenticated={user !== null}
      initialDraft={draft}
      problem={{
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        estimatedMinutes: problem.estimatedMinutes,
        shortDescription: problem.shortDescription,
        description: problem.description,
        learningObjectives: parseObjectives(problem.learningObjectives),
        starterCode: problem.starterCode,
        conceptNames: problem.concepts.map((c) => c.name),
      }}
    />
  );
}
