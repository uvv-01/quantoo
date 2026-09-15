import { notFound } from "next/navigation";
import { getProblemBySlug } from "@/lib/server/problem-service";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";
import {
  Clock,
  Atom,
  BookOpen,
  AlertTriangle,
  Code,
  Target,
  Lightbulb,
} from "lucide-react";

interface ProblemDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProblemDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const problem = await getProblemBySlug(slug);

  if (!problem) {
    return { title: "Problem not found" };
  }

  return {
    title: problem.title,
    description: problem.shortDescription,
  };
}

export default async function ProblemDetailPage({
  params,
}: ProblemDetailPageProps) {
  const { slug } = await params;
  const problem = await getProblemBySlug(slug);

  if (!problem) {
    notFound();
  }

  const diffConfig =
    DIFFICULTY_CONFIG[problem.difficulty as keyof typeof DIFFICULTY_CONFIG];

  // Parse JSON fields safely
  const hints = Array.isArray(problem.hints) ? problem.hints : [];
  const requirements =
    problem.requirements &&
    typeof problem.requirements === "object" &&
    !Array.isArray(problem.requirements)
      ? (problem.requirements as Record<string, unknown>)
      : null;
  const expectedOutcome =
    problem.expectedOutcome &&
    typeof problem.expectedOutcome === "object" &&
    !Array.isArray(problem.expectedOutcome)
      ? (problem.expectedOutcome as Record<string, unknown>)
      : null;
  const learningObjectives = problem.learningObjectives
    ? safeParseJSONArray(problem.learningObjectives)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="outline" className={diffConfig?.color}>
            {diffConfig?.label ?? problem.difficulty}
          </Badge>
          {problem.estimatedMinutes && (
            <span className="inline-flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" aria-hidden="true" />
              {problem.estimatedMinutes} min estimated
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{problem.title}</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {problem.shortDescription}
        </p>

        {/* Concepts and tags */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {problem.concepts.map((c) => (
            <Badge key={c.slug} variant="secondary">
              {c.name}
            </Badge>
          ))}
          {problem.tags.map((t) => (
            <Badge key={t.slug} variant="outline">
              {t.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Problem Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {problem.description}
              </div>
            </CardContent>
          </Card>

          {/* Learning objectives */}
          {learningObjectives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  Learning Objectives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {learningObjectives.map((obj: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Requirements */}
          {requirements && Object.keys(requirements).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(requirements).map(([key, value]) => (
                    <div key={key} className="rounded-md bg-muted/50 p-3">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {formatKey(key)}
                      </dt>
                      <dd className="mt-1 text-sm font-medium">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Expected outcome */}
          {expectedOutcome && Object.keys(expectedOutcome).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Atom className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  Expected Outcome
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  {Object.entries(expectedOutcome).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {formatKey(key)}
                      </dt>
                      <dd className="mt-1 text-sm">
                        {typeof value === "object"
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Hints */}
          {hints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  Hints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {hints.map((hint, i: number) => (
                    <li
                      key={i}
                      className="rounded-md bg-muted/50 p-3 text-sm"
                    >
                      <span className="font-medium text-muted-foreground">
                        Hint {i + 1}:
                      </span>{" "}
                      {typeof hint === "object" && hint !== null && "content" in hint
                        ? String((hint as { content: unknown }).content)
                        : String(hint)}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Code workspace placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Code className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Code Workspace
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Coming in Phase 4"
                description="The code workspace with quantum execution and evaluation will be available in a future phase."
                className="border-0 p-4 shadow-none"
              />
            </CardContent>
          </Card>

          {/* Related problems */}
          {problem.relatedProblems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Related Problems</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {problem.relatedProblems.map((rel) => {
                    const relDiff =
                      DIFFICULTY_CONFIG[
                        rel.problem.difficulty as keyof typeof DIFFICULTY_CONFIG
                      ];
                    return (
                      <li key={rel.problem.id}>
                        <a
                          href={`/problems/${rel.problem.slug}`}
                          className="block rounded-md p-2 hover:bg-accent transition-colors"
                        >
                          <span className="text-sm font-medium hover:text-primary transition-colors">
                            {rel.problem.title}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${relDiff?.color}`}
                            >
                              {relDiff?.label ?? rel.problem.difficulty}
                            </Badge>
                            <span className="text-xs text-muted-foreground capitalize">
                              {rel.relationType.replace("_", " ")}
                            </span>
                          </div>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Prerequisites */}
          {problem.prerequisites && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Prerequisites</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {problem.prerequisites}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// Helpers
// ========================================

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function safeParseJSONArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // If not valid JSON, try newline-separated
    return value
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }
}
