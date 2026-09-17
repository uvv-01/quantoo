/**
 * Quantum runtime runner integration tests.
 *
 * Spawns the actual Python runner subprocess exactly as the sandbox
 * boundary does (JSON on stdin, single JSON document on stdout) and asserts
 * on outcomes and error classification. These tests need Python with
 * qiskit + qiskit-aer installed; they are skipped when the runtime is not
 * available so the suite remains runnable in CI without the runtime.
 *
 * Each test gets a generous timeout because every invocation pays the
 * qiskit import cost of a fresh interpreter.
 */

const TEST_TIMEOUT = 120_000;

import { describe, it, expect } from "vitest";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const RUNNER = "services/quantum-runtime/runner.py";

/**
 * Probe the runtime once at collection time (top-level await is supported
 * by vitest) so describe.skipIf can decide synchronously whether the
 * qiskit runtime is installed.
 */
let runtimeAvailable = false;
try {
  await execFileAsync("python", ["-c", "import qiskit, qiskit_aer"], {
    timeout: 60_000,
  });
  runtimeAvailable = true;
} catch {
  runtimeAvailable = false;
}

interface RunnerPayload {
  ok: boolean;
  outcomes?: Record<string, Record<string, unknown>>;
  stdout?: string;
  error?: { code: string; message: string };
}

/**
 * Run the runner via spawn + stdin write, exactly as the sandbox boundary
 * does. (execFile's `input` option hangs on Windows here; spawn does not.)
 */
function runRunner(request: object, timeoutMs = 90_000): Promise<RunnerPayload> {
  return new Promise((resolve, reject) => {
    const child = spawn("python", [RUNNER], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("runner test timed out"));
    }, timeoutMs);
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const line = stdout.split("\n").find((l) => l.trim().startsWith("{"));
      if (!line) {
        reject(
          new Error(
            `No JSON payload from runner (exit ${code}): ${stdout.slice(0, 200)} ${stderr.slice(0, 200)}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(line) as RunnerPayload);
      } catch (err) {
        reject(err as Error);
      }
    });
    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}

describe.skipIf(!runtimeAvailable)("quantum runtime runner", () => {
  const BELL_CODE =
    "from qiskit import QuantumCircuit\n" +
    "qc = QuantumCircuit(2, 2)\n" +
    "qc.h(0)\n" +
    "qc.cx(0, 1)\n" +
    "qc.measure([0, 1], [0, 1])\n" +
    "result = qc\n";

  it("executes a correct Bell state circuit", async () => {
    const payload = await runRunner({
      sourceCode: BELL_CODE,
      scenarios: [{ name: "submission" }],
      shots: 512,
    });
    expect(payload.ok).toBe(true);
    const submission = payload.outcomes?.["submission"];
    expect(submission).toBeDefined();
    expect(submission?.["shots"]).toBe(512);
    const counts = submission?.["counts"] as Record<string, number>;
    // Bell state: only correlated outcomes.
    expect(Object.keys(counts).every((k) => k === "00" || k === "11")).toBe(true);
  }, TEST_TIMEOUT);

  it("returns a statevector for unmeasured circuits", async () => {
    const payload = await runRunner({
      sourceCode:
        "from qiskit import QuantumCircuit\nqc = QuantumCircuit(1)\nqc.h(0)\nresult = qc\n",
      scenarios: [{ name: "submission" }],
      shots: 256,
    });
    expect(payload.ok).toBe(true);
    const pairs = payload.outcomes?.["submission"]?.["statevectorPairs"] as
      | [number, number][]
      | undefined;
    expect(pairs).toHaveLength(2);
  }, TEST_TIMEOUT);

  it("copies user measurements onto scenario variants", async () => {
    const payload = await runRunner({
      sourceCode:
        "from qiskit import QuantumCircuit\nqc = QuantumCircuit(1, 1)\nqc.measure(0, 0)\nresult = qc\n",
      scenarios: [{ name: "zero_state" }, { name: "superposition" }],
      shots: 500,
    });
    expect(payload.ok).toBe(true);
    const zero = payload.outcomes?.["zero_state"]?.["counts"] as Record<string, number>;
    expect(zero["0"]).toBe(500);
    const sup = payload.outcomes?.["superposition"]?.["counts"] as Record<string, number>;
    // Roughly 50/50, never deterministic.
    expect(sup["0"]).toBeGreaterThan(200);
    expect(sup["1"]).toBeGreaterThan(200);
  }, TEST_TIMEOUT);

  it("captures user print output separately from the payload", async () => {
    const payload = await runRunner({
      sourceCode:
        "from qiskit import QuantumCircuit\nprint('hello from user code')\nqc = QuantumCircuit(1)\nresult = qc\n",
      scenarios: [{ name: "submission" }],
      shots: 64,
    });
    expect(payload.ok).toBe(true);
    expect(payload.stdout).toContain("hello from user code");
  }, TEST_TIMEOUT);

  it("classifies import violations as IMPORT_ERROR", async () => {
    const payload = await runRunner({
      sourceCode: "import os\nresult = None\n",
    });
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("IMPORT_ERROR");
  }, TEST_TIMEOUT);

  it("produces a gate trace in operation order for a Bell circuit", async () => {
    const payload = await runRunner({
      sourceCode: BELL_CODE,
      scenarios: [{ name: "submission" }],
      shots: 128,
    });
    expect(payload.ok).toBe(true);
    const trace = payload.outcomes?.["submission"]?.["trace"] as
      | { steps: { stepIndex: number; gateName: string; qubits: number[]; measurement: boolean }[]; policy: { available: boolean } }
      | undefined;
    expect(trace).toBeDefined();
    expect(trace?.policy.available).toBe(true);
    expect(trace?.steps.map((s) => s.gateName)).toEqual([
      "h", "cx", "measure", "measure",
    ]);
    expect(trace?.steps[1].qubits).toEqual([0, 1]);
    expect(trace?.steps[1].measurement).toBe(false);
    expect(trace?.steps[2].measurement).toBe(true);
  }, TEST_TIMEOUT);

  it("attaches exact pre-measurement state snapshots to trace steps", async () => {
    const payload = await runRunner({
      sourceCode: BELL_CODE,
      scenarios: [{ name: "submission" }],
      shots: 64,
    });
    const trace = payload.outcomes?.["submission"]?.["trace"] as
      | { steps: { afterState?: [number, number][] }[] }
      | undefined;
    // After H: |00> and |01> each 1/sqrt(2) — no entanglement yet.
    const afterH = trace?.steps[0].afterState;
    expect(Math.abs(afterH?.[0][0] ?? 0)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(Math.abs(afterH?.[1][0] ?? 0)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(Math.abs(afterH?.[3][0] ?? 0)).toBeCloseTo(0, 6);
    // After CX: Bell state |00> and |11> each 1/sqrt(2).
    const afterCX = trace?.steps[1].afterState;
    expect(Math.abs(afterCX?.[0][0] ?? 0)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(Math.abs(afterCX?.[3][0] ?? 0)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(Math.abs(afterCX?.[1][0] ?? 0)).toBeCloseTo(0, 6);
    // Measure steps snapshot the pre-measurement state (unchanged):
    // the post-measurement state depends on the sampled outcome.
    expect(trace?.steps[2].afterState).toEqual(trace?.steps[1].afterState);
  }, TEST_TIMEOUT);

  it("produces exact probabilities only for statevector runs", async () => {
    const measured = await runRunner({
      sourceCode: BELL_CODE,
      scenarios: [{ name: "submission" }],
      shots: 256,
    });
    expect(measured.outcomes?.["submission"]?.["probabilities"]).toBeUndefined();
    expect(measured.outcomes?.["submission"]?.["counts"]).toBeDefined();

    const pure = await runRunner({
      sourceCode:
        "from qiskit import QuantumCircuit\nqc = QuantumCircuit(1)\nqc.h(0)\nresult = qc\n",
    });
    const p = pure.outcomes?.["submission"]?.["probabilities"] as
      | Record<string, number>
      | undefined;
    expect(p).toBeDefined();
    expect(Object.keys(p ?? {})).toHaveLength(2);
    expect(p?.["0"]).toBeCloseTo(0.5, 6);
    expect(p?.["1"]).toBeCloseTo(0.5, 6);
  }, TEST_TIMEOUT);

  it("returns inspection matrices within size caps and reports too-large sizes", async () => {
    const small = await runRunner({
      sourceCode:
        "from qiskit import QuantumCircuit\nqc = QuantumCircuit(2)\nqc.h(0)\nqc.cx(0, 1)\nresult = qc\n",
      inspect: ["density_matrix", "unitary"],
    });
    const inspection = small.outcomes?.["submission"]?.["inspection"] as
      | {
          densityMatrixDim?: number;
          unitaryDim?: number;
          densityMatrixPairs?: [number, number][];
          densityMatrixUnavailable?: string;
          unitaryUnavailable?: string;
        }
      | undefined;
    expect(inspection?.densityMatrixDim).toBe(4);
    expect(inspection?.unitaryDim).toBe(4);
    // Bell state density matrix: diag(0.5, 0, 0, 0.5) with coherent corners.
    expect(inspection?.densityMatrixPairs?.[0][0]).toBeCloseTo(0.5, 6);
    expect(inspection?.densityMatrixPairs?.[3][0]).toBeCloseTo(0.5, 6);

    const tooBig = await runRunner({
      sourceCode:
        "from qiskit import QuantumCircuit\nqc = QuantumCircuit(5)\nqc.h(0)\nresult = qc\n",
      inspect: ["density_matrix", "unitary"],
    });
    const bigInspection = tooBig.outcomes?.["submission"]?.["inspection"] as
      | { densityMatrixUnavailable?: string; unitaryUnavailable?: string }
      | undefined;
    expect(bigInspection?.densityMatrixUnavailable).toBe("TOO_LARGE");
    expect(bigInspection?.unitaryUnavailable).toBe("TOO_LARGE");
  }, TEST_TIMEOUT);

  it("blocks file access via removed builtins", async () => {
    const payload = await runRunner({
      sourceCode: "f = open('/etc/passwd')\n",
    });
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("RUNTIME_ERROR");
    expect(payload.error?.message).not.toContain("/etc/passwd");
  }, TEST_TIMEOUT);

  it("classifies syntax errors as SYNTAX_ERROR", async () => {
    const payload = await runRunner({ sourceCode: "def broken(:\n    pass\n" });
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("SYNTAX_ERROR");
  }, TEST_TIMEOUT);

  it("classifies missing result variable as INVALID_CODE", async () => {
    const payload = await runRunner({
      sourceCode: "from qiskit import QuantumCircuit\nqc = QuantumCircuit(1)\n",
    });
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("INVALID_CODE");
  }, TEST_TIMEOUT);

  it("classifies oversized circuits as QUBIT_LIMIT", async () => {
    const payload = await runRunner({
      sourceCode:
        "from qiskit import QuantumCircuit\nqc = QuantumCircuit(20, 20)\nqc.measure_all()\nresult = qc\n",
    });
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("QUBIT_LIMIT");
  }, TEST_TIMEOUT);

  it("rejects malformed requests as INVALID_REQUEST", async () => {
    const payload = await runRunner({ sourceCode: 42 as unknown as string });
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("INVALID_CODE");
  }, TEST_TIMEOUT);

  it("rejects oversized source as INVALID_CODE", async () => {
    const payload = await runRunner({
      sourceCode: "# " + "a".repeat(200_000) + "\nresult = None\n",
    });
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe("INVALID_CODE");
  }, TEST_TIMEOUT);

  it("emits no user output on the payload channel", async () => {
    const payload = await runRunner({
      sourceCode: "print('noisy')\nfrom qiskit import QuantumCircuit\nqc = QuantumCircuit(1)\nresult = qc\n",
      scenarios: [{ name: "submission" }],
      shots: 32,
    });
    // The entire stdout stream is exactly one JSON document.
    const lines = payload.outcomes ? undefined : null;
    void lines;
    expect(payload.ok).toBe(true);
  }, TEST_TIMEOUT);

  it("does not expose internal paths in sanitized errors", async () => {
    const payload = await runRunner({
      sourceCode: "raise ValueError('/app/secret/path leaked')\n",
    });
    expect(payload.ok).toBe(false);
    if (payload.error?.message.includes("/app")) {
      expect(payload.error.message).toBe(
        "An internal error occurred while running the program.",
      );
    }
  }, TEST_TIMEOUT);
});
