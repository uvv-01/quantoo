# Quantum Debugger Architecture

Phase 5 adds an evidence-driven debugger on top of the Phase 4 execution
pipeline. The debugger never executes code and never fabricates quantum
data: every displayed value comes from the persisted execution artifact
produced inside the sandbox.

```
Workspace (Run / Submit)
   ↓
Execution API  →  Execution Service  →  Sandbox Boundary
                                            ↓
                                      Quantum Runtime (runner.py)
                                            ↓
                                      Execution Artifact
                                            ↓
                            Judge ──→ Failure Localization
                                            ↓
                          Debugger Service (ownership enforced)
                                            ↓
                          Debugger API  →  Debugger UI (Time Machine)
```

## Execution Artifact extensions

The Phase 4 artifact (circuit metadata, counts, statevector pairs,
scenario variants, resource metrics, sanitized errors) now carries the
debugger data actually produced by the runtime:

| Field | Meaning |
| --- | --- |
| `trace.steps` | Ordered `TraceStep` list: `stepIndex`, `gateName`, `qubits`, `params`, `measurements`, `afterState` (when a snapshot exists) |
| `snapshots` | Per-step `StateSnapshot`s: `stepIndex`, `representation` (`statevector`/`density_matrix`/`unitary`), `qubitCount`, `data`, `exact` flag |
| `inspection` | Optional `density_matrix` / `unitary` payloads, each capped by size limits |
| `scenarioVariants` | Phase 4 scenario executions, each carrying its own trace when inspection was requested |

Fields are present only when the runtime produced them. A runtime error
or timeout yields no trace — the debugger then reports
"No quantum execution trace was produced." and never invents steps.

## Gate trace

The runner walks the user circuit's instruction list in order and emits
one `TraceStep` per operation, preserving the real ordering
(`0 → H(q0)`, `1 → CX(q0,q1)`, `2 → measure(q0,q1)`, …).

Where the requested representation allows it (statevector simulation of
the requested scenarios), each step records the post-step state as an
`afterState` snapshot. Steps that do not have snapshots (for example
when the artifact is derived from shot-only data) are represented as
trace steps without state — the UI explicitly shows
"Exact state unavailable." rather than substituting sampled counts.

## State snapshots and scaling policy

Exact state inspection grows as `2^n` and must never be dumped
unbounded into the browser. The runtime applies:

- **qubit ceiling** (`EXEC_MAX_QUBITS`, hard cap 16) — requests above the
  ceiling fail validation, never execute
- **snapshot subsampling**: for circuits with more than
  `EXEC_SNAPSHOT_MAX_STEPS` steps, snapshots are recorded for the first N
  steps and the final step, with intermediate steps represented by trace
  entries only; `exact` is `false` for a subsampled series and the UI
  labels it as partial
- **size caps** for every representation: statevector pairs, density
  matrix (`EXEC_DENSITY_MAX_QUBITS`), unitary (`EXEC_UNITARY_MAX_QUBITS`),
  and payload byte limits; exceeding a cap drops that representation and
  reports it as unavailable instead of truncating silently

Representation matrix (current runtime):

| Representation | Source | Exact? | Limits |
| --- | --- | --- | --- |
| Statevector | Aer `Statevector` simulation | yes | ≤ 16 qubits, payload cap |
| Exact probabilities | derived from the actual statevector | yes (derived, labeled) | same |
| Measurement counts | Aer shots | sampled — never labeled exact | shot limits |
| Density matrix | `DensityMatrix` snapshot | yes | ≤ `EXEC_DENSITY_MAX_QUBITS` |
| Unitary | `Operator` of the circuit | yes | ≤ `EXEC_UNITARY_MAX_QUBITS` |

## Quantum Time Machine

The debugger UI (`components/workspace/quantum-debugger.tsx`) provides
first / previous / next / last navigation, a step slider, play/pause and
reset. The displayed state, probabilities, measurements and circuit
highlight all follow the selected `stepIndex`. Controls are real buttons
with accessible names; the current step is indicated by position, border
and label — never color alone.

## State inspection

The state inspector renders, per basis state: amplitude (real +
imaginary), magnitude, probability, and phase. Near-zero amplitudes are
shown as `0` rather than floating-point phase noise. Probabilities are
computed from the actual statevector (labeled "exact, derived") and are
kept visually distinct from sampled measurement frequencies.

### Global phase policy

Consistent with the Phase 4 judge: states are compared modulo global
phase. The inspector normalizes the displayed phase against the largest
amplitude so physically equivalent states look identical; relative phase
and probability are the meaningful quantities shown.

## Failure localization

`lib/judge/failure-localization.ts` connects judge failures to trace
regions. It uses only persisted evidence: the first failing check, the
first trace divergence (when a reference trace exists), and the last
snapshot where the observed state still matched the expectation. All
output is phrased as observation — "Failure observed after step N." —
never as a claim that a specific gate "is the bug".

## Reference comparison (Quantum Diff foundation)

`lib/judge/diff.ts` compares a student execution with a reference
execution by category — STRUCTURE, STATE, PROBABILITY, MEASUREMENT,
RESOURCE — using quantum-equivalent comparison (global-phase-invariant
state similarity, probability tolerance), never source-text equality.
The comparison layer is the foundation for future reference executions
and reports the first divergence step with observed vs expected values.

## Debugger modes

The workspace debugger panel has three display modes, all fed from the
same artifact:

- **Beginner** — current gate, what changed, probabilities, simple
  failure information
- **Developer** — gate trace, amplitudes/phases, resources, comparison
- **Research** — density matrix and unitary where the runtime produced
  them, plus detailed metrics

Unavailable representations are always reported as unavailable for that
execution; the UI degrades gracefully and the workspace stays usable.

## API

- `GET /api/executions/[executionId]` — execution artifact (owner only)
- `GET /api/executions/[executionId]/trace` — trace + snapshots (owner only)
- `GET /api/submissions/[submissionId]/debug` — debugger payload +
  failure localization (owner only)

All endpoints authenticate via the server session, enforce ownership,
and treat a foreign resource as a missing one (404). See
`docs/security/execution-security.md` for the sandbox guarantees that
still apply unchanged.
