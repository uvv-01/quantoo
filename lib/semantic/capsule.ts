/**
 * Quantum Execution Capsule (Phase 6).
 *
 * An exportable, versioned JSON artifact describing one execution: source,
 * canonical circuit, configuration, semantic record, environment, judge
 * result, and debugger trace. The capsule contains technical data only —
 * no secrets, no session data, no personal information beyond the
 * problem's public metadata and the user's own code.
 *
 * Security: a capsule is untrusted data. `validateExecutionCapsule`
 * (Zod, with hard depth/size limits) is the only sanctioned way to parse
 * one; importing never executes anything.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractSemanticRecord } from "@/lib/semantic/record";
import type { ExecutionCapsule } from "@/lib/semantic/types";

/** Current capsule schema version. */
export const CAPSULE_SCHEMA_VERSION = "quantoo.execution.v1" as const;

/** Hard byte cap on a serialized capsule (defense against oversized JSON). */
export const MAX_CAPSULE_BYTES = 2_000_000;

/** Maximum JSON nesting depth accepted when importing a capsule. */
const MAX_JSON_DEPTH = 24;

/**
 * Assemble a capsule from a submission row the caller has already
 * authorized (ownership checked by the API layer). Returns null when the
 * execution produced no comparable artifact (e.g. failed runs).
 */
export async function buildExecutionCapsule(submissionId: string): Promise<ExecutionCapsule | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: { select: { slug: true, title: true, difficulty: true } },
    },
  });
  if (!submission) return null;

  const artifact = submission.executionResult;
  if (!artifact || typeof artifact !== "object") return null;
  const stored = artifact as { outcomes?: unknown };

  const semanticRecord = extractSemanticRecord({
    submissionId: submission.id,
    userId: submission.userId,
    problemId: submission.problemId,
    sourceCode: submission.sourceCode,
    artifact,
  });

  const outcomes =
    stored.outcomes && typeof stored.outcomes === "object"
      ? (stored.outcomes as ExecutionCapsule["outcomes"])
      : {};

  const trace =
    outcomes.submission?.trace?.steps && outcomes.submission.trace.steps.length > 0
      ? outcomes.submission.trace.steps
      : null;

  const circuit = semanticRecord?.circuit ?? {
    ...fallbackCircuit(stored.outcomes),
    operations: null,
  };

  return {
    schemaVersion: CAPSULE_SCHEMA_VERSION,
    capsuleId: `cap_${submission.id}`,
    createdAt: new Date().toISOString(),
    submissionId: submission.id,
    problem: {
      slug: submission.problem.slug,
      title: submission.problem.title,
      difficulty: submission.problem.difficulty,
    },
    sourceCode: submission.sourceCode,
    execution: {
      status: submission.status,
      passed: submission.passed,
      durationMs: submission.durationMs,
      shots: semanticRecord?.shots ?? null,
      seed: semanticRecord?.seed ?? null,
    },
    circuit,
    outcomes,
    semanticRecord,
    judge: (submission.judgeResult as ExecutionCapsule["judge"]) ?? null,
    environment:
      semanticRecord?.environment ??
      {
        python: null,
        framework: { name: "unknown", version: null },
        simulator: { name: "unknown", version: null },
        dependencies: {},
        execution: { shots: null, seed: null, optimization: null },
      },
    backend: backendProvenance(artifact),
    trace,
  };
}

/**
 * Read backend provenance from a stored execution artifact. Unknown for
 * older artifacts (the field was added later); null is reported honestly
 * rather than defaulted to the local simulator.
 */
function backendProvenance(artifact: unknown): {
  backendId: string;
  environmentId: string | null;
} | null {
  if (!artifact || typeof artifact !== "object") return null;
  const backend = (artifact as { backend?: unknown }).backend;
  if (!backend || typeof backend !== "object") return null;
  const b = backend as { backendId?: unknown; environmentId?: unknown };
  if (typeof b.backendId !== "string" || b.backendId.length === 0 || b.backendId.length > 64) {
    return null;
  }
  return {
    backendId: b.backendId,
    environmentId: typeof b.environmentId === "string" ? b.environmentId : null,
  };
}

/** Pull circuit metadata out of a stored artifact for the fallback shape. */
function fallbackCircuit(outcomes: unknown): {
  qubits: number;
  clbits: number;
  depth: number;
  gateHistogram: Record<string, number>;
  totalOperations: number;
} {
  const outcome = (outcomes as Record<string, Record<string, unknown>> | undefined)?.[
    "submission"
  ];
  const circuit = outcome?.circuit as Record<string, unknown> | undefined;
  if (
    !circuit ||
    typeof circuit.qubits !== "number" ||
    typeof circuit.gateCounts !== "object" ||
    circuit.gateCounts === null
  ) {
    return { qubits: 0, clbits: 0, depth: 0, gateHistogram: {}, totalOperations: 0 };
  }
  return {
    qubits: circuit.qubits,
    clbits: typeof circuit.clbits === "number" ? circuit.clbits : 0,
    depth: typeof circuit.depth === "number" ? circuit.depth : 0,
    gateHistogram: circuit.gateCounts as Record<string, number>,
    totalOperations:
      typeof circuit.totalGates === "number" ? circuit.totalGates : 0,
  };
}

// ========================================
// Capsule validation (untrusted input path)
// ========================================

/** Serialize a capsule to JSON with a hard size cap. */
export function serializeCapsule(capsule: ExecutionCapsule): string {
  const json = JSON.stringify(capsule);
  if (Buffer.byteLength(json, "utf8") > MAX_CAPSULE_BYTES) {
    throw new Error("Capsule exceeds the maximum serialized size.");
  }
  return json;
}

/** Structural schemas for the numeric pair arrays used by the runtime. */
const pairsSchema = z.array(z.tuple([z.number(), z.number()])).max(4096);

const traceStepSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  operationIndex: z.number().int().nonnegative(),
  gateName: z.string().max(32),
  qubits: z.array(z.number().int().nonnegative()).max(64),
  clbits: z.array(z.number().int().nonnegative()).max(64),
  params: z.array(z.number()).max(8),
  measurement: z.boolean(),
  afterState: pairsSchema.optional(),
});

const scenarioOutcomeSchema = z.object({
  scenario: z.string().max(64).optional(),
  circuit: z
    .object({
      qubits: z.number().int().min(0).max(64),
      clbits: z.number().int().min(0).max(64),
      depth: z.number().int().min(0).max(1_000_000),
      gateCounts: z.record(z.string(), z.number().int().nonnegative()),
      totalGates: z.number().int().nonnegative(),
    })
    .optional(),
  counts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  shots: z.number().int().nonnegative().optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
  statevectorPairs: pairsSchema.optional(),
  globalPhase: z.number().optional(),
  trace: z
    .object({
      steps: z.array(traceStepSchema).max(2_000),
      policy: z.object({
        available: z.boolean(),
        representation: z.string().max(64),
        subsampled: z.boolean(),
        stride: z.number().int(),
        reason: z.string().max(500).nullable(),
      }),
    })
    .optional(),
});

/** Recursive depth guard for arbitrary nested JSON. */
function assertDepth(value: unknown, maxDepth: number, current = 0): void {
  if (current > maxDepth) {
    throw new Error("Capsule JSON exceeds the maximum nesting depth.");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertDepth(item, maxDepth, current + 1);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      assertDepth(item, maxDepth, current + 1);
    }
  }
}

/**
 * Validate an untrusted capsule JSON string. Returns the parsed capsule or
 * throws with a safe message. Validation is structural only: importing a
 * capsule never executes code and never fabricates missing evidence.
 */
export function validateExecutionCapsule(json: string): ExecutionCapsule {
  if (Buffer.byteLength(json, "utf8") > MAX_CAPSULE_BYTES) {
    throw new Error("Capsule is too large.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Capsule is not valid JSON.");
  }
  assertDepth(parsed, MAX_JSON_DEPTH);

  const schema = z.object({
    schemaVersion: z.literal("quantoo.execution.v1"),
    capsuleId: z.string().min(1).max(128),
    createdAt: z.string().max(64),
    submissionId: z.string().min(1).max(64),
    problem: z.object({
      slug: z.string().min(1).max(200),
      title: z.string().min(1).max(300),
      difficulty: z.string().min(1).max(32),
    }),
    sourceCode: z.string().max(100_000),
    execution: z.object({
      status: z.string().max(32),
      passed: z.boolean().nullable(),
      durationMs: z.number().int().nonnegative().nullable(),
      shots: z.number().int().nonnegative().nullable(),
      seed: z.number().int().nonnegative().nullable(),
    }),
    circuit: z.object({
      qubits: z.number().int().min(0).max(64),
      clbits: z.number().int().min(0).max(64),
      depth: z.number().int().min(0),
      operations: z
        .array(
          z.object({
            name: z.string().max(32),
            qubits: z.array(z.number().int().nonnegative()).max(64),
            clbits: z.array(z.number().int().nonnegative()).max(64),
            params: z.array(z.number()).max(8),
            measurement: z.boolean(),
          }),
        )
        .max(2_000)
        .nullable(),
      gateHistogram: z.record(z.string(), z.number().int().nonnegative()),
      totalOperations: z.number().int().nonnegative(),
    }),
    outcomes: z.record(z.string(), scenarioOutcomeSchema),
    semanticRecord: z.unknown().optional(),
    judge: z.unknown().optional(),
    environment: z.unknown().optional(),
    backend: z
      .object({
        backendId: z.string().min(1).max(64),
        environmentId: z.string().max(64).nullable(),
      })
      .nullable()
      .optional(),
    trace: z.array(traceStepSchema).max(2_000).nullable(),
  });

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Capsule structure is invalid.");
  }
  return result.data as ExecutionCapsule;
}
