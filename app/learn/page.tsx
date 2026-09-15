"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/lib/constants";
import {
  Atom,
  BookOpen,
  Layers,
  Zap,
  Brain,
  Cpu,
  CircuitBoard,
} from "lucide-react";

interface LearningTopic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
  problemCount: number;
  conceptCount: number;
}

const CATEGORY_ICONS: Record<string, typeof Atom> = {
  foundations: Atom,
  gates: Zap,
  circuits: CircuitBoard,
  algorithms: Brain,
  "error-correction": Cpu,
  advanced: Layers,
  default: BookOpen,
};

function getCategoryIcon(category: string | null): typeof Atom {
  if (!category) return CATEGORY_ICONS.default;
  return CATEGORY_ICONS[category.toLowerCase()] ?? CATEGORY_ICONS.default;
}

export default function LearnPage() {
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopics() {
      try {
        const res = await fetch("/api/learn");
        if (res.ok) {
          const data = await res.json();
          setTopics(data.topics);
        }
      } catch {
        // UI shows loading/empty state
      } finally {
        setLoading(false);
      }
    }
    fetchTopics();
  }, []);

  // Group by category
  const grouped = topics.reduce<Record<string, LearningTopic[]>>(
    (acc, topic) => {
      const cat = topic.category ?? "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(topic);
      return acc;
    },
    {},
  );

  const categories = Object.entries(grouped).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Learn</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Structured quantum computing learning paths from foundations to
          advanced algorithms.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : topics.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No learning topics yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Learning topics will be added as the content system grows.
                Topics will cover quantum computing foundations, gates,
                circuits, algorithms, and more.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {categories.map(([category, categoryTopics]) => {
            const Icon = getCategoryIcon(category);
            return (
              <section key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h2 className="text-lg font-semibold capitalize">
                    {category}
                  </h2>
                  <Badge variant="secondary">
                    {categoryTopics.length} topic
                    {categoryTopics.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryTopics.map((topic) => (
                    <Link
                      key={topic.id}
                      href={ROUTES.learnTopic(topic.slug)}
                      className="block group"
                    >
                      <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:shadow-md">
                        <CardHeader>
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {topic.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {topic.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {topic.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                            <span>
                              {topic.conceptCount} concept
                              {topic.conceptCount !== 1 ? "s" : ""}
                            </span>
                            <span className="text-border">|</span>
                            <span>
                              {topic.problemCount} problem
                              {topic.problemCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
