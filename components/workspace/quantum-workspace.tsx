"use client";

/**
 * Quantum workspace.
 *
 * The interactive solve view for a problem: problem briefing, code editor,
 * run control, and the execution/judge result panel. Talks only to the
 * execution API; identity and authorization are server-side.
 *
 * Layout:
 * ┌──────────────────────────────────────────────┐
 * │ Header (title, difficulty, back link)        │
 * ├───────────────────┬──────────────────────────┤
 * │ Problem briefing  │ Code editor              │
 * ├───────────────────┴──────────────────────────┤
 * │ Execution / judge results                    │
 * └──────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Loader2, CheckCircle2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeEditor } from "@/components/workspace/code-editor";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import type { RunResponse } from "@/lib/exec/types";

interface WorkspaceProblem {
  slug: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number | null;
  shortDescription: string;
  description: string;
  learningObjectives: string[];
  starterCode: string | null;
  conceptNames: string[];
}

type RunPhase = "idle" | "running" | "done";

interface JudgeCheckView {
  name: string;
  description: string;
  status: string;
  message?: string;
}

export function QuantumWorkspace({
  problem,
  isAuthenticated,
  initialDraft,
}: {
  problem: WorkspaceProblem;
  isAuthenticated: boolean;
  initialDraft: string | null;
}) {
  const diffConfig =
    DIFFICULTY_CONFIG[problem.difficulty as keyof typeof DIFFICULTY_CONFIG];

  const [code, setCode] = useState(initialDraft ?? problem.starterCode ?? "");
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [result, setResult] = useState<RunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  // Debounced draft autosave for authenticated users. Local edits are kept
  // in React state so nothing is lost if a save fails.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!isAuthenticated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemSlug: problem.slug, sourceCode: code }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 1_200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [code, isAuthenticated, problem.slug]);

  const handleRun = useCallback(async () => {
    if (phase === "running") return;
    setPhase("running");
    setRunError(null);
    setResult(null);
    try {
      const res = await fetch("/api/executions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemSlug: problem.slug,
          sourceCode: code,
          language: "python",
        }),
      });
      const payload = (await res.json().catch(() => null)) as
        | (RunResponse & { error?: string })
        | null;
      if (!res.ok) {
        setRunError(payload?.error ?? "The execution could not be started.");
      } else if (payload) {
        setResult(payload);
      }
    } catch {
      setRunError("Network error: the execution could not be started.");
    } finally {
      setPhase("done");
    }
  }, [code, phase, problem.slug]);

  const running = phase === "running";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className={diffConfig?.color}>
              {diffConfig?.label ?? problem.difficulty}
            </Badge>
            {problem.estimatedMinutes !== null && (
              <span className="text-sm text-muted-foreground">
                {problem.estimatedMinutes} min estimated
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{problem.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <span
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {saveState === "saving" && "Saving draft…"}
              {saveState === "saved" && "Draft saved"}
              {saveState === "error" && "Draft not saved"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              <Link href="/login" className="underline hover:text-foreground">
                Sign in
              </Link>{" "}
              to run and save your work
            </span>
          )}
          <Link
            href={`/problems/${problem.slug}`}
            className="inline-flex h-9 items-center rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Back to problem
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Briefing column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Problem</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {problem.shortDescription}
              </p>
              <div className="prose prose-sm dark:prose-invert mt-4 max-w-none whitespace-pre-wrap text-sm">
                {problem.description}
              </div>
            </CardContent>
          </Card>

          {problem.learningObjectives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Learning Objectives</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {problem.learningObjectives.map((objective, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {objective}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {problem.conceptNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Concepts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {problem.conceptNames.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Editor column */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              solution.py
            </h2>
            <Button
              onClick={handleRun}
              disabled={running || !isAuthenticated}
              aria-label="Run quantum code"
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                  Run
                </>
              )}
            </Button>
          </div>

          {!isAuthenticated && (
            <div
              className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400"
              role="note"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Execution requires an account. You can read the problem and
                code, but running is available after{" "}
                <Link href="/login" className="underline">
                  signing in
                </Link>
                .
              </span>
            </div>
          )}

          <CodeEditor
            value={code}
            onChange={setCode}
            readOnly={running}
            ariaLabel={`Python code editor for ${problem.title}`}
          />

          <p className="text-xs text-muted-foreground">
            Assign your final circuit to a variable named{" "}
            <code className="rounded bg-muted px-1 py-0.5">result</code>.
            Execution runs in an isolated sandbox with a time limit.
          </p>

          {/* Results */}
          {runError && (
            <Card className="border-destructive/50" role="alert">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                  <XCircle className="h-5 w-5" aria-hidden="true" />
                  Execution error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{runError}</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <ResultPanel result={result} />
          )}

          {phase === "idle" && !result && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Run your code to execute it in the sandbox and evaluate it
                  against the problem checks.
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
// Result panel
// ========================================

function ResultPanel({ result }: { result: RunResponse }) {
  const execution = result.execution;
  const passed = result.judge?.passed === true;
  const failed = result.judge ? !result.judge.passed : false;

  return (
    <Card role="region" aria-label="Execution results">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {result.judge === null && (
            <Info className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
          {passed && (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          )}
          {failed && (
            <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
          )}
          {result.judge
            ? passed
              ? "All checks passed"
              : "Checks failed"
            : "Execution result"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">
            <p className="font-medium">{result.error.code}</p>
            <p className="mt-1 text-muted-foreground">{result.error.message}</p>
          </div>
        )}

        {result.judge && (
          <div>
            <p className="text-sm font-medium">{result.judge.summary}</p>
            <ul className="mt-2 space-y-2">
              {result.judge.checks.map((check: JudgeCheckView, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm"
                >
                  {check.status === "PASS" && (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                  )}
                  {check.status === "FAIL" && (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                  )}
                  {check.status === "SKIPPED" && (
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <div>
                    <span className="font-medium">{check.description}</span>
                    {check.message && check.status !== "PASS" && (
                      <span className="block text-muted-foreground">{check.message}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {execution?.circuit && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Circuit
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Qubits" value={execution.circuit.qubits} />
              <Metric label="Depth" value={execution.circuit.depth} />
              <Metric label="Gates" value={execution.circuit.totalGates} />
              <Metric
                label="Shots"
                value={execution.shots ?? "—"}
              />
            </dl>
          </div>
        )}

        {execution?.counts && Object.keys(execution.counts).length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Measurement counts
            </h3>
            <ul className="mt-2 space-y-1">
              {Object.entries(execution.counts)
                .sort((a, b) => b[1] - a[1])
                .map(([bits, count]) => (
                  <li key={bits} className="flex items-center gap-3 text-sm">
                    <code className="w-16 rounded bg-muted px-2 py-0.5 text-center">
                      {bits}
                    </code>
                    <div
                      className="h-2 rounded bg-primary/70"
                      style={{
                        width: `${Math.max(4, (count / (execution.shots ?? count)) * 220)}px`,
                      }}
                      aria-hidden="true"
                    />
                    <span>
                      {count}
                      {execution.shots ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({((count / execution.shots) * 100).toFixed(1)}%)
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {execution?.stdout && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Program output
            </h3>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-3 text-xs">
              {execution.stdout}
            </pre>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Runtime: {result.durationMs !== null ? `${result.durationMs} ms` : "—"}
          {result.submissionId ? ` · Submission ${result.submissionId.slice(0, 8)}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/50 p-2 text-center">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}
