"use client";

/**
 * Compatibility Lab (Phase 7).
 *
 * In-workspace surface for the Quantum Compatibility & Reproducibility
 * Lab: run the program of a saved baseline execution in controlled
 * candidate environments, compare the resulting behavior under an
 * explicit policy, inspect per-dimension evidence, jump into the Phase 5
 * debugger at the first observed divergence, and export/import versioned
 * reproducibility packages.
 *
 * Every verdict shown is computed server-side from persisted execution
 * artifacts. The component never fabricates results and never treats a
 * listed environment as available unless the server measured it so.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  FlaskConical,
  Layers,
  Loader2,
  MinusCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuantumDebugger } from "@/components/workspace/quantum-debugger";
import type {
  CompatibilityReport,
  EnvironmentDescriptor,
} from "@/lib/compat/types";

interface ExecutionRow {
  id: string;
  createdAt: string;
  status: string;
  passed: boolean | null;
  hasArtifact: boolean;
}

interface ExperimentRow {
  id: string;
  name: string;
  policyName: string;
  createdAt: string;
  runs: Array<{
    id: string;
    role: string;
    environmentId: string;
    status: string;
    submissionId: string | null;
    errorCode: string | null;
  }>;
}

const STATUS_STYLES: Record<string, string> = {
  COMPATIBLE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPATIBLE_WITH_RESOURCE_CHANGE:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  BEHAVIORALLY_DIFFERENT: "border-destructive/50 bg-destructive/10 text-destructive",
  EXECUTION_FAILED: "border-destructive/50 bg-destructive/10 text-destructive",
  INSUFFICIENT_EVIDENCE: "border-muted-foreground/40 bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.INSUFFICIENT_EVIDENCE;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function DimensionIcon({ status }: { status: string }) {
  if (status === "PASS")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />;
  if (status === "DIFFERENT" || status === "FAIL")
    return <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />;
  if (status === "WARNING" || status === "CHANGED")
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

export function CompatibilityLab({ problemSlug }: { problemSlug: string }) {
  const [environments, setEnvironments] = useState<EnvironmentDescriptor[]>([]);
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
  const [baselineId, setBaselineId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [policy, setPolicy] = useState<"statistical-default" | "exact">(
    "statistical-default",
  );
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [busy, setBusy] = useState<"run" | "import" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugSubmissionId, setDebugSubmissionId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const [envRes, execRes, expRes] = await Promise.all([
          fetch("/api/compatibility/environments").then((r) => r.json()),
          fetch(
            `/api/semantic/executions?problemSlug=${encodeURIComponent(problemSlug)}`,
          ).then((r) => r.json()),
          fetch(
            `/api/compatibility/experiments?problemSlug=${encodeURIComponent(problemSlug)}`,
          ).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setEnvironments(envRes.environments ?? []);
        const rows: ExecutionRow[] = execRes.executions ?? [];
        setExecutions(rows);
        setExperiments(expRes.experiments ?? []);
        setBaselineId((prev) => prev || rows[0]?.id || "");
        setSelected((prev) =>
          Object.keys(prev).length > 0
            ? prev
            : Object.fromEntries(
                (envRes.environments ?? [])
                  .filter(
                    (e: EnvironmentDescriptor & { availability: { status: string } }) =>
                      !e.isDefault && e.availability.status === "AVAILABLE",
                  )
                  .map((e: EnvironmentDescriptor) => [e.id, true]),
              ),
        );
      } catch {
        if (!cancelled) setError("Could not load the compatibility lab.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [problemSlug]);

  useEffect(() => load(), [load]);

  const runExperiment = useCallback(async () => {
    const candidateEnvironmentIds = candidateIds(selected);
    setBusy("run");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/compatibility/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemSlug,
          name: `Experiment ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
          baselineSubmissionId: baselineId,
          candidateEnvironmentIds,
          policy,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "The experiment failed to run.");
      }
      setReport(body.report ?? null);
      if (body.reportError) {
        setMessage(`Report unavailable: ${body.reportError}`);
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The experiment failed to run.");
    } finally {
      setBusy(null);
    }
  }, [baselineId, selected, load, policy, problemSlug]);

  const importPackage = useCallback(
    async (file: File) => {
      setBusy("import");
      setError(null);
      setMessage(null);
      try {
        const text = await file.text();
        const res = await fetch("/api/compatibility/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: text,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.error ?? "The package was rejected.");
        }
        setMessage(
          body.message ??
            "Package imported. Run the experiment to execute it locally.",
        );
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "The package was rejected.");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const availableCount = environments.filter(
    (e) => !e.isDefault && e.availability.status === "AVAILABLE",
  ).length;

  return (
    <Card role="region" aria-label="Compatibility lab">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5" aria-hidden="true" />
          Compatibility Lab
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Runs the same program in controlled environments and compares the
          behavior under an explicit policy. Compatibility means the tested
          behavior stayed within the selected policy — not that package
          versions match, and not mathematical equivalence for all inputs.
        </p>

        {error && (
          <div
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-700 dark:text-sky-400"
            role="status"
          >
            {message}
          </div>
        )}

        {/* Environment matrix setup */}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="compat-baseline"
              className="mb-1 block text-sm font-medium"
            >
              Baseline execution
            </label>
            <select
              id="compat-baseline"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={baselineId}
              onChange={(e) => setBaselineId(e.target.value)}
            >
              {executions.length === 0 && <option value="">No executions yet</option>}
              {executions.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {formatTime(ex.createdAt)} ·{" "}
                  {ex.passed === true
                    ? "passed checks"
                    : ex.passed === false
                      ? "failed checks"
                      : "no verdict"}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">
              Candidate environments
            </legend>
            {environments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No environments are registered in this deployment.
              </p>
            )}
            <ul className="space-y-2">
              {environments.map((env) => (
                <li key={env.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    id={`compat-env-${env.id}`}
                    className="mt-1"
                    checked={selected[env.id] ?? false}
                    disabled={
                      busy !== null ||
                      env.isDefault ||
                      env.availability.status !== "AVAILABLE"
                    }
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [env.id]: e.target.checked }))
                    }
                  />
                  <label htmlFor={`compat-env-${env.id}`} className="min-w-0">
                    <span className="font-medium">{env.name}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                      {env.availability.status.replaceAll("_", " ")}
                    </span>
                    <span className="block text-muted-foreground">
                      {env.availability.reason ?? env.description}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="compat-policy" className="sr-only">
              Comparison policy
            </label>
            <select
              id="compat-policy"
              aria-label="Comparison policy"
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={policy}
              onChange={(e) => setPolicy(e.target.value as typeof policy)}
            >
              <option value="statistical-default">Statistical</option>
              <option value="exact">Exact</option>
            </select>
            <Button
              type="button"
              onClick={() => void runExperiment()}
              disabled={
                busy !== null ||
                !baselineId ||
                availableCount === 0 ||
                Object.values(selected).every((v) => !v)
              }
            >
              {busy === "run" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
              )}
              Run experiment
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent">
              {busy === "import" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
              )}
              Import package
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importPackage(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {/* Latest report */}
        {report && (
          <div className="space-y-3" aria-live="polite">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-medium">Latest result</h3>
              <StatusBadge status={report.overallStatus} />
              <span className="text-xs text-muted-foreground">
                policy {report.policyName}
              </span>
            </div>

            <ul className="space-y-3">
              {report.candidateResults.map((candidate) => (
                <li
                  key={candidate.environmentId}
                  className="rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={candidate.status} />
                    <span className="font-medium">{candidate.environmentId}</span>
                    {candidate.runStatus !== "SUCCEEDED" && (
                      <span className="text-xs text-muted-foreground">
                        run status: {candidate.runStatus.toLowerCase()}
                        {candidate.errorCode ? ` (${candidate.errorCode})` : ""}
                      </span>
                    )}
                    {candidate.semanticComparison?.firstDivergenceStep != null &&
                      candidate.semanticComparison.firstDivergenceStep >= 0 &&
                      candidate.semanticComparison.firstDivergenceStep !== null && (
                        <span className="text-xs text-muted-foreground">
                          first observed structural divergence: operation{" "}
                          {candidate.semanticComparison.firstDivergenceStep}
                        </span>
                      )}
                    {candidate.semanticComparison?.firstDivergenceStep != null &&
                      report.baselineSubmissionId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDebugSubmissionId(report.baselineSubmissionId);
                            setDebugOpen(true);
                          }}
                        >
                          Inspect at divergence
                        </Button>
                      )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {candidate.dimensions.map((dim) => (
                      <li key={dim.dimension} className="flex items-start gap-2">
                        <DimensionIcon status={dim.status} />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {dim.dimension.replaceAll("_", " ")} — {dim.status}
                          </p>
                          <p className="text-muted-foreground">{dim.message}</p>
                          {dim.observed && Object.keys(dim.observed).length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {Object.entries(dim.observed)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            {report.limitations.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-medium">Limitations</p>
                <ul className="mt-1 list-disc pl-5">
                  {report.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Experiment history */}
        {experiments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Experiments</h3>
            <ul className="space-y-2">
              {experiments.slice(0, 5).map((exp) => (
                <li
                  key={exp.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{exp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(exp.createdAt)} · policy {exp.policyName} ·{" "}
                      {exp.runs.length} run{exp.runs.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {exp.runs
                      .filter((r) => r.role === "CANDIDATE")
                      .map((r) => (
                        <span
                          key={r.id}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs"
                        >
                          {r.environmentId}: {r.status.toLowerCase()}
                        </span>
                      ))}
                    <a
                      href={`/api/compatibility/experiments/${exp.id}/export`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
                      download
                    >
                      <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                      Export
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {debugSubmissionId && (
          <QuantumDebugger
            submissionId={debugSubmissionId}
            open={debugOpen}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Extract selected candidate ids (stable dep for the run callback). */
function candidateIds(selected: Record<string, boolean>): string[] {
  return Object.entries(selected)
    .filter(([, on]) => on)
    .map(([id]) => id)
    .sort();
}
