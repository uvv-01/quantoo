import { notFound } from "next/navigation";
import Link from "next/link";
import { getLearningTopicBySlug } from "@/lib/server/learning-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_CONFIG, ROUTES } from "@/lib/constants";
import type { Metadata } from "next";
import { Clock, ArrowRight, Atom } from "lucide-react";

interface TopicDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: TopicDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getLearningTopicBySlug(slug);

  if (!topic) {
    return { title: "Topic not found" };
  }

  return {
    title: topic.title,
    description: topic.description ?? `Learn about ${topic.title}`,
  };
}

export default async function TopicDetailPage({
  params,
}: TopicDetailPageProps) {
  const { slug } = await params;
  const topic = await getLearningTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href={ROUTES.learn}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Learn
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm">{topic.title}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{topic.title}</h1>
        {topic.description && (
          <p className="text-muted-foreground mt-2">{topic.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3">
          {topic.category && (
            <Badge variant="secondary" className="capitalize">
              {topic.category}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {topic.concepts.length} concept
            {topic.concepts.length !== 1 ? "s" : ""} · {topic.problems.length}{" "}
            problem{topic.problems.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problems in this topic */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Problems</h2>
            {topic.problems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Atom className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No problems in this topic yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {topic.problems.map((problem, index) => {
                  const diffConfig =
                    DIFFICULTY_CONFIG[
                      problem.difficulty as keyof typeof DIFFICULTY_CONFIG
                    ];
                  return (
                    <Link
                      key={problem.id}
                      href={ROUTES.problemDetail(problem.slug)}
                      className="block group"
                    >
                      <Card className="transition-colors group-hover:border-primary/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono text-muted-foreground w-6">
                                {index + 1}.
                              </span>
                              <div>
                                <h3 className="text-sm font-medium group-hover:text-primary transition-colors">
                                  {problem.title}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {problem.shortDescription}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${diffConfig?.color}`}
                              >
                                {diffConfig?.label ?? problem.difficulty}
                              </Badge>
                              {problem.estimatedMinutes && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {problem.estimatedMinutes}m
                                </span>
                              )}
                              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar — Concepts */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Concepts Covered</CardTitle>
            </CardHeader>
            <CardContent>
              {topic.concepts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No concepts listed for this topic.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topic.concepts.map((concept) => (
                    <li key={concept.slug}>
                      <h3 className="text-sm font-medium">{concept.name}</h3>
                      {concept.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {concept.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
