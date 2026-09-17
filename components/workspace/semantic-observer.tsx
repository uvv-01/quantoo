"use client";

/**
 * Semantic Observer (Phase 6).
 *
 * In-workspace surface for the Quantum Semantic Observatory: pick two of
 * your own executions, compare them under an explicit policy, inspect the
 * per-dimension evidence, reproduce an execution, and jump into the Phase 5
 * debugger at the first observed divergence.
 *
 * Every verdict shown comes from the server, computed from persisted
 * execution artifacts. The component never fabricates quantum data; when
 * evidence is missing it renders the server's limitation text.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  GitCompareArrows,
  Loader2,
  MinusCircle,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuantumDebugger } from "@/components/workspace/quantum-debugger";
import type { SemanticComparison } from "@/lib/semantic/types";

interface ExecutionRow {
  id: string;
  createdAt: string;
  status: string;
  passed: boolean | null;
  hasArtifact: boolean;
  durationMs: number | null;
}

interface BaselineInfo {
  submissionId: string;
  policyName: string;
}

const STATUS_STYLES: Record<string, string> = {
  EQUIVALENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  BEHAVIORALLY_EQUIVALENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  STRUCTURALLY_EQUIVALENT: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  RESOURCE_REGRESSION: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  ENVIRONMENT_DIFFERENT: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DIFFERENT: "border-destructive/50 bg-destructive/10 text-destructive",
  INSUFFICIENT_EVIDENCE: "border-muted-foreground/40 bg-muted text-muted-foreground",
  REPRODUCED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  NOT_REPRODUCED: "border-destructive/50 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.INSUFFICIENT_EVIDENCE;
  const label = status.replaceAll("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}

function DimensionIcon({ status }: { status: string }) {
  if (status === "PASS")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />;
  if (status === "DIFFERENT")
    return <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />;
  if (status === "WARNING")
    return <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SemanticObserver({ problemSlug }: { problemSlug: string }) {
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [baseline, setBaseline] = useState<BaselineInfo | null>(null);
  const [selectionA, setSelectionA] = useState<string>("");
  const [selectionB, setSelectionB] = useState<string>("");
  const [policy, setPolicy] = useState<"statistical-default" | "exact">(
    "statistical-default",
  );
  const [comparison, setComparison] = useState<SemanticComparison | null>(null);
  const [busy, setBusy] = useState<null | "compare" | "baseline" | "reproduce" | "reproduce-b">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reproduction, setReproduction] = useState<{
    id: string;
    status: string;
  } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/semantic/executions?problemSlug=${encodeURIComponent(problemSlug)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not load executions.");
      }
      const data = (await res.json()) as {
        executions: ExecutionRow[];
        baseline: BaselineInfo | null;
      };
      setExecutions(data.executions);
      setBaseline(data.baseline);
      setSelectionA((prev) => prev || data.executions[0]?.id || "");
      setSelectionB((prev) => prev || data.executions[1]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load executions.");
    }
  }, [problemSlug]);

  // Load the execution list on mount (and after mutations re-fetch via
  // load()). State updates happen in promise callbacks only.
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/semantic/executions?problemSlug=${encodeURIComponent(problemSlug)}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Could not load executions.");
        }
        return res.json() as Promise<{
          executions: ExecutionRow[];
          baseline: BaselineInfo | null;
        }>;
      })
      .then((data) => {
        setExecutions(data.executions);
        setBaseline(data.baseline);
        setSelectionA((prev) => prev || data.executions[0]?.id || "");
        setSelectionB((prev) => prev || data.executions[1]?.id || "");
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === "AbortError") return;
        setError(
          error instanceof Error ? error.message : "Could not load executions.",
        );
      });
    return () => controller.abort();
  }, [problemSlug]);

  const runCompare = useCallback(async () => {
    if (!selectionA || !selectionB) return;
    setBusy("compare");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/semantic/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionIdA: selectionA,
          submissionIdB: selectionB,
          policy,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        comparison?: SemanticComparison;
        error?: string;
      } | null;
      if (!res.ok || !body?.comparison) {
        throw new Error(body?.error ?? "Comparison failed.");
      }
      setComparison(body.comparison);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setBusy(null);
    }
  }, [selectionA, selectionB, policy]);

  const setAsBaseline = useCallback(
    async (submissionId: string) => {
      setBusy("baseline");
      setError(null);
      setMessage(null);
      try {
        const res = await fetch("/api/semantic/baselines", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemSlug, submissionId, policy }),
        });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(body?.error ?? "Could not set the baseline.");
        setMessage("Baseline updated.");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not set the baseline.");
      } finally {
        setBusy(null);
      }
    },
    [problemSlug, policy, load],
  );

  const reproduce = useCallback(
    async (submissionId: string) => {
      setBusy(submissionId === selectionA ? "reproduce" : "reproduce-b");
      setError(null);
      setMessage(null);
      setReproduction(null);
      try {
        const res = await fetch("/api/semantic/reproduce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId, policy }),
        });
        const body = (await res.json().catch(() => null)) as {
          overallStatus?: string;
          reproductionSubmissionId?: string;
          error?: string;
        } | null;
        if (!res.ok || !body?.overallStatus) {
          throw new Error(body?.error ?? "Reproduction failed.");
        }
        setReproduction({
          id: body.reproductionSubmissionId ?? "",
          status: body.overallStatus,
        });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reproduction failed.");
      } finally {
        setBusy(null);
      }
    },
    [policy, selectionA, load],
  );

  return (
    <Card role="region" aria-label="Semantic observatory">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" aria-hidden="true" />
          Semantic Observatory
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Compare two of your executions and see what actually changed —
          structure, behavior, resources, and environment — with the evidence
          for every conclusion.
        </p>

        {error && (
          <p
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {message}
          </p>
        )}

        {executions.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Run your code at least twice to compare executions. Failed runs
            have no behavioral evidence to compare.
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div>
                <label
                  htmlFor="semantic-exec-a"
                  className="mb-1 block text-sm font-medium"
                >
                  Execution A
                </label>
                <select
                  id="semantic-exec-a"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectionA}
                  onChange={(e) => setSelectionA(e.target.value)}
                >
                  {executions.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {formatTime(ex.createdAt)} · {ex.passed === true ? "passed" : ex.passed === false ? "failed checks" : "no verdict"}
                      {baseline?.submissionId === ex.id ? " · baseline" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="semantic-exec-b"
                  className="mb-1 block text-sm font-medium"
                >
                  Execution B
                </label>
                <select
                  id="semantic-exec-b"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectionB}
                  onChange={(e) => setSelectionB(e.target.value)}
                >
                  {executions.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {formatTime(ex.createdAt)} · {ex.passed === true ? "passed" : ex.passed === false ? "failed checks" : "no verdict"}
                      {baseline?.submissionId === ex.id ? " · baseline" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="semantic-policy" className="sr-only">
                  Comparison policy
                </label>
                <select
                  id="semantic-policy"
                  aria-label="Comparison policy"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={policy}
                  onChange={(e) =>
                    setPolicy(e.target.value as typeof policy)
                  }
                >
                  <option value="statistical-default">Statistical</option>
                  <option value="exact">Exact</option>
                </select>
                <Button
                  type="button"
                  onClick={runCompare}
                  disabled={busy !== null || selectionA === selectionB}
                >
                  {busy === "compare" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                  )}
                  Compare
                </Button>
              </div>
            </div>

            {/* Comparison result */}
            {comparison && (
              <div className="space-y-3" aria-live="polite">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={comparison.overallStatus} />
                  <p className="text-sm text-muted-foreground">{comparison.summary}</p>
                </div>
                <ul className="space-y-2">
                  {comparison.differences.map((d) => (
                    <li
                      key={d.dimension}
                      className="flex items-start gap-2 rounded-md border p-3 text-sm"
                    >
                      <DimensionIcon status={d.status} />
                      <div className="min-w-0">
                        <p className="font-medium">
                          {d.dimension.replaceAll("_", " ")}
                          {d.status !== "PASS" && d.status !== "NOT_COMPARED"
                            ? ` — ${d.status}`
                            : ""}
                        </p>
                        <p className="text-muted-foreground">{d.message}</p>
                        {d.value !== undefined && d.threshold !== undefined && d.metric && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            metric {d.metric}: {d.value} (threshold {d.threshold})
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {comparison.limitations.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                    <p className="font-medium">Limitations</p>
                    <ul className="mt-1 list-disc pl-5">
                      {comparison.limitations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {comparison.firstDivergenceStep !== null && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      First observed structural divergence: operation index{" "}
                      {comparison.firstDivergenceStep} in execution A.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDebugOpen(true)}
                    >
                      Inspect at divergence
                    </Button>
                  </div>
                )}
                <QuantumDebugger
                  submissionId={selectionA}
                  open={debugOpen}
                  initialStep={comparison.firstDivergenceStep}
                />
              </div>
            )}

            {/* Per-execution actions */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Execution actions</h3>
              <ul className="space-y-2">
                {executions.slice(0, 5).map((ex) => {
                  const isBusy =
                    (busy === "reproduce" && ex.id === selectionA) ||
                    (busy === "reproduce-b" && ex.id === selectionB);
                  return (
                    <li
                      key={ex.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                    >
                      <div>
                        <p>
                          {formatTime(ex.createdAt)} ·{" "}
                          {ex.passed === true
                            ? "passed checks"
                            : ex.passed === false
                              ? "failed checks"
                              : "no verdict"}
                          {baseline?.submissionId === ex.id && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                              baseline
                            </span>
                          )}
                        </p>
                        {reproduction && reproduction.id === ex.id && (
                          <p className="mt-1">
                            <StatusBadge status={reproduction.status} />
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void reproduce(ex.id)}
                          disabled={busy !== null}
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <FlaskConical className="h-4 w-4" aria-hidden="true" />
                          )}
                          Reproduce
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void setAsBaseline(ex.id)}
                          disabled={busy !== null || baseline?.submissionId === ex.id}
                        >
                          {busy === "baseline" ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Play className="h-4 w-4" aria-hidden="true" />
                          )}
                          Set as baseline
                        </Button>
                        <a
                          href={`/api/semantic/capsules/${ex.id}`}
                          className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent"
                          download
                        >
                          Capsule
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
