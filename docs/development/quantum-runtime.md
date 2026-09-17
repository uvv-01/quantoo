# Quantum Runtime Setup

The quantum runtime executes user-submitted quantum programs in an
isolated Python environment. The same `runner.py` serves both execution
paths (local dev and Docker sandbox); only the isolation boundary
differs.

## Runtime components

`services/quantum-runtime/`:

| File | Purpose |
| --- | --- |
| `runner.py` | The runtime: restricted imports, request parsing, circuit execution, trace + snapshot capture, inspection (density matrix / unitary), structured JSON output |
| `requirements.txt` | Pinned runtime dependencies |
| `Dockerfile` | Hardened container image for the sandbox path |

Dependencies (Python 3.11):

- `qiskit` — circuit model + simulation orchestration
- `qiskit-aer` — statevector simulation and shot-based sampling
- `numpy` — numeric support used by Qiskit

No other packages are installed in the image; dynamic installation is
impossible (no network, no pip access from user code).

## Local development (host-fallback mode)

For development without Docker, set:

```bash
QUANTOO_SANDBOX_MODE=host-fallback
```

The sandbox boundary spawns `python runner.py` directly with stdin-based
request passing and the same timeout/output/limit enforcement. Host
Python must have the runtime dependencies installed:

```bash
python -m pip install -r services/quantum-runtime/requirements.txt
```

## Docker mode (default)

```bash
docker build -t quantoo/quantum-runtime:latest services/quantum-runtime
docker network create --internal quantoo-sandbox   # no-egress network, created once
```

The sandbox runs the image with:

- `--network quantoo-sandbox` (internal, no egress)
- `--read-only` root filesystem + `noexec` tmpfs
- `--cap-drop ALL`, `--security-opt no-new-privileges`
- CPU, memory, and PID limits
- no host mounts, no secrets, environment fully controlled

Selection is controlled by `QUANTOO_SANDBOX_MODE`: `docker` (default),
`host-fallback` (development only), `disabled` (reject executions).

## What the runner produces

The runner emits a single JSON artifact on stdout:

- circuit metadata (qubit count, depth, gate counts, hasMeasurements)
- measurement counts per scenario (sampled)
- gate trace (`steps`) with post-step state snapshots when inspection
  is requested and the circuit size allows it
- statevector pairs and exact, derived basis probabilities
- optional density matrix / unitary payloads, size-capped
- sanitized, classified errors (`TIMEOUT`, `MEMORY`, `RUNTIME_ERROR`,
  `SANDBOX_ERROR`, …) with no host details

## Runtime tests

`tests/runtime/runner.test.ts` spawns the real runner as a subprocess
(skips automatically when Python/Qiskit is unavailable, e.g. CI jobs
without the runtime). It covers Bell/zero/superposition scenarios,
trace ordering, snapshot exactness, inspection caps, timeouts, and
sandbox restriction cases.

## Adding a scenario

Scenario variants execute the user's measurement wiring against known
input states (e.g. `zero_state`, `superposition`). Add a scenario to
the runner's scenario registry and to the problem test spec schema —
the judge consumes scenario counts exactly like primary counts.
