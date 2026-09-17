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


def _simulate(circuit, scenario: str, shots: int) -> dict:
    """Simulate one circuit and produce its structured outcome."""
    from qiskit.quantum_info import Statevector
    from qiskit_aer import AerSimulator

    outcome: dict = {"scenario": scenario, "circuit": _circuit_metadata(circuit)}

    if _has_measurements(circuit):
        simulator = AerSimulator()
        result = simulator.run(circuit, shots=shots).result()
        counts = result.get_counts(0)
        outcome["counts"] = {key: int(value) for key, value in counts.items()}
        outcome["shots"] = shots
    else:
        statevector = Statevector.from_instruction(circuit)
        # Amplitudes serialized as [real, imaginary] pairs.
        outcome["statevectorPairs"] = [
            [float(amplitude.real), float(amplitude.imag)]
            for amplitude in statevector.data
        ]
        outcome["globalPhase"] = float(circuit.global_phase)

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
            outcomes[scenario_name] = _simulate(circuit, scenario_name, shots)
        except BaseException as exc:  # noqa: BLE001 - sandbox boundary
            code, message = _classify(exc)
            _emit({"ok": False, "error": {"code": code, "message": message}})
            return 0

    _emit({
        "ok": True,
        "outcomes": outcomes,
        "stdout": user_stdout,
        "stderr": "",
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
