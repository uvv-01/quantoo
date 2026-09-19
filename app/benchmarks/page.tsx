"use client";

/**
 * Benchmarks page (Phase 8).
 *
 * Lists the official benchmark corpus (application-managed definitions)
 * and lets the user execute a benchmark in any registered environment.
 * Runs are real sandboxed executions recorded as submissions; the
 * comparison between two runs is computed server-side from the recorded
 * measurement distributions. Weak evidence (few shots) is labeled as
 * such rather than hidden.
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Gauge } from "lucide-react";

interface BenchmarkEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  shots: number;
  seed: number | null;
}

interface EnvironmentChoice {
  id: string;
  label: string;
  available: boolean;
}

interface RunRow {
  runId: string;
  environmentId: string;
  submissionId: string;
  seed: number | null;
  status: string;
  errorCode: string | null;
  createdAt: string;
  counts: Record<string, number> | null;
  shots: number | null;
}

interface ComparisonView {
  status: string;
  hellinger: number | null;
  tvd: number | null;
  note: string | null;
  environmentAId: string;
  environmentBId: string;
}

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkEntry[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentChoice[]>([]);
  const [runs, setRuns] = useState<Record<string, RunRow[]>>({});
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [comparison, setComparison] = useState<Record<string, ComparisonView | { error: string }>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const loadRuns = useCallback(async (benchmarkId: string) => {
    const response = await fetch(`/api/benchmarks/${benchmarkId}/runs`);
    if (!response.ok) return;
    const body = (await response.json()) as { runs: RunRow[] };
    setRuns((prev) => ({ ...prev, [benchmarkId]: body.runs }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/benchmarks")
        .then(async (response) => {
          if (response.status === 401) {
            if (!cancelled) {
              setNeedsAuth(true);
              setLoading(false);
            }
            return;
          }
          const body = (await response.json()) as { benchmarks: BenchmarkEntry[] };
          if (cancelled) return;
          setBenchmarks(body.benchmarks);

          const envResponse = await fetch("/api/hardware/backends");
          if (envResponse.ok) {
            const envBody = (await envResponse.json()) as {
              backends: Array<{ id: string; name: string; availability: { status: string } }>;
            };
            setEnvironments(
              envBody.backends.map((backend) => ({
                id: backend.id,
                label: backend.name,
                available: backend.availability.status === "AVAILABLE",
              })),
            );
          }

          await Promise.all(body.benchmarks.map((benchmark) => loadRuns(benchmark.id)));
          if (!cancelled) setLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load benchmarks.");
            setLoading(false);
          }
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loadRuns]);

  const runBenchmark = useCallback(
    async (benchmark: BenchmarkEntry) => {
      const environmentId = selection[benchmark.id] ?? environments[0]?.id;
      if (!environmentId) return;
      setRunning(benchmark.id);
      setError(null);
      try {
        const response = await fetch(`/api/benchmarks/${benchmark.id}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ environmentId }),
        });
        if (response.status === 429) {
          setError("Rate limit reached. Please wait before running another benchmark.");
          return;
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "The benchmark run failed.");
          return;
        }
        await loadRuns(benchmark.id);
      } finally {
        setRunning(null);
      }
    },
    [selection, environments, loadRuns],
  );

  const compareRuns = useCallback(async (benchmarkId: string) => {
    const benchmarkRuns = runs[benchmarkId] ?? [];
    if (benchmarkRuns.length < 2) return;
    setComparison((prev) => ({ ...prev, [benchmarkId]: { error: "Comparing…" } }));
    const response = await fetch(`/api/benchmarks/${benchmarkId}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runAId: benchmarkRuns[0].runId, runBId: benchmarkRuns[1].runId }),
    });
    const body = (await response.json().catch(() => null)) as
      | (ComparisonView & { runAId: string; runBId: string })
      | { error: string }
      | null;
    if (!response.ok || !body || "error" in body) {
      setComparison((prev) => ({
        ...prev,
        [benchmarkId]: { error: body && "error" in body ? body.error : "Comparison failed." },
      }));
      return;
    }
    setComparison((prev) => ({ ...prev, [benchmarkId]: body }));
  }, [runs]);

  if (needsAuth) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Benchmarks</h1>
        <EmptyState
          title="Sign in required"
          description="Benchmark executions are recorded against your account. Sign in to run and compare benchmarks."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benchmarks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fixed programs, real executions. Compare behavior across environments and over
            time — measured, not asserted.
          </p>
        </div>
        <Badge variant="outline">
          <Gauge className="h-3 w-3 mr-1" aria-hidden="true" />
          Corpus
        </Badge>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading benchmarks…</p>
      ) : benchmarks.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              title="No benchmarks available"
              description="The benchmark corpus has not been seeded on this deployment."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {benchmarks.map((benchmark) => {
            const benchmarkRuns = runs[benchmark.id] ?? [];
            const compare = comparison[benchmark.id];
            return (
              <Card key={benchmark.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-base">{benchmark.name}</span>
                    <Badge variant="outline">{benchmark.category.replace("_", " ")}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{benchmark.description}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`env-${benchmark.id}`}>
                      Environment
                    </label>
                    <select
                      id={`env-${benchmark.id}`}
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={selection[benchmark.id] ?? environments[0]?.id ?? ""}
                      onChange={(event) =>
                        setSelection((prev) => ({ ...prev, [benchmark.id]: event.target.value }))
                      }
                    >
                      {environments.map((environment) => (
                        <option key={environment.id} value={environment.id}>
                          {environment.label}
                          {environment.available ? "" : " (unavailable)"}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={() => runBenchmark(benchmark)}
                      disabled={running === benchmark.id}
                    >
                      {running === benchmark.id ? "Running…" : "Run benchmark"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => compareRuns(benchmark.id)}
                      disabled={benchmarkRuns.length < 2}
                    >
                      Compare last two runs
                    </Button>
                  </div>

                  {compare ? (
                    <p className="text-sm">
                      {"error" in compare ? (
                        <span className="text-muted-foreground">{compare.error}</span>
                      ) : (
                        <span>
                          Comparison: <strong>{compare.status}</strong>
                          {compare.hellinger !== null
                            ? ` · Hellinger ${compare.hellinger.toFixed(4)}`
                            : ""}
                          {compare.tvd !== null ? ` · TVD ${compare.tvd.toFixed(4)}` : ""}
                          {compare.note ? ` · ${compare.note}` : ""}
                        </span>
                      )}
                    </p>
                  ) : null}

                  {benchmarkRuns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No runs yet. Each run executes the fixed program in the selected
                      environment and records the measurements as a real submission.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <caption className="sr-only">
                          Benchmark runs for {benchmark.name}
                        </caption>
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th scope="col" className="py-2 pr-4">When</th>
                            <th scope="col" className="py-2 pr-4">Environment</th>
                            <th scope="col" className="py-2 pr-4">Status</th>
                            <th scope="col" className="py-2 pr-4">Shots</th>
                            <th scope="col" className="py-2 pr-4">Top outcomes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {benchmarkRuns.slice(0, 5).map((run) => {
                            const top = run.counts
                              ? Object.entries(run.counts)
                                  .sort((a, b) => b[1] - a[1])
                                  .slice(0, 3)
                                  .map(([key, value]) => `${key}: ${value}`)
                                  .join(", ")
                              : null;
                            return (
                              <tr key={run.runId} className="border-b last:border-0">
                                <td className="py-2 pr-4 whitespace-nowrap">
                                  {run.createdAt.slice(0, 16).replace("T", " ")}
                                </td>
                                <td className="py-2 pr-4">{run.environmentId}</td>
                                <td className="py-2 pr-4">
                                  {run.status === "SUCCEEDED" ? (
                                    <Badge variant="default">PASS</Badge>
                                  ) : (
                                    <Badge variant="outline">{run.status}</Badge>
                                  )}
                                </td>
                                <td className="py-2 pr-4">{run.shots ?? "—"}</td>
                                <td className="py-2 pr-4 font-mono text-xs">{top ?? "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
