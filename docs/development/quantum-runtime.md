# Quantum Runtime — Developer Guide

How to set up, test, and troubleshoot the quantum execution runtime.

## Layout

```text
services/quantum-runtime/
├── runner.py          # sandbox-side executor (stdin JSON → stdout JSON)
├── requirements.txt   # pinned Python dependencies
└── Dockerfile         # production sandbox image
```

## Local setup (host fallback)

1. Install Python 3.11+.
2. Install runtime dependencies:

   ```bash
   python -m pip install -r services/quantum-runtime/requirements.txt
   ```

3. Enable the explicit fallback mode in `.env`:

   ```text
   QUANTOO_SANDBOX_MODE=host-fallback
   ```

4. Start the app (`npm run dev`). Executions now run through the host
   Python interpreter with a restricted namespace and a minimal
   environment. This mode is weaker than the container sandbox and is for
   local development only.

## Container mode (default)

Build the image once:

```bash
docker build -t quantoo/quantum-runtime:latest services/quantum-runtime
```

Create the isolated network (once):

```bash
docker network create quantoo-sandbox
```

Ensure Docker Desktop is running, then start the app. Executions run in a
fresh container per request with no network, capped CPU/memory, and a
read-only filesystem. If Docker is unavailable, executions fail with
`SANDBOX_ERROR` — the app never silently downgrades isolation.

## Testing the runner directly

The runner reads one JSON request on stdin and writes one JSON document on
stdout:

```bash
echo '{"sourceCode": "from qiskit import QuantumCircuit
qc = QuantumCircuit(1)
qc.h(0)
result = qc", "scenarios": [{"name": "submission"}], "shots": 256}' \
  | python services/quantum-runtime/runner.py
```

- Success: `{"ok": true, "outcomes": {...}, "stdout": "..."}`
- Failure: `{"ok": false, "error": {"code": "SYNTAX_ERROR", "message": "..."}}`

Automated coverage lives in `tests/runtime/runner.test.ts` (skips
automatically when qiskit is not installed) and
`tests/exec/security.test.ts`.

## Request fields

| Field | Type | Notes |
| --- | --- | --- |
| `sourceCode` | string | required, ≤ 100 KB; must assign a `QuantumCircuit` to `result` |
| `scenarios` | `{name}[]` | `submission`, `zero_state`, `superposition` |
| `shots` | int | 1–10 000, default 4 096 |

## Error codes

| Code | Meaning |
| --- | --- |
| `INVALID_REQUEST` | malformed request document |
| `INVALID_CODE` | missing/invalid `result`, oversized source |
| `SYNTAX_ERROR` | user code does not parse |
| `IMPORT_ERROR` | import outside the allowlist |
| `RUNTIME_ERROR` | exception during execution |
| `QUBIT_LIMIT` | circuit exceeds the qubit cap |
| `CIRCUIT_LIMIT` | depth/operation cap exceeded |
| `OUTPUT_LIMIT` | program printed more than allowed |
| `MEMORY_LIMIT` | out of memory |
| `TIMEOUT` | wall clock exceeded (enforced by the boundary) |
| `SANDBOX_ERROR` | sandbox infrastructure failure |
| `SIMULATOR_ERROR` | runtime returned an unreadable result |

## Troubleshooting

- **Executions fail with `SANDBOX_ERROR` in dev** — Docker Desktop is not
  running or the `quantoo-sandbox` network is missing. Start Docker and
  create the network, or explicitly set `QUANTOO_SANDBOX_MODE=host-fallback`.
- **`SIMULATOR_ERROR` after upgrading qiskit** — rerun
  `pip install -r services/quantum-runtime/requirements.txt` and rebuild
  the image; the payload contract may have changed between versions.
- **Windows console shows mojibake for `>` characters** — cosmetic only;
  the payload is UTF-8 JSON.
- **Tests skip** — the runtime test suite probes `python -c "import qiskit,
  qiskit_aer"`; install the requirements to enable it.
