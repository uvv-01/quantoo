# Execution Architecture

Phase 4 turns the problem system into an interactive quantum programming
environment. This document describes the execution pipeline, its security
boundaries, and the contracts between its components.

## Pipeline

```text
Browser (workspace UI)
   ↓  POST /api/executions/run   (session-authenticated, rate limited)
Execution API route
   ↓  Zod validation, slug resolution
Execution service  (lib/exec/service.ts)
   ↓  limits, submission persistence
Sandbox boundary   (lib/exec/sandbox.ts)
   ↓  Docker container: no network, CPU/memory capped, read-only fs
Quantum runtime    (services/quantum-runtime/runner.py)
   ↓  Qiskit + Aer, scenario execution, limits enforcement
SandboxResult (JSON)
   ↓
Quantum Judge      (lib/judge/index.ts)
   ↓  test specification vs outcomes
JudgeResult
   ↓
Submission persisted → progress updated → UI renders verdict
```

## Components

### Workspace UI (`/problems/[slug]/solve`)

- Server component loads the published problem, the user's saved draft, and
  authentication state.
- Client component (`components/workspace/quantum-workspace.tsx`) hosts the
  CodeMirror Python editor, the Run control, and the result panel.
- Draft autosave is debounced (1.2 s) and scoped to the session user.
- Unauthenticated visitors can read the problem and code; Run requires an
  account.

### Execution API (`POST /api/executions/run`)

- Authentication required; identity comes from the server session only.
- Rate limited per user: 20 executions per 10 minutes (`RATE_LIMITS.execution`).
- Zod validation (`lib/exec/validation.ts`): slug shape, source size
  (≤ 50 KB), language, shots.
- Returns the full `RunResponse`; execution failures are part of the
  response (not HTTP errors) so they can be persisted and displayed.

### Sandbox boundary (`lib/exec/sandbox.ts`)

Modes (configured via `QUANTOO_SANDBOX_MODE`):

- `docker` (default) — every execution runs in a dedicated container built
  from `services/quantum-runtime/Dockerfile`.
- `host-fallback` — explicitly opt-in local development mode running the
  same runner with the host Python and a minimal environment. Never used
  implicitly and not for production.
- `disabled` — all executions fail fast with `SANDBOX_ERROR`.

Docker hardening applied to every run:

| Control | Value |
| --- | --- |
| Network | dedicated `quantoo-sandbox` network, no external connectivity |
| CPU | `--cpus 1` |
| Memory | `--memory` from `EXEC_MEMORY_MB` (default 512 MB) |
| Processes | `--pids-limit 128` |
| Filesystem | `--read-only` + 64 MB `noexec` tmpfs at `/tmp` |
| Privileges | `--cap-drop ALL`, `--security-opt no-new-privileges` |
| Environment | explicit minimal env only; no application secrets |
| Request | mounted read-only, deleted after the run |

Wall-clock timeout and stdout caps are enforced by the boundary in
addition to the container limits.

### Quantum runtime (`services/quantum-runtime/runner.py`)

Executes inside the sandbox. Responsibilities:

- Run the user module in a restricted namespace: import allowlist
  (`qiskit`, `qiskit_aer`, `numpy` and their submodules), removed
  filesystem/process builtins (`open`, `input`, `compile`, …), stdout
  captured into the payload (never on the process stdout channel).
- Enforce runtime policy: ≤ 8 qubits, ≤ 200 depth, ≤ 1 000 operations,
  ≤ 16 KB program output, ≤ 100 KB source.
- Simulate the `submission` scenario plus any scenario variants the
  problem's test specification requires (`zero_state`, `superposition`).
  Variants **inherit the user's measurement operations** so scenario checks
  evaluate the user's measurement wiring against a known input state.
- Emit exactly one JSON document on stdout; classify all failures into
  safe error codes with sanitized messages (no paths, no stack traces).

### Execution artifact

Every run persists a `Submission` row (Prisma model `Submission`) before
execution starts, so even a sandbox crash leaves an artifact:

- `userId` / `problemId` — ownership, always server-derived
- `sourceCode` — the submitted program
- `status` — PENDING → RUNNING → SUCCEEDED | FAILED | TIMED_OUT | RESOURCE_LIMIT
- `errorCode` / `errorMessage` — safe classification
- `judgeResult` — full `JudgeResult` JSON
- `executionResult` — per-scenario circuit metadata, counts/shots, and
  (for small unmeasured circuits) the statevector
- `durationMs` / `completedAt`

Fields intentionally left for future phases: noise models, observables,
backend metadata. Phase 5 added gate traces and state snapshots — see
[debugger.md](./debugger.md).

### Quantum Judge (`lib/judge/index.ts`)

Deterministic and data-driven: every check comes from the problem's stored
`testSpecification` (authored content). The judge never inspects anything
the user's program printed and never trusts client data.

Check types implemented in Phase 4:

| Type | Semantics |
| --- | --- |
| `STATE` | complex cosine similarity between expected amplitudes and the produced statevector — invariant under global phase, sensitive to relative phase |
| `DISTRIBUTION` | per-outcome probability tolerance against measured counts; scenario specs (`input: zero_state`) are evaluated against the matching runtime scenario |
| `STRUCTURAL` | required qubit count and required gates |
| `ENTANGLEMENT` | measurement correlation (all bits agree) from counts |

Spec types without an evaluator (`UNITARY`, `OBSERVABLE`, `FUNCTIONAL`,
`STATISTICAL`, `RESOURCE`) are reported as `SKIPPED` with an explanatory
message rather than silently ignored. Malformed specs are `SKIPPED` too —
authoring mistakes must not fail every submission.

A run passes only when at least one check was evaluated and none failed.
`SOLVED` progress is recorded only from a real judge pass.

## Resource policy

All limits are environment-configurable and clamped to safe bounds
(`lib/exec/limits.ts`): configuration can tighten but never disable a
limit. Defaults: 8 qubits, depth 200, 1 000 operations, 4 096 shots,
15 s wall clock, 512 MB, 16 KB output, 50 KB source.

## Known limitations (Phase 4)

- Docker is required for production-grade isolation; `host-fallback` is a
  development convenience with weaker isolation (restricted namespace +
  minimal environment, but same OS user).
- The in-memory rate limiter is single-process (documented in Phase 2).
- No execution queue yet: runs execute inline with a 15 s ceiling.
- Scenario variants are limited to `zero_state` and `superposition`.
- Statevectors are persisted only for circuits with ≤ 32 amplitudes.
