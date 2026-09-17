"use client";

/**
 * Quantum debugger panel.
 *
 * The Quantum Time Machine: step through a real execution trace produced
 * by the sandbox runtime. Displays the circuit, the exact state at the
 * selected step, resources, and (for failed runs) the evidence-based
 * failure localization.
 *
 * Modes:
 *   Beginner  — current gate, what changed, probabilities, simple failures
 *   Developer — full trace, amplitudes/phases, resources, localization
 *   Research  — adds density-matrix and unitary inspection (when produced)
 *
 * Every panel states its limitations when data is unavailable rather than
 * showing fabricated content.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Bug,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircuitView, stepDescription } from "@/components/workspace/circuit-view";
import { StateInspector } from "@/components/workspace/state-inspector";
import type {
  DebuggerPayload,
  ScenarioOutcome,
  TraceStep,
} from "@/lib/exec/types";
import type { FailureLocalization } from "@/lib/judge/failure-localization";

type DebuggerMode = "beginner" | "developer" | "research";

interface DensityMatrixRow {
  basis: string;
  diagonal: number;
}

export function QuantumDebugger({
  submissionId,
  open,
  initialStep = null,
}: {
  submissionId: string;
  open: boolean;
  /** Step to open when loading (deep link from the semantic observer). */
  initialStep?: number | null;
}) {
  const [payload, setPayload] = useState<DebuggerPayload | null>(null);
  const [localization, setLocalization] = useState<FailureLocalization | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<DebuggerMode>("beginner");
  const [currentStep, setCurrentStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [showFullDensity, setShowFullDensity] = useState(false);
  const fetchStarted = useRef(false);

  // Load debugger data when opened. The started-ref keeps the effect from
  // re-issuing the fetch; state updates happen in async callbacks only.
  useEffect(() => {
    if (!open || fetchStarted.current) return;
    fetchStarted.current = true;
    const controller = new AbortController();
    fetch(`/api/submissions/${submissionId}/debug`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Debugger data unavailable.");
        }
        return res.json();
      })
      .then((data: { submission: DebuggerPayload; localization: FailureLocalization | null }) => {
        setPayload(data.submission);
        setLocalization(data.localization);
        // Start at the requested step (deep link), else the failure point
        // when the judge failed, else the end of the trace.
        const steps = data.submission.outcomes["submission"]?.trace?.steps;
        const suggested =
          initialStep !== null && initialStep !== undefined
            ? initialStep
            : data.localization?.stepIndex;
        setCurrentStep(
          suggested !== null && suggested !== undefined && steps
            ? Math.min(suggested, steps.length - 1)
            : steps
              ? steps.length - 1
              : -1,
        );
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === "AbortError") return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Debugger data unavailable.",
        );
      });
    return () => controller.abort();
  }, [open, submissionId, initialStep]);

  const outcome = payload?.outcomes["submission"] ?? null;
  // Derived load state: fetching until data or an error arrives.
  const loading = open && !payload && !loadError;
  const steps: TraceStep[] = useMemo(
    () => outcome?.trace?.steps ?? [],
    [outcome],
  );
  const policy = outcome?.trace?.policy ?? null;
  const total = steps.length;

  // Auto-play the time machine. The timer callback performs the state
  // update, keeping the effect body free of synchronous setState.
  useEffect(() => {
    if (!playing) return;
    if (currentStep >= total - 1) {
      const stop = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(stop);
    }
    const timer = setTimeout(() => setCurrentStep((s) => s + 1), 900);
    return () => clearTimeout(timer);
  }, [playing, currentStep, total]);

  const currentOutcomeState = useMemo(() => {
    if (currentStep < 0 || currentStep >= steps.length) return undefined;
    return steps[currentStep].afterState;
  }, [currentStep, steps]);

  if (!open) return null;

  return (
    <Card role="region" aria-label="Quantum debugger">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bug className="h-5 w-5" aria-hidden="true" />
          Quantum Debugger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading execution trace…
          </p>
        )}
        {loadError && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400" role="alert">
            {loadError} The workspace remains usable.
          </p>
        )}

        {payload && (
          <>
            {/* Failure localization banner */}
            {localization && payload.judge && !payload.judge.passed && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="status">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  <span>
                    {localization.observation}
                    {localization.stepIndex !== null && (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="underline underline-offset-2"
                          onClick={() => {
                            setCurrentStep(localization.stepIndex ?? 0);
                            setPlaying(false);
                          }}
                        >
                          Open debugger at step {localization.stepIndex}
                        </button>
                      </>
                    )}
                  </span>
                </p>
              </div>
            )}

            {/* Error banner for failed executions */}
            {payload.errorCode && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">
                <p className="font-medium">{payload.errorCode}</p>
                <p className="mt-1 text-muted-foreground">{payload.errorMessage}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No quantum execution trace was produced.
                </p>
              </div>
            )}

            {/* Mode selector */}
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Debugger detail mode">
              {(
                [
                  ["beginner", "Beginner"],
                  ["developer", "Developer"],
                  ["research", "Research"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded-md border px-3 py-1 text-sm font-medium ${
                    mode === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-transparent hover:bg-accent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Trace availability note */}
            {policy && !policy.available && (
              <p className="text-sm text-muted-foreground" role="note">
                {policy.reason}
              </p>
            )}
            {policy?.subsampled && (
              <p className="text-xs text-muted-foreground" role="note">
                {policy.reason}
              </p>
            )}

            {total > 0 ? (
              <>
                {/* Time machine controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentStep(-1); setPlaying(false); }}
                    aria-label="Reset to before first step"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentStep(0); setPlaying(false); }}
                    aria-label="Go to first step"
                  >
                    <SkipBack className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentStep((s) => Math.max(-1, s - 1)); setPlaying(false); }}
                    aria-label="Previous step"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentStep((s) => Math.min(total - 1, s + 1)); setPlaying(false); }}
                    aria-label="Next step"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentStep(total - 1); setPlaying(false); }}
                    aria-label="Go to last step"
                  >
                    <SkipForward className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "Pause playback" : "Play through steps"}
                  >
                    {playing ? "Pause" : "Play"}
                  </Button>
                  <span className="ml-2 font-mono text-sm" aria-live="polite">
                    Step {currentStep >= 0 ? currentStep : "—"} / {Math.max(0, total - 1)}
                  </span>
                </div>

                {/* Step scrubber */}
                <input
                  type="range"
                  min={-1}
                  max={total - 1}
                  value={currentStep}
                  onChange={(e) => { setCurrentStep(Number(e.target.value)); setPlaying(false); }}
                  className="w-full"
                  aria-label="Execution timeline scrubber"
                />

                {/* Current step description */}
                <p className="text-sm" aria-live="polite">
                  {currentStep >= 0 ? (
                    <>
                      After step {currentStep}:{" "}
                      <span className="font-mono">
                        {stepDescription(steps[currentStep])}
                      </span>
                    </>
                  ) : (
                    "Before the first step — all qubits start in |0⟩."
                  )}
                </p>

                {/* Circuit */}
                <CircuitView
                  steps={steps}
                  qubitCount={outcome?.circuit.qubits ?? 0}
                  clbitCount={outcome?.circuit.clbits ?? 0}
                  currentStep={currentStep}
                  onStepSelect={(i) => { setCurrentStep(i); setPlaying(false); }}
                />

                {/* State inspection */}
                {mode !== "beginner" ? (
                  <StateInspector
                    state={currentOutcomeState}
                    exactProbabilities={
                      currentStep === total - 1
                        ? outcome?.probabilities
                        : undefined
                    }
                    counts={outcome?.counts}
                    shots={outcome?.shots}
                    qubitCount={outcome?.circuit.qubits ?? 0}
                    stepIndex={Math.max(0, currentStep)}
                    totalSteps={total - 1}
                    exact={policy?.subsampled ? false : true}
                    unavailableReason={
                      currentOutcomeState
                        ? null
                        : (policy?.reason ??
                          "Exact state unavailable for this step.")
                    }
                  />
                ) : (
                  <BeginnerStateView
                    outcome={outcome}
                    steps={steps}
                    currentStep={currentStep}
                  />
                )}

                {/* Research: inspection matrices */}
                {mode === "research" && (
                  <ResearchPanel outcome={outcome} showFull={showFullDensity} onToggleFull={setShowFullDensity} />
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground" role="note">
                No quantum execution trace was produced.
                {payload.status !== "SUCCEEDED"
                  ? " The execution did not complete, so there is nothing to step through."
                  : payload.traceAvailability["submission"]?.reason
                    ? ` ${payload.traceAvailability["submission"].reason}`
                    : ""}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ========================================
// Beginner view
// ========================================

function BeginnerStateView({
  outcome,
  steps,
  currentStep,
}: {
  outcome: ScenarioOutcome | null;
  steps: TraceStep[];
  currentStep: number;
}) {
  const step = currentStep >= 0 ? steps[currentStep] : undefined;
  const state = step?.afterState;
  if (!state) {
    return (
      <p className="text-sm text-muted-foreground">
        {currentStep >= 0
          ? "Exact state unavailable for this step."
          : "Press Next to walk through the circuit step by step."}
      </p>
    );
  }
  const qubitCount = outcome?.circuit.qubits ?? 0;
  const rows = state
    .map(([re, im], index) => ({
      basis: index.toString(2).padStart(qubitCount, "0"),
      probability: re * re + im * im,
    }))
    .filter((r) => r.probability > 0.001)
    .sort((a, b) => b.probability - a.probability);

  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Probability of each outcome after step {currentStep}
      </h4>
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row.basis} className="flex items-center gap-3 text-sm">
            <code className="w-16 rounded bg-muted px-2 py-0.5 text-center font-mono">
              |{row.basis}⟩
            </code>
            <div
              className="h-2 rounded bg-primary/70"
              style={{ width: `${Math.max(4, row.probability * 180)}px` }}
              aria-hidden="true"
            />
            <span className="font-mono text-xs">
              {(row.probability * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
      {outcome?.counts && (
        <p className="mt-3 text-xs text-muted-foreground">
          Final measured counts:{" "}
          {Object.entries(outcome.counts)
            .sort((a, b) => b[1] - a[1])
            .map(([bits, count]) => `${bits}: ${count}`)
            .join(", ")}
          {outcome.shots ? ` (${outcome.shots} shots)` : ""}
        </p>
      )}
    </div>
  );
}

// ========================================
// Research view
// ========================================

function ResearchPanel({
  outcome,
  showFull,
  onToggleFull,
}: {
  outcome: ScenarioOutcome | null;
  showFull: boolean;
  onToggleFull: (value: boolean) => void;
}) {
  const inspection = outcome?.inspection;
  const unavailable = outcome?.inspectionUnavailable;

  if (unavailable) {
    return (
      <p className="text-sm text-muted-foreground" role="note">
        Density-matrix inspection unavailable for this execution size.
      </p>
    );
  }
  if (!inspection) {
    return (
      <p className="text-sm text-muted-foreground" role="note">
        Inspection matrices were not requested for this execution.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <DensityMatrixSection
        pairs={inspection.densityMatrixPairs}
        dim={inspection.densityMatrixDim}
        unavailable={inspection.densityMatrixUnavailable}
        showFull={showFull}
        onToggleFull={onToggleFull}
      />
      <UnitarySection
        pairs={inspection.unitaryPairs}
        dim={inspection.unitaryDim}
        unavailable={inspection.unitaryUnavailable}
      />
    </div>
  );
}

function DensityMatrixSection({
  pairs,
  dim,
  unavailable,
  showFull,
  onToggleFull,
}: {
  pairs: [number, number][] | undefined;
  dim: number | undefined;
  unavailable: string | undefined;
  showFull: boolean;
  onToggleFull: (value: boolean) => void;
}) {
  if (unavailable || !pairs || !dim) {
    return (
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Density matrix
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Density-matrix inspection unavailable for this execution size.
        </p>
      </div>
    );
  }
  const rows: DensityMatrixRow[] = [];
  for (let i = 0; i < dim; i++) {
    const idx = i * dim + i;
    const [re] = pairs[idx] ?? [0, 0];
    rows.push({
      basis: i.toString(2).padStart(Math.log2(dim), "0"),
      diagonal: re,
    });
  }
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Density matrix (diagonal — pure-state populations)
      </h4>
      <table className="mt-2 w-full max-w-md text-sm" aria-label="Density matrix diagonal">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
            <th scope="col" className="py-1 pr-3 font-medium">Basis</th>
            <th scope="col" className="py-1 font-medium">Population</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.basis} className="border-b border-border/50">
              <td className="py-1 pr-3 font-mono">|{row.basis}⟩</td>
              <td className="py-1 font-mono text-xs">
                {row.diagonal.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!showFull && (
        <button
          type="button"
          className="mt-2 text-xs underline underline-offset-2"
          onClick={() => onToggleFull(true)}
        >
          Show full matrix data ({dim}×{dim})
        </button>
      )}
      {showFull && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs">Matrix entries</summary>
          <div className="mt-2 max-h-48 overflow-auto rounded border p-2 font-mono text-[10px]">
            {Array.from({ length: dim }, (_, r) => (
              <div key={r}>
                {Array.from({ length: dim }, (_, c) => {
                  const [re, im] = pairs[r * dim + c] ?? [0, 0];
                  return (
                    <span key={c} className="inline-block w-24">
                      {re.toFixed(3)}
                      {im >= 0 ? "+" : "-"}
                      {Math.abs(im).toFixed(3)}i
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function UnitarySection({
  pairs,
  dim,
  unavailable,
}: {
  pairs: [number, number][] | undefined;
  dim: number | undefined;
  unavailable: string | undefined;
}) {
  if (unavailable || !pairs || !dim) {
    return (
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Unitary
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Unitary inspection unavailable for this execution size.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Circuit unitary ({dim}×{dim})
      </h4>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs">Matrix entries</summary>
        <div className="mt-2 max-h-48 overflow-auto rounded border p-2 font-mono text-[10px]">
          {Array.from({ length: dim }, (_, r) => (
            <div key={r}>
              {Array.from({ length: dim }, (_, c) => {
                const [re, im] = pairs[r * dim + c] ?? [0, 0];
                return (
                  <span key={c} className="inline-block w-24">
                    {re.toFixed(3)}
                    {im >= 0 ? "+" : "-"}
                    {Math.abs(im).toFixed(3)}i
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
