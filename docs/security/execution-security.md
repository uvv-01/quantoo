# Execution Security Model

User-submitted quantum code is **untrusted input**. This document records
the threat model and the controls that Phase 4 applies.

## Threat model

An attacker (or a naive user) may submit Python that attempts to:

1. escape the web application process (`eval`-style attacks),
2. read application secrets (`DATABASE_URL`, session secrets, SMTP),
3. read or corrupt the host filesystem or the repository,
4. attack the network (internal scanning, exfiltration, cloud metadata),
5. exhaust resources (infinite loops, giant statevectors, fork bombs,
   unbounded output), or
6. manipulate judging (print fake results, submit fake counts).

## Controls

### 1. Process isolation

User code never executes inside the Next.js server process. The sandbox
boundary spawns a dedicated Docker container per execution
(`lib/exec/sandbox.ts`). There is no `eval`/`exec`/`child_process` use on
submission content inside the web application.

### 2. Container hardening

| Control | Setting |
| --- | --- |
| Network | `quantoo-sandbox` Docker network; no external routes |
| CPU / memory | `--cpus 1`, `--memory` per `EXEC_MEMORY_MB` |
| Process count | `--pids-limit 128` (fork-bomb containment) |
| Filesystem | `--read-only`, `/tmp` on a 64 MB `noexec` tmpfs |
| Privileges | `--cap-drop ALL`, `no-new-privileges` |
| Lifecycle | `--rm`, one-shot; request file deleted after run |

### 3. Secret isolation

The runtime container receives an explicit minimal environment
(`PYTHONUNBUFFERED` only). Application secrets never enter the sandbox.
The request is mounted read-only and contains only the user's code and
simulation parameters. The host-fallback mode likewise builds an explicit
child environment (PATH/HOME/SYSTEMROOT/COMSPEC) — `process.env` is not
forwarded.

### 4. In-interpreter restrictions (defense in depth)

Inside the runtime, user code runs in a restricted namespace:

- imports allowlisted to `qiskit`, `qiskit_aer`, `numpy` (+ submodules);
- filesystem and process builtins removed (`open`, `input`, `compile`,
  `exit`, `breakpoint`, …);
- program stdout is captured into the payload — the process stdout channel
  is reserved for the result document, so user prints cannot forge a
  verdict.

These restrictions mitigate accidents in weak-isolation modes but are
**not** the primary security boundary; the container is.

### 5. Resource policy

Layered limits (runtime policy + boundary enforcement + container caps):

| Limit | Default | Configurable via |
| --- | --- | --- |
| Qubits | 8 | `EXEC_MAX_QUBITS` (ceiling 16) |
| Circuit depth | 200 | `EXEC_MAX_DEPTH` |
| Operations | 1 000 | `EXEC_MAX_OPERATIONS` |
| Shots | 4 096 | `EXEC_MAX_SHOTS` |
| Wall clock | 15 s | `EXEC_TIMEOUT_MS` |
| Memory | 512 MB | `EXEC_MEMORY_MB` |
| Program output | 16 KB | `EXEC_MAX_OUTPUT_BYTES` |
| Source size | 50 KB | `EXEC_MAX_SOURCE_BYTES` |

Configuration is clamped: floors and ceilings cannot be disabled.

### 6. Judging integrity

The judge evaluates only data produced by the sandbox (circuit metadata,
statevectors, counts from the AerSimulator). User `print` output is
displayed separately and never used to determine correctness. The judge
itself is deterministic code operating on authored specifications — no LLM
or AI system is involved in deciding correctness.

### 7. API hygiene

- Authentication required; identity from the session only.
- Rate limited per user (20 runs / 10 min) and per action for drafts.
- Zod validation of slug shape, source size, language, shots.
- Problem must be `PUBLISHED` — drafts are not executable.
- Users can read only their own submissions (`GET /api/executions`
  scopes by session user); cross-user access is structurally impossible
  because no client-owned identifier participates in authorization.
- Error responses carry codes and safe messages; stack traces, paths, and
  environment details are logged server-side only (truncated).

## Verification

Security-relevant automated tests:

- `tests/runtime/runner.test.ts` — import allowlist, builtin removal,
  path sanitization, qubit limits (real interpreter), plus Phase 5 trace
  and inspection limits (density-matrix / unitary caps, snapshot
  subsampling).
- `tests/exec/security.test.ts` — mode gating, disabled-mode refusal,
  no stack traces in failures.
- `tests/exec/limits-validation.test.ts` — limit clamping, request
  validation, slug injection rejection.
- `tests/judge/judge.test.ts` — judge correctness incl. phase invariance
  and malformed-spec handling.
- `tests/debugger/debugger-security.test.ts` and
  `tests/debugger/api.test.ts` — debugger payload sanitization,
  identifier validation, ownership enforcement: an authenticated user
  who does not own a submission gets the same 404 as a missing one, and
  unauthenticated requests are rejected with 401.
- `e2e/debugger.spec.ts` — browser-level privacy check that debugger
  endpoints reject cookie-less and foreign-user access.

Phase 5 does not change the isolation boundary: the debugger is a
consumer of the persisted artifact. No debugger feature executes code
in the web process or the browser, and inspection payloads are subject
to the same output-size caps as every other artifact field.

## Known limitations

- `host-fallback` mode (opt-in, local development) runs under the same OS
  user as the developer with weaker isolation. It is documented as a
  development convenience, not a production sandbox.
- The container network is a dedicated Docker network without external
  connectivity; inter-container reachability within that network is
  inconsequential because user containers run one-shot and nothing else
  attaches to it.
- Rate limiting is in-memory per process (see Phase 2 docs).
