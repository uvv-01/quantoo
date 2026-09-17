/**
 * Shared fixtures for semantic tests (Phase 6).
 *
 * These call the REAL quantum runtime runner (host Python with the actual
 * Qiskit/Aer stack) exactly as the sandbox does, so every behavioral
 * comparison in the test suite runs against genuine execution artifacts —
 * never fabricated quantum data.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import type { ScenarioOutcome } from "@/lib/exec/types";

const RUNNER = path.join(
  process.cwd(),
  "services",
  "quantum-runtime",
  "runner.py",
);

interface RunnerPayload {
  ok: boolean;
  outcomes?: Record<string, ScenarioOutcome>;
  environment?: unknown;
  error?: { code: string; message: string };
}

/** Execute a source program through the real runner and return its outcome. */
export function runRealScenario(sourceCode: string, shots = 4096, seed = 42): ScenarioOutcome {
  const request = JSON.stringify({
    sourceCode,
    scenarios: [{ name: "submission" }],
    shots,
    seed,
    inspect: [],
  });
  const stdout = execFileSync("python", [RUNNER], {
    input: request,
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    } as NodeJS.ProcessEnv,
  });
  const line = stdout.split("\n").find((l) => l.trim().startsWith("{"));
  if (!line) throw new Error("runner produced no JSON line");
  const payload = JSON.parse(line) as RunnerPayload;
  if (!payload.ok || !payload.outcomes) {
    throw new Error(`runner failed: ${payload.error?.code} ${payload.error?.message}`);
  }
  return payload.outcomes["submission"];
}

/** Bell state H(0)+CX: ~50/50 over |00>, |11>, with trace. */
export function bellOutcome(shots = 4096): ScenarioOutcome {
  return runRealScenario(
    "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2,2)\nresult.h(0)\nresult.cx(0,1)\nresult.measure([0,1],[0,1])",
    shots,
  );
}

/** X instead of H: |11> always. Structurally similar, behaviorally different. */
export function bellOutcomeWithX(shots = 4096): ScenarioOutcome {
  return runRealScenario(
    "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2,2)\nresult.x(0)\nresult.cx(0,1)\nresult.measure([0,1],[0,1])",
    shots,
  );
}

/** Zero state: |00> always (used for exact-probability fixtures). */
export function zeroStateOutcome(): ScenarioOutcome {
  return runRealScenario(
    "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2)\nresult.z(0)\nresult.z(0)",
    1024,
  );
}

/**
 * Bell state via Ry(pi/2) instead of H: same resource profile (2 ops,
 * depth 2) but a different gate vocabulary — behaviorally equivalent,
 * structurally different.
 */
export function ryBellOutcome(shots = 4096): ScenarioOutcome {
  return runRealScenario(
    "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2,2)\nresult.ry(1.5707963267948966,0)\nresult.cx(0,1)\nresult.measure([0,1],[0,1])",
    shots,
  );
}

/**
 * Bell state plus cancelling H pair: same behavior, +2 gates —
 * i.e. a resource regression with equivalent behavior.
 */
export function deepVariantOutcome(shots = 4096): ScenarioOutcome {
  return runRealScenario(
    "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2,2)\nresult.h(0)\nresult.cx(0,1)\nresult.h(1)\nresult.h(1)\nresult.measure([0,1],[0,1])",
    shots,
  );
}

/** Much deeper equivalent variant (two more cancelling H pairs). */
export function veryDeepVariantOutcome(shots = 4096): ScenarioOutcome {
  return runRealScenario(
    "from qiskit import QuantumCircuit\nresult = QuantumCircuit(2,2)\nresult.h(0)\nresult.cx(0,1)\nresult.h(1)\nresult.h(1)\nresult.h(1)\nresult.h(1)\nresult.h(1)\nresult.h(1)\nresult.measure([0,1],[0,1])",
    shots,
  );
}

/** Persisted artifact shape (Phase 6 wrapper). */
export interface StoredArtifact {
  outcomes: Record<string, ScenarioOutcome>;
  environment?: unknown;
}
