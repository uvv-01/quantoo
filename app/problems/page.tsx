"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES, DIFFICULTY_CONFIG } from "@/lib/constants";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  Atom,
  X,
} from "lucide-react";

interface ProblemListItem {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  difficulty: string;
  estimatedMinutes: number | null;
  concepts: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
}

interface Filters {
  concepts: { name: string; slug: string; category: string | null; count: number }[];
  tags: { name: string; slug: string; count: number }[];
  difficulties: { difficulty: string; count: number }[];
}

interface ProblemsResponse {
  problems: {
    items: ProblemListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filters: Filters;
}

export default function ProblemsPage() {
  const [data, setData] = useState<ProblemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [difficulty, setDifficulty] = useState<string | undefined>();
  const [concept, setConcept] = useState<string | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", "20");
        if (appliedSearch) params.set("search", appliedSearch);
        if (difficulty) params.set("difficulty", difficulty);
        if (concept) params.set("concept", concept);
        if (tag) params.set("tag", tag);

        const res = await fetch(`/api/problems?${params.toString()}`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Error handled silently — UI shows empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, appliedSearch, difficulty, concept, tag]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  }

  function handleDifficultyFilter(d: string) {
    setDifficulty(difficulty === d ? undefined : d);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setAppliedSearch("");
    setDifficulty(undefined);
    setConcept(undefined);
    setTag(undefined);
    setPage(1);
  }

  const hasActiveFilters = appliedSearch || difficulty || concept || tag;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Problems</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quantum computing challenges to build your skills.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search problems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search problems"
          />
        </div>
      </form>

      {/* Difficulty filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter
          className="h-4 w-4 text-muted-foreground mr-1"
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-muted-foreground mr-2">
          Difficulty:
        </span>
        {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => handleDifficultyFilter(key.toUpperCase())}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              difficulty === key.toUpperCase()
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            aria-pressed={difficulty === key.toUpperCase()}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-lg bg-muted/30">
          <span className="text-sm text-muted-foreground">Filters:</span>
          {appliedSearch && (
            <Badge variant="secondary" className="gap-1">
              Search: &ldquo;{appliedSearch}&rdquo;
              <button
                onClick={() => {
                  setSearch("");
                  setAppliedSearch("");
                  setPage(1);
                }}
                className="ml-1 hover:text-foreground"
                aria-label={`Remove search filter: ${appliedSearch}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {difficulty && (
            <Badge variant="secondary" className="gap-1">
              {DIFFICULTY_CONFIG[difficulty as keyof typeof DIFFICULTY_CONFIG]
                ?.label ?? difficulty}
              <button
                onClick={() => {
                  setDifficulty(undefined);
                  setPage(1);
                }}
                className="ml-1 hover:text-foreground"
                aria-label={`Remove difficulty filter: ${difficulty}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <button
            onClick={clearFilters}
            className="text-sm text-muted-foreground hover:text-foreground underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Concept tag filters */}
      {data?.filters.concepts && data.filters.concepts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm font-medium text-muted-foreground mr-2">
            Concepts:
          </span>
          {data.filters.concepts.map((c) => (
            <button
              key={c.slug}
              onClick={() => {
                setConcept(concept === c.slug ? undefined : c.slug);
                setPage(1);
              }}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                concept === c.slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              aria-pressed={concept === c.slug}
            >
              {c.name}
              <span className="ml-1 text-[10px] opacity-60">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tag filters */}
      {data?.filters.tags && data.filters.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm font-medium text-muted-foreground mr-2">
            Tags:
          </span>
          {data.filters.tags.map((t) => (
            <button
              key={t.slug}
              onClick={() => {
                setTag(tag === t.slug ? undefined : t.slug);
                setPage(1);
              }}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                tag === t.slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              aria-pressed={tag === t.slug}
            >
              {t.name}
              <span className="ml-1 text-[10px] opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Problem list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !data || data.problems.items.length === 0 ? (
        <EmptyState
          title="No problems found"
          description={
            hasActiveFilters
              ? "Try changing your filters or search terms."
              : "The problem catalog will be populated soon. Problems will cover qubits, gates, circuits, entanglement, and more."
          }
          icon={<Atom className="h-12 w-12" />}
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
          className="py-12"
        />
      ) : (
        <>
          {/* Results count */}
          <p className="text-sm text-muted-foreground mb-4">
            {data.problems.total} problem{data.problems.total !== 1 ? "s" : ""}
            {hasActiveFilters ? " matching filters" : ""}
          </p>

          {/* Problem cards */}
          <div className="space-y-4">
            {data.problems.items.map((problem) => {
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
                  <Card className="transition-colors group-hover:border-primary/50 group-hover:shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold group-hover:text-primary transition-colors">
                            {problem.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {problem.shortDescription}
                          </p>

                          {/* Metadata */}
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Badge
                              variant="outline"
                              className={diffConfig?.color}
                            >
                              {diffConfig?.label ?? problem.difficulty}
                            </Badge>
                            {problem.estimatedMinutes && (
                              <span className="inline-flex items-center text-xs text-muted-foreground">
                                <Clock
                                  className="h-3 w-3 mr-1"
                                  aria-hidden="true"
                                />
                                {problem.estimatedMinutes} min
                              </span>
                            )}
                            {problem.concepts.map((c) => (
                              <Badge key={c.slug} variant="secondary">
                                {c.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {data.problems.totalPages > 1 && (
            <nav
              className="flex items-center justify-between mt-8"
              aria-label="Pagination"
            >
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.problems.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setPage((p) => Math.min(data.problems.totalPages, p + 1))
                }
                disabled={page >= data.problems.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
