"""Quantoo quantum runtime runner.

Executes a user submission inside the sandbox boundary and emits a single
JSON result document on stdout (the payload channel). All diagnostics are
written to stderr. User program output (print) is captured into a buffer
and reported inside the payload, never written to the process stdout.

Responsibilities:
  - execute the user's module in a restricted namespace
  - run the "submission" scenario (the user's circuit)
  - run problem-defined scenario variants (e.g. a fresh zero state) so the
    judge can evaluate behavior the user's own circuit cannot express
  - enforce resource limits (qubits, depth, operations, output size)
  - capture structured, sanitized errors

This module is executed only by the sandbox boundary (Docker) with a
minimal environment. It must NEVER be imported into the web application.
"""

from __future__ import annotations

import builtins
import contextlib
import importlib
import importlib.util
import io
import json
import sys
import types

# ========================================
# Runtime policy (fixed inside the image; no environment secrets)
# ========================================

MAX_QUBITS = 8
MAX_DEPTH = 200
MAX_OPERATIONS = 1_000
MAX_OUTPUT_BYTES = 16_000

# Debugger trace policy. Per-step state snapshots are exponential in the
# qubit count (2^n complex amplitudes), so the runtime enforces an amortized
# byte budget and subsamples snapshots when a circuit would exceed it.
# Inspection matrices have their own hard qubit caps because density
# matrices are 2^n x 2^n and unitaries 2^n x 2^n complex entries.
MAX_TRACE_SNAPSHOT_BYTES = 384_000
# Per-request overrides (sent by the sandbox boundary from clamped
# environment configuration) are themselves clamped to these hard caps;
# configuration can tighten the policy but never exceed it.
HARD_DENSITY_MATRIX_QUBITS = 8
HARD_UNITARY_QUBITS = 6
HARD_SNAPSHOT_STEPS = 128
MAX_DENSITY_MATRIX_QUBITS = 4
MAX_UNITARY_QUBITS = 3
MAX_SNAPSHOT_STEPS = 32
MAX_PAYLOAD_BYTES = 1_500_000

# Top-level modules user code may import. Submodules of an allowed
# top-level module are allowed automatically.
IMPORT_ALLOWLIST = {"qiskit", "qiskit_aer", "numpy"}

# Builtins unavailable to user code.
BLOCKED_BUILTINS = {
    "compile",
    "input",
    "help",
    "license",
    "credits",
    "exit",
    "quit",
    "open",
    "breakpoint",
    "globals",
    "locals",
    "vars",
    "delattr",
    "setattr",
    "getattr",
}


# ========================================
# Restricted execution environment
# ========================================


def _build_safe_builtins() -> dict:
    """Build a restricted builtins dict for user code."""
    safe = {}
    for name in dir(builtins):
        if name.startswith("_") or name in BLOCKED_BUILTINS:
            continue
        safe[name] = getattr(builtins, name)
    return safe


def _allowlisted(name: str) -> bool:
    root = name.split(".")[0]
    if root in IMPORT_ALLOWLIST:
        return True
    # Allow explicit submodule requests of allowlisted roots.
    for allowed in IMPORT_ALLOWLIST:
        if name == allowed or name.startswith(allowed + "."):
            return True
    return False


def _restricted_import(
    name,
    globals=None,  # noqa: A002 - signature must match __import__
    locals=None,  # noqa: A002
    fromlist=(),
    level=0,
):
    if level not in (0, -1):
        raise ImportError("Relative imports are not allowed in the sandbox.")
    if not isinstance(name, str) or not _allowlisted(name):
        raise ImportError(
            "Import of this module is not allowed in the sandbox."
        )
    module = importlib.import_module(name)
    if fromlist:
        # Resolve requested names against the allowlist. A fromlist entry can
        # be a submodule (qiskit.circuit) or a plain attribute such as the
        # QuantumCircuit class, which is not importable as a module.
        for entry in fromlist:
            if not isinstance(entry, str):
                raise ImportError("Invalid import request.")
            candidate = f"{name}.{entry}"
            if _allowlisted(candidate) and _is_importable_module(candidate):
                importlib.import_module(candidate)
            elif not hasattr(module, entry):
                raise ImportError(
                    "Import of this module is not allowed in the sandbox."
                )
        return module
    return module


def _is_importable_module(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError, ModuleNotFoundError, AttributeError):
        return False


def _build_namespace() -> dict:
    builtins_module = types.ModuleType("builtins")
    for name, value in _build_safe_builtins().items():
        setattr(builtins_module, name, value)
    builtins_module.__import__ = _restricted_import
    return {"__name__": "quantoo_submission", "__builtins__": builtins_module}


# ========================================
# Error classification (safe messages only)
# ========================================


def _sanitize_message(msg: str) -> str:
    """Strip filesystem paths and host details from user-visible messages."""
    for internal in ("/app", "/tmp/", "/usr/", "/opt/", "C:\\", "C:/"):
        if internal in msg:
            return "An internal error occurred while running the program."
    return msg[:500]


def _classify(exc: BaseException) -> tuple[str, str]:
    name = type(exc).__name__
    msg = str(exc).strip() or name

    if isinstance(exc, SyntaxError):
        return "SYNTAX_ERROR", _sanitize_message(msg)
    if isinstance(exc, (ImportError, ModuleNotFoundError)):
        return "IMPORT_ERROR", "Import of this module is not allowed in the sandbox."
    if isinstance(exc, MemoryError):
        return "MEMORY_LIMIT", "The program used more memory than allowed."
    if isinstance(exc, RecursionError):
        return "RUNTIME_ERROR", "The program exceeded the recursion limit."

    lowered = msg.lower()
    if "number of qubits" in lowered and ("exceeds" in lowered or "maximum" in lowered):
        return "QUBIT_LIMIT", "The circuit uses more qubits than allowed."
    if "too many qubits" in lowered:
        return "QUBIT_LIMIT", "The circuit uses more qubits than allowed."
    if "depth" in lowered and "exceeds" in lowered:
        return "CIRCUIT_LIMIT", "The circuit is deeper than allowed."
    if "operation count" in lowered and "exceeds" in lowered:
        return "CIRCUIT_LIMIT", "The circuit has more operations than allowed."

    return "RUNTIME_ERROR", _sanitize_message(msg)


# ========================================
# User code execution
# ========================================


def _execute_user_module(source: str) -> tuple[dict, str]:
    """Execute the user's module once; return (namespace, captured stdout)."""
    namespace = _build_namespace()
    buffer = io.StringIO()
    try:
        code = compile(source, "<quantoo submission>", "exec")
    except SyntaxError as exc:
        raise exc
    with contextlib.redirect_stdout(buffer):
        exec(code, namespace)  # noqa: S102 - sandboxed execution of submission
    return namespace, buffer.getvalue()


def _get_result_circuit(namespace: dict):
    circuit = namespace.get("result")
    if circuit is None:
        raise ValueError(
            "The program must assign a QuantumCircuit to a variable named `result`."
        )
    num_qubits = getattr(circuit, "num_qubits", None)
    if not hasattr(circuit, "data") or num_qubits is None:
        raise ValueError(
            "The `result` variable must be a QuantumCircuit."
        )
    return circuit


# ========================================
# Scenario variants
# ========================================


def _build_variant(name: str, base_circuit, qiskit_module):
    """Build a variant circuit for a named scenario.

    - submission: the user's own circuit, unchanged
    - zero_state: a fresh circuit with the same qubit count (no gates)
    - superposition: a fresh circuit with H applied to qubit 0

    Variant circuits inherit the user's measurement operations so that
    scenario checks evaluate the user's measurement wiring against a
    known input state, not a platform-built circuit.
    """
    n = base_circuit.num_qubits
    m = base_circuit.num_clbits
    if name == "submission":
        return base_circuit
    if name == "zero_state":
        circuit = qiskit_module.QuantumCircuit(n, m)
    elif name == "superposition":
        circuit = qiskit_module.QuantumCircuit(n, m)
        circuit.h(0)
    else:
        raise ValueError(f"Unknown scenario: {name}")
    _copy_measurements(base_circuit, circuit)
    return circuit


def _copy_measurements(source, target):
    """Copy measurement instructions from source onto target."""
    for instruction in source.data:
        if instruction.operation.name != "measure":
            continue
        qubits = [
            target.qubits[source.find_bit(q).index] for q in instruction.qubits
        ]
        clbits = [
            target.clbits[source.find_bit(c).index] for c in instruction.clbits
        ]
        target.append(instruction.operation, qubits, clbits)


# ========================================
# Circuit inspection & simulation
# ========================================


def _circuit_metadata(circuit) -> dict:
    gate_counts: dict = {}
    for instruction in circuit.data:
        gate_name = instruction.operation.name
        gate_counts[gate_name] = gate_counts.get(gate_name, 0) + 1
    return {
        "qubits": circuit.num_qubits,
        "clbits": circuit.num_clbits,
        "depth": circuit.depth(),
        "gateCounts": gate_counts,
        "totalGates": sum(gate_counts.values()),
    }


# ========================================
# Gate trace & state snapshots (Phase 5 debugger)
# ========================================


def _round_pairs(data) -> list:
    """Serialize complex amplitudes as rounded [real, imaginary] pairs."""
    return [
        [round(float(amplitude.real), 10), round(float(amplitude.imag), 10)]
        for amplitude in data
    ]


def _gate_trace_steps(circuit) -> list:
    """Ordered gate-level steps for the circuit, preserving operation order."""
    steps: list = []
    for index, instruction in enumerate(circuit.data):
        op = instruction.operation
        steps.append({
            "stepIndex": index,
            "operationIndex": index,
            "gateName": op.name,
            "qubits": [circuit.find_bit(q).index for q in instruction.qubits],
            "clbits": [circuit.find_bit(c).index for c in instruction.clbits],
            "params": [float(p) for p in getattr(op, "params", [])],
            "measurement": op.name == "measure",
        })
    return steps


def _snapshot_policy(circuit, steps: list, max_snapshot_steps: int = MAX_SNAPSHOT_STEPS) -> dict:
    """Decide which steps can carry exact state snapshots.

    Each snapshot holds 2^n complex amplitudes. The policy keeps the total
    serialized snapshot payload within MAX_TRACE_SNAPSHOT_BYTES and records
    snapshots for at most `max_snapshot_steps` steps: every step when
    affordable, otherwise an evenly spaced subsample (first and last always
    included), otherwise no snapshots at all.
    """
    amps = 2 ** circuit.num_qubits
    bytes_per_snapshot = amps * 24  # two rounded floats per amplitude
    affordable = min(
        max_snapshot_steps,
        max(0, MAX_TRACE_SNAPSHOT_BYTES // bytes_per_snapshot),
    )
    total = len(steps)
    if total == 0 or affordable < 2:
        return {
            "available": False,
            "representation": "statevector",
            "subsampled": False,
            "stride": 0,
            "reason": (
                "State snapshots would exceed the debugger size budget "
                "for this circuit."
                if total > 0
                else "The circuit has no operations to trace."
            ),
        }
    if total <= affordable:
        return {
            "available": True,
            "representation": "statevector",
            "subsampled": False,
            "stride": 1,
            "reason": None,
        }
    stride = -(-total // affordable)  # ceil division
    return {
        "available": True,
        "representation": "statevector",
        "subsampled": True,
        "stride": stride,
        "reason": (
            "Exact state snapshots are shown for a subsample of steps "
            "(every %dth step) to stay within the debugger size budget."
            % stride
        ),
    }


def _snapshot_indices(policy: dict, total: int) -> set:
    if not policy["available"] or total == 0:
        return set()
    if not policy["subsampled"]:
        return set(range(total))
    stride = policy["stride"]
    indices = set(range(0, total, stride))
    indices.add(total - 1)
    return indices


def _trace_with_snapshots(circuit, scenario: str, max_snapshot_steps: int = MAX_SNAPSHOT_STEPS) -> dict:
    """Build the gate trace with per-step statevector snapshots.

    Snapshots come from incrementally rebuilding the circuit without its
    classical register and taking exact Statevector simulations. Measurement
    steps snapshot the pre-measurement state: the post-measurement state
    depends on the sampled outcome, so it is never reported as exact.
    """
    from qiskit import QuantumCircuit as QC
    from qiskit.quantum_info import Statevector

    steps = _gate_trace_steps(circuit)
    policy = _snapshot_policy(circuit, steps, max_snapshot_steps)
    wanted = _snapshot_indices(policy, len(steps))

    n = circuit.num_qubits
    probe = QC(n)
    trace_steps: list = []
    for step in steps:
        if step["measurement"]:
            # Classical register untouched; state unchanged before collapse.
            entry = dict(step)
            if step["stepIndex"] in wanted:
                entry["afterState"] = _round_pairs(
                    Statevector.from_instruction(probe).data
                )
            trace_steps.append(entry)
            continue
        instruction = circuit.data[step["operationIndex"]]
        probe.append(
            instruction.operation,
            [probe.qubits[i] for i in step["qubits"]],
            [],
        )
        entry = dict(step)
        if step["stepIndex"] in wanted:
            entry["afterState"] = _round_pairs(
                Statevector.from_instruction(probe).data
            )
        trace_steps.append(entry)

    return {"steps": trace_steps, "policy": policy}


def _measurement_free_clone(circuit):
    """Clone the circuit without classical registers and measurements."""
    from qiskit import QuantumCircuit as QC

    clone = QC(circuit.num_qubits)
    for instruction in circuit.data:
        if instruction.operation.name == "measure":
            continue
        clone.append(
            instruction.operation,
            [clone.qubits[circuit.find_bit(q).index] for q in instruction.qubits],
            [],
        )
    return clone


def _inspection_matrices(circuit, requested: list, max_density_qubits: int = MAX_DENSITY_MATRIX_QUBITS, max_unitary_qubits: int = MAX_UNITARY_QUBITS) -> dict:
    """Density matrix and unitary for the final circuit, within hard caps."""
    inspection: dict = {}
    if "density_matrix" in requested:
        if circuit.num_qubits > max_density_qubits:
            inspection["densityMatrixUnavailable"] = "TOO_LARGE"
        else:
            from qiskit.quantum_info import DensityMatrix

            density = DensityMatrix.from_instruction(
                _measurement_free_clone(circuit)
            )
            inspection["densityMatrixPairs"] = _round_pairs(density.data.ravel())
            inspection["densityMatrixDim"] = 2 ** circuit.num_qubits
    if "unitary" in requested:
        if circuit.num_qubits > max_unitary_qubits:
            inspection["unitaryUnavailable"] = "TOO_LARGE"
        else:
            from qiskit.quantum_info import Operator

            unitary = Operator(_measurement_free_clone(circuit)).data
            inspection["unitaryPairs"] = _round_pairs(unitary.ravel())
            inspection["unitaryDim"] = 2 ** circuit.num_qubits
    return inspection


def _check_limits(circuit) -> None:
    meta = _circuit_metadata(circuit)
    if meta["qubits"] > MAX_QUBITS:
        raise ValueError("number of qubits exceeds the sandbox limit")
    if meta["depth"] > MAX_DEPTH:
        raise ValueError("circuit depth exceeds the sandbox limit")
    if meta["totalGates"] > MAX_OPERATIONS:
        raise ValueError("circuit operation count exceeds the sandbox limit")


def _has_measurements(circuit) -> bool:
    return any(
        instruction.operation.name == "measure" for instruction in circuit.data
    )


def _environment_metadata() -> dict:
    """Safe runtime environment versions for the execution record.

    Only non-sensitive technical metadata: interpreter and library
    versions. Never environment variables, paths, or credentials.
    Missing components report null rather than a guess.
    """
    import platform

    def _version(module_name: str):
        try:
            module = importlib.import_module(module_name)
        except Exception:  # noqa: BLE001 - optional component
            return None
        return getattr(module, "__version__", None)

    return {
        "python": platform.python_version(),
        "framework": {"name": "qiskit", "version": _version("qiskit")},
        "simulator": {"name": "qiskit_aer", "version": _version("qiskit_aer")},
        "numpy": _version("numpy"),
    }


def _simulate(
    circuit,
    scenario: str,
    shots: int,
    inspect: list,
    seed=None,
    max_snapshot_steps: int = MAX_SNAPSHOT_STEPS,
    max_density_qubits: int = MAX_DENSITY_MATRIX_QUBITS,
    max_unitary_qubits: int = MAX_UNITARY_QUBITS,
) -> dict:
    """Simulate one circuit and produce its structured outcome."""
    from qiskit.quantum_info import Statevector
    from qiskit_aer import AerSimulator

    outcome: dict = {"scenario": scenario, "circuit": _circuit_metadata(circuit)}

    if _has_measurements(circuit):
        # The seed makes sampled counts reproducible; without one Aer's
        # entropy source is used (the artifact records seed as absent).
        run_kwargs: dict = {"shots": shots}
        if seed is not None:
            run_kwargs["seed_simulator"] = seed
        simulator = AerSimulator()
        result = simulator.run(circuit, **run_kwargs).result()
        counts = result.get_counts(0)
        outcome["counts"] = {key: int(value) for key, value in counts.items()}
        outcome["shots"] = shots
        if seed is not None:
            outcome["seed"] = seed
        counts = result.get_counts(0)
        outcome["counts"] = {key: int(value) for key, value in counts.items()}
        outcome["shots"] = shots
    else:
        statevector = Statevector.from_instruction(circuit)
        # Amplitudes serialized as [real, imaginary] pairs.
        outcome["statevectorPairs"] = _round_pairs(statevector.data)
        outcome["globalPhase"] = float(circuit.global_phase)
        # Exact computational-basis probabilities derived from the statevector.
        exact: dict = {}
        for index, amplitude in enumerate(statevector.data):
            probability = float(abs(amplitude) ** 2)
            if probability > 0:
                exact[format(index, f"0{circuit.num_qubits}b")] = round(probability, 10)
        outcome["probabilities"] = exact

    outcome["trace"] = _trace_with_snapshots(circuit, scenario, max_snapshot_steps)
    if inspect:
        outcome["inspection"] = _inspection_matrices(
            _measurement_free_clone(circuit), inspect, max_density_qubits, max_unitary_qubits
        )

    return outcome


# ========================================
# Entry point
# ========================================


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.write("\n")
    sys.stdout.flush()


def main() -> int:
    try:
        request = json.loads(sys.stdin.buffer.read())
    except json.JSONDecodeError:
        _emit({"ok": False, "error": {"code": "INVALID_REQUEST", "message": "Malformed execution request."}})
        return 0

    source = request.get("sourceCode")
    if not isinstance(source, str) or not source.strip():
        _emit({"ok": False, "error": {"code": "INVALID_CODE", "message": "Source code is required."}})
        return 0
    if len(source.encode("utf-8")) > 100_000:
        _emit({"ok": False, "error": {"code": "INVALID_CODE", "message": "Source code is too large."}})
        return 0

    scenarios = request.get("scenarios") or [{"name": "submission"}]
    if not isinstance(scenarios, list) or not scenarios:
        scenarios = [{"name": "submission"}]
    shots = request.get("shots", 4096)
    if not isinstance(shots, int) or shots < 1 or shots > 10_000:
        shots = 4096

    inspect = request.get("inspect") or []
    if not isinstance(inspect, list):
        inspect = []
    inspect = [
        name for name in inspect
        if name in ("density_matrix", "unitary")
    ]

    # Optional deterministic seed for sampled measurements (reproduction).
    seed = request.get("seed")
    if not isinstance(seed, int) or isinstance(seed, bool) or seed < 0:
        seed = None

    # Debugger snapshot policy overrides. Values arrive from clamped
    # environment configuration and are clamped again to hard caps here.
    def _clamp_int(raw, fallback, low, high):
        if not isinstance(raw, int) or isinstance(raw, bool):
            return fallback
        return max(low, min(high, raw))

    max_snapshot_steps = _clamp_int(
        request.get("maxSnapshotSteps"), MAX_SNAPSHOT_STEPS, 1, HARD_SNAPSHOT_STEPS
    )
    max_density_qubits = _clamp_int(
        request.get("maxDensityQubits"),
        MAX_DENSITY_MATRIX_QUBITS,
        1,
        HARD_DENSITY_MATRIX_QUBITS,
    )
    max_unitary_qubits = _clamp_int(
        request.get("maxUnitaryQubits"),
        MAX_UNITARY_QUBITS,
        1,
        HARD_UNITARY_QUBITS,
    )

    # Import qiskit before running user code so import failures are
    # classified as internal errors, not user errors.
    try:
        import qiskit  # noqa: F401
    except Exception:  # noqa: BLE001
        _emit({"ok": False, "error": {"code": "SIMULATOR_ERROR", "message": "The quantum runtime is unavailable."}})
        return 0

    try:
        namespace, user_stdout = _execute_user_module(source)
    except SystemExit:
        _emit({"ok": False, "error": {"code": "RUNTIME_ERROR", "message": "The program attempted to exit the sandbox."}})
        return 0
    except BaseException as exc:  # noqa: BLE001 - sandbox boundary
        code, message = _classify(exc)
        _emit({"ok": False, "error": {"code": code, "message": message}})
        return 0

    if len(user_stdout.encode("utf-8")) > MAX_OUTPUT_BYTES:
        user_stdout = user_stdout[:MAX_OUTPUT_BYTES]
        _emit({
            "ok": False,
            "error": {"code": "OUTPUT_LIMIT", "message": "Program output exceeded the allowed size."},
        })
        return 0

    try:
        base_circuit = _get_result_circuit(namespace)
    except ValueError as exc:
        _emit({"ok": False, "error": {"code": "INVALID_CODE", "message": str(exc)}})
        return 0
    except BaseException as exc:  # noqa: BLE001
        code, message = _classify(exc)
        _emit({"ok": False, "error": {"code": code, "message": message}})
        return 0

    outcomes: dict = {}
    for scenario_spec in scenarios:
        scenario_name = str(scenario_spec.get("name", "submission")) if isinstance(scenario_spec, dict) else "submission"
        try:
            circuit = _build_variant(scenario_name, base_circuit, qiskit)
            _check_limits(circuit)
            outcomes[scenario_name] = _simulate(
                circuit,
                scenario_name,
                shots,
                inspect,
                seed,
                max_snapshot_steps,
                max_density_qubits,
                max_unitary_qubits,
            )
        except BaseException as exc:  # noqa: BLE001 - sandbox boundary
            code, message = _classify(exc)
            _emit({"ok": False, "error": {"code": code, "message": message}})
            return 0

    # The debugger adds per-step snapshots and inspection matrices; keep the
    # final payload within the sandbox output cap and report the shortfall
    # instead of truncating silently.
    payload = {
        "ok": True,
        "outcomes": outcomes,
        "environment": _environment_metadata(),
        "stdout": user_stdout,
        "stderr": "",
    }
    size = len(json.dumps(payload).encode("utf-8"))
    if size > MAX_PAYLOAD_BYTES:
        for outcome in outcomes.values():
            outcome.pop("trace", None)
        size = len(json.dumps(payload).encode("utf-8"))
    if size > MAX_PAYLOAD_BYTES:
        for outcome in outcomes.values():
            outcome.pop("inspection", None)
            outcome["inspectionUnavailable"] = "TOO_LARGE"
        size = len(json.dumps(payload).encode("utf-8"))
    if size > MAX_PAYLOAD_BYTES:
        return _emit_error_safely(
            "OUTPUT_LIMIT",
            "The debugger data for this circuit exceeded the allowed size.",
        )

    _emit(payload)
    return 0


def _emit_error_safely(code: str, message: str) -> int:
    _emit({"ok": False, "error": {"code": code, "message": message}})
    return 0


if __name__ == "__main__":
    sys.exit(main())
