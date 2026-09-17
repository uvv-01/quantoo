"use client";

/**
 * Interactive debugger circuit view.
 *
 * Renders the circuit's gate trace as qubit lines with one column per
 * trace step. The current step is marked by position, border, and an
 * aria-labeled indicator — never by color alone. Executed and upcoming
 * steps are distinguishable through opacity plus textual markers.
 *
 * Pure display: navigation lives in the debugger panel's accessible
 * buttons, so keyboard users drive the same state.
 */

import type { TraceStep } from "@/lib/exec/types";

interface CircuitViewProps {
  steps: TraceStep[];
  qubitCount: number;
  clbitCount: number;
  /** Current time-machine position (0-based step index); -1 = before start. */
  currentStep: number;
  onStepSelect?: (stepIndex: number) => void;
}

/** Gate display names for common operations. */
const GATE_LABELS: Record<string, string> = {
  h: "H",
  x: "X",
  y: "Y",
  z: "Z",
  s: "S",
  sdg: "S†",
  t: "T",
  tdg: "T†",
  rx: "Rx",
  ry: "Ry",
  rz: "Rz",
  cx: "⊕",
  cy: "⊕y",
  cz: "⊕z",
  ch: "⊕h",
  ccx: "⊕⊕",
  swap: "×",
  measure: "M",
  barrier: "¦",
};

function gateLabel(step: TraceStep): string {
  const base = GATE_LABELS[step.gateName] ?? step.gateName.toUpperCase();
  if (step.params.length > 0) {
    return `${base}(${step.params.map((p) => p.toFixed(2)).join(", ")})`;
  }
  return base;
}

export function CircuitView({
  steps,
  qubitCount,
  clbitCount,
  currentStep,
  onStepSelect,
}: CircuitViewProps) {
  const hasClbits = clbitCount > 0;

  return (
    <div
      className="overflow-x-auto rounded-md border bg-card p-3"
      role="img"
      aria-label={`Circuit with ${steps.length} steps. Current step: ${
        currentStep >= 0 ? stepDescription(steps[currentStep]) : "before first step"
      }`}
    >
      <div className="min-w-max space-y-1.5">
        {/* Qubit lines */}
        {Array.from({ length: qubitCount }, (_, q) => (
          <div key={q} className="flex items-center gap-1">
            <span
              className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground"
              aria-hidden="true"
            >
              q{q}
            </span>
            <div className="relative h-8 min-w-max flex-1">
              <div
                className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border"
                aria-hidden="true"
              />
              <div className="relative flex h-full items-center gap-1">
                {steps.map((step, i) => {
                  const onLine = step.qubits.includes(q);
                  const isControl = onLine && isControlRole(step, q);
                  const executed = i <= currentStep;
                  const current = i === currentStep;
                  return (
                    <button
                      key={i}
                      type="button"
                      tabIndex={onStepSelect ? 0 : -1}
                      aria-label={
                        onStepSelect
                          ? `Step ${i}: ${stepDescription(step)}${current ? ", current" : ""}`
                          : undefined
                      }
                      onClick={() => onStepSelect?.(i)}
                      className={[
                        "relative flex h-7 w-9 shrink-0 items-center justify-center rounded border text-[10px] font-semibold leading-none",
                        onLine
                          ? isControl
                            ? "border-transparent bg-transparent"
                            : "border-foreground/70 bg-background font-mono"
                          : "border-transparent bg-transparent",
                        executed ? "opacity-100" : "opacity-40",
                        current
                          ? "ring-2 ring-ring ring-offset-1 ring-offset-card"
                          : "",
                        onStepSelect && onLine
                          ? "cursor-pointer hover:opacity-80"
                          : "cursor-default",
                      ].join(" ")}
                      aria-current={current ? "step" : undefined}
                    >
                      {onLine &&
                        (isControl ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full bg-foreground"
                            aria-hidden="true"
                          />
                        ) : step.measurement ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-sm border border-foreground/70 bg-background font-mono text-[9px]">
                            M
                          </span>
                        ) : (
                          <span aria-hidden="true">{gateLabel(step)}</span>
                        ))}
                      {current && (
                        <span className="sr-only">(current step)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Classical bit lines for measurement targets */}
        {hasClbits &&
          Array.from({ length: clbitCount }, (_, c) => (
            <div key={c} className="flex items-center gap-1">
              <span
                className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground"
                aria-hidden="true"
              >
                c{c}
              </span>
              <div className="relative h-5 min-w-max flex-1">
                <div
                  className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border border-dashed"
                  aria-hidden="true"
                />
                <div className="relative flex h-full items-center gap-1">
                  {steps.map((step, i) => {
                    const receives = step.measurement && step.clbits.includes(c);
                    const executed = i <= currentStep;
                    return receives ? (
                      <span
                        key={i}
                        className={[
                          "h-5 w-9 shrink-0 rounded-sm",
                          executed ? "opacity-100" : "opacity-40",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 36 20" className="h-full w-full">
                          <line
                            x1={step.qubits[0] < qubitCount ? 18 : 18}
                            y1={-14}
                            x2={18}
                            y2={8}
                            className="stroke-foreground/60"
                            strokeWidth={1}
                          />
                        </svg>
                      </span>
                    ) : (
                      <span key={i} className="h-5 w-9 shrink-0" aria-hidden="true" />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Legend (non-color cues explained) */}
      <p className="mt-2 text-xs text-muted-foreground">
        Solid boxes are gates; filled dots are controls; M marks measurement.
        Dimmed columns are not yet executed; the outlined column is the
        current step.
      </p>
    </div>
  );
}

function isControlRole(step: TraceStep, qubit: number): boolean {
  if (step.measurement) return false;
  // In Qiskit traces the first listed qubit of a two-qubit gate is the
  // control for cx/cy/cz/ch; ccx has two controls.
  if (
    ["cx", "cy", "cz", "ch", "ccx", "cswap"].includes(step.gateName)
  ) {
    const controlCount = step.gateName === "ccx" || step.gateName === "cswap" ? 2 : 1;
    return step.qubits.indexOf(qubit) < controlCount;
  }
  return false;
}

export function stepDescription(step: TraceStep | undefined): string {
  if (!step) return "unknown step";
  if (step.measurement) {
    return `measure qubit ${step.qubits.join(", ")} into classical bit ${step.clbits.join(", ")}`;
  }
  return `${step.gateName} gate on qubit ${step.qubits.join(", ")}`;
}
