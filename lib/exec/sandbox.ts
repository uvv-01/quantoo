/**
 * Sandbox boundary for untrusted quantum code execution.
 *
 * User submissions are executed in a dedicated Docker container running the
 * quantum runtime image. The boundary is responsible for:
 *
 *  - building the container with CPU/memory caps and no network access
 *  - writing the execution request to the container's stdin
 *  - enforcing the wall-clock timeout and output caps
 *  - classifying failures into safe error codes
 *
 * The web application never executes user code in-process. This module is
 * the only place that talks to the sandbox runtime.
 *
 * Fallback mode: when Docker is not available (e.g. local development
 * without Docker), the sandbox can optionally delegate to the host Python
 * interpreter running the same runner with a restricted environment. This
 * keeps the platform usable locally while production deploys use containers.
 * The fallback must be explicitly enabled via QUANTOO_SANDBOX_MODE and is
 * never used implicitly.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { logger } from "@/lib/logger";
import { getExecutionLimits } from "@/lib/exec/limits";
import type { ExecutionLimits } from "@/lib/exec/types";
import type {
  ExecutionErrorCode,
  SandboxResult,
} from "@/lib/exec/types";

/** How the sandbox executes submissions. */
export type SandboxMode = "docker" | "host-fallback" | "disabled";

/** Resolve the configured sandbox mode. */
export function getSandboxMode(): SandboxMode {
  const raw = process.env.QUANTOO_SANDBOX_MODE;
  if (raw === "host-fallback" || raw === "disabled") return raw;
  return "docker";
}

/** Name of the runtime image built from services/quantum-runtime. */
export const RUNTIME_IMAGE = "quantoo/quantum-runtime:latest";

/** Name of the dedicated Docker network with no external connectivity. */
const SANDBOX_NETWORK = "quantoo-sandbox";

const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // safety cap on runtime payload

/**
 * Execute a submission in the sandbox.
 *
 * @param sourceCode - user's Python source (already size-validated)
 * @param scenarios  - scenario names the judge requires (e.g. zero_state)
 * @param shots      - measurement shots (already validated against limits)
 * @param limits     - effective execution limits
 */
export async function executeInSandbox(
  sourceCode: string,
  scenarios: string[],
  shots: number,
  limits = getExecutionLimits(),
  inspect: string[] = ["density_matrix", "unitary"],
  /** Optional deterministic seed for sampled measurements (reproduction). */
  seed?: number,
): Promise<SandboxResult> {
  const mode = getSandboxMode();
  if (mode === "disabled") {
    return sandboxFailure("SANDBOX_ERROR", "The execution sandbox is disabled.");
  }
  const started = Date.now();
  try {
    const result =
      mode === "docker"
        ? await runDocker(sourceCode, scenarios, shots, limits, inspect, seed)
        : await runHostFallback(sourceCode, scenarios, shots, limits, inspect, seed);
    return { ...result, durationMs: Date.now() - started };
  } catch (error) {
    logger.error("sandbox execution failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    const { code, message } = classifySandboxError(error, limits.maxRuntimeMs);
    return { ...emptyFailure(code, message), durationMs: Date.now() - started };
  }
}

// ========================================
// Docker execution
// ========================================

async function runDocker(
  sourceCode: string,
  scenarios: string[],
  shots: number,
  limits: ExecutionLimitsParam,
  inspect: string[],
  seed?: number,
): Promise<Omit<SandboxResult, "durationMs">> {
  const payload = JSON.stringify({
    sourceCode,
    scenarios: scenarios.map((name) => ({ name })),
    shots,
    inspect,
    seed: typeof seed === "number" && Number.isInteger(seed) && seed >= 0 ? seed : undefined,
    maxSnapshotSteps: limits.maxSnapshotSteps,
    maxDensityQubits: limits.maxDensityQubits,
    maxUnitaryQubits: limits.maxUnitaryQubits,
  });
  // The request is attached to the container's stdin (-i); the runtime
  // emits exactly one JSON result line on stdout.
  const args = [
    "run",
    "--rm",
    "-i",
    "--network", SANDBOX_NETWORK,
    "--cpus", "1",
    "--memory", `${limits.maxMemoryMb}m`,
    "--pids-limit", "128",
    "--read-only",
    "--security-opt", "no-new-privileges",
    "--cap-drop", "ALL",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
    "-e", "PYTHONUNBUFFERED=1",
    RUNTIME_IMAGE,
  ];
  const tmp = await mkdtemp(path.join(tmpdir(), "quantoo-exec-"));
  const reqPath = path.join(tmp, "request.json");
  try {
    await writeFile(reqPath, payload, "utf8");
    return await spawnWithLimits("docker", args, payload, limits, "SANDBOX_ERROR", {
      stdinFilePath: reqPath,
    });
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ========================================
// Host fallback (explicitly enabled, non-production)
// ========================================

async function runHostFallback(
  sourceCode: string,
  scenarios: string[],
  shots: number,
  limits: ExecutionLimitsParam,
  inspect: string[],
  seed?: number,
): Promise<Omit<SandboxResult, "durationMs">> {
  const payload = JSON.stringify({
    sourceCode,
    scenarios: scenarios.map((name) => ({ name })),
    shots,
    inspect,
    seed: typeof seed === "number" && Number.isInteger(seed) && seed >= 0 ? seed : undefined,
    maxSnapshotSteps: limits.maxSnapshotSteps,
    maxDensityQubits: limits.maxDensityQubits,
    maxUnitaryQubits: limits.maxUnitaryQubits,
  });
  const args = [
    "-I", // isolated mode: ignore user site-packages
    "-B", // don't write bytecode
    "services/quantum-runtime/runner.py",
  ];
  // Explicit minimal environment for the runtime process: PATH for the
  // interpreter, no application secrets, no database URLs, nothing else.
  const childEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    PYTHONUNBUFFERED: "1",
    HOME: tmpdir(),
    SYSTEMROOT: process.env.SYSTEMROOT ?? "", // required on Windows
    COMSPEC: process.env.COMSPEC ?? "", // subprocess resolution on Windows
  };
  return spawnWithLimits(
    "python",
    args,
    payload,
    limits,
    "SANDBOX_ERROR",
    childEnv,
  );
}

// ========================================
// Process plumbing shared by both modes
// ========================================

type ExecutionLimitsParam = ExecutionLimits;

interface SpawnOptions {
  extraEnv?: Record<string, string>;
  /**
   * Provide the child's stdin from this file instead of a pipe. The
   * Docker CLI does not reliably forward a Node pipe to the container's
   * stdin on Windows, so the docker mode writes the request to a temp
   * file and hands the file descriptor to the process.
   */
  stdinFilePath?: string;
}

async function spawnWithLimits(
  command: string,
  args: string[],
  payload: string,
  limits: ExecutionLimitsParam,
  sandboxErrorCode: ExecutionErrorCode,
  options: SpawnOptions = {},
): Promise<Omit<SandboxResult, "durationMs">> {
  return new Promise((resolve) => {
    const stdinFd =
      options.stdinFilePath !== undefined
        ? openSync(options.stdinFilePath, "r")
        : null;
    const child: ChildProcess = spawn(command, args, {
      stdio: [stdinFd !== null ? stdinFd : "pipe", "pipe", "pipe"],
      env: options.extraEnv
        ? ({ ...options.extraEnv } as NodeJS.ProcessEnv)
        : process.env,
      windowsHide: true,
    });

    let stdoutText = "";
    let stderrText = "";
    let stdoutBytes = 0;
    let outputTruncated = false;
    let timedOut = false;
    let settled = false;

    const cap = Math.max(limits.maxOutputBytes, MAX_PAYLOAD_BYTES);

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, limits.maxRuntimeMs);

    const finish = (result: Omit<SandboxResult, "durationMs">) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      if (stdinFd !== null) {
        try {
          closeSync(stdinFd);
        } catch {
          // Already closed.
        }
      }
      resolve(result);
    };

    const stdout = child.stdout;
    const stderr = child.stderr;
    const stdin = child.stdin;
    if (!stdout || !stderr || (stdinFd === null && !stdin)) {
      finish(
        emptyFailure(
          sandboxErrorCode,
          "The execution sandbox could not be started.",
        ),
      );
      return;
    }

    stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > cap) {
        outputTruncated = true;
        child.kill("SIGKILL");
        return;
      }
      stdoutText += chunk.toString("utf8");
    });

    stderr.on("data", (chunk: Buffer) => {
      // Cap stderr as well; server-side logs get a truncated view only.
      if (stderrText.length < 8_000) {
        stderrText += chunk.toString("utf8");
      }
    });

    child.on("error", (error: Error) => {
      logger.error("sandbox spawn failed", {
        error: error.message,
      });
      finish(
        emptyFailure(
          sandboxErrorCode,
          "The execution sandbox could not be started.",
        ),
      );
    });

    child.on("close", (code, signal) => {
      if (timedOut) {
        finish(emptyFailure("TIMEOUT", "The execution timed out."));
        return;
      }
      if (outputTruncated) {
        finish(
          emptyFailure(
            "OUTPUT_LIMIT",
            "The execution output exceeded the allowed size.",
          ),
        );
        return;
      }
      if (signal) {
        finish(
          emptyFailure(
            sandboxErrorCode,
            "The execution was terminated by the sandbox.",
          ),
        );
        return;
      }
      if (code !== 0) {
        logger.error("sandbox exited nonzero", {
          exitCode: code,
          stderrTail: stderrText.slice(-500),
        });
        finish(
          emptyFailure(
            sandboxErrorCode,
            "The execution sandbox failed unexpectedly.",
          ),
        );
        return;
      }
      const parsed = parseRuntimePayload(stdoutText);
      if (!parsed) {
        finish(
          emptyFailure(
            "SIMULATOR_ERROR",
            "The runtime returned an unreadable result.",
          ),
        );
        return;
      }
      finish(parsed);
    });

    if (stdinFd === null && stdin) {
      stdin.on("error", () => {
        // The runtime may exit before reading all input; the close handler
        // will resolve the result.
      });
      stdin.write(payload);
      stdin.end();
    }
  });
}

function parseRuntimePayload(stdout: string): Omit<SandboxResult, "durationMs"> | null {
  // The runtime emits exactly one JSON line on stdout.
  const line = stdout.split("\n").find((l) => l.trim().startsWith("{"));
  if (!line) return null;
  try {
    const payload = JSON.parse(line) as Record<string, unknown>;
    if (payload.ok === true && payload.outcomes && typeof payload.outcomes === "object") {
      return {
        ok: true,
        outcomes: payload.outcomes as SandboxResult["outcomes"],
        environment: parseEnvironment(payload.environment),
        stdout: typeof payload.stdout === "string" ? payload.stdout : "",
        stderr: "",
      };
    }
    if (payload.ok === false && payload.error) {
      const err = payload.error as { code?: string; message?: string };
      return emptyFailure(
        (err.code as ExecutionErrorCode) ?? "RUNTIME_ERROR",
        err.message ?? "The execution failed.",
      );
    }
    return null;
  } catch {
    return null;
  }
}

function parseEnvironment(raw: unknown): SandboxResult["environment"] {
  if (!raw || typeof raw !== "object") return undefined;
  const env = raw as Record<string, unknown>;
  const str = (value: unknown): string | null =>
    typeof value === "string" && value.length <= 64 ? value : null;
  const component = (value: unknown): { name: string; version: string | null } => {
    if (!value || typeof value !== "object") return { name: "unknown", version: null };
    const c = value as Record<string, unknown>;
    return {
      name: str(c.name) ?? "unknown",
      version: str(c.version),
    };
  };
  return {
    python: str(env.python),
    framework: component(env.framework),
    simulator: component(env.simulator),
    numpy: str(env.numpy),
  };
}

function emptyFailure(
  code: ExecutionErrorCode,
  message: string,
): Omit<SandboxResult, "durationMs"> {
  return {
    ok: false,
    outcomes: {},
    stdout: "",
    stderr: "",
    error: { code, message },
  };
}

function sandboxFailure(
  code: ExecutionErrorCode,
  message: string,
): SandboxResult {
  return { ...emptyFailure(code, message), durationMs: 0 };
}

function classifySandboxError(
  error: unknown,
  runtimeMs: number,
): { code: ExecutionErrorCode; message: string } {
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "TIMEOUT", message: "The execution timed out." };
  }
  void runtimeMs;
  return {
    code: "SANDBOX_ERROR",
    message: "The execution sandbox failed unexpectedly.",
  };
}