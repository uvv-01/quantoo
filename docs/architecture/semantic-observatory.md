# Quantum Semantic Observatory

Phase 6 foundation. The observatory treats a quantum program as an
observable **behavior** that can be extracted from a real execution,
fingerprinted, compared under an explicit policy, and reproduced — so the
central question becomes answerable with evidence:

> Does this quantum program still mean the same thing when something
> around it changes?

This document explains the concepts, what Quantoo actually compares, and
— just as important — what it does **not** claim.

---

## What is semantic equivalence?

Two executions are *semantically equivalent* (in Quantoo's usage:
**observationally equivalent under a policy**) when their recorded
observable behavior agrees within the comparison policy's explicit
thresholds. Equivalence is always tied to a policy and to the evidence an
execution actually produced.

Equivalence is **not** decided by source text. These produce the same
Bell state and are behaviorally equivalent even though the code differs:

```python
result = QuantumCircuit(2, 2)
result.h(0)
result.cx(0, 1)
```

```python
result = QuantumCircuit(2, 2)
result.ry(1.5707963267948966, 0)
result.cx(0, 1)
```

Textual source equality is recorded only as an identity fingerprint
(`sourceFingerprint`) and is never the comparison basis.

### What Quantoo can and cannot prove

- Quantoo compares **observed behavior of executed circuits** on the
  recorded scenarios and shots. It does **not** verify behavior for every
  possible input state.
- Equivalence under one test distribution does **not** imply
  mathematical equivalence for all inputs. Two circuits can agree on
  every scenario Quantoo executed and still differ elsewhere.
- Quantoo is **not** a formal verification tool. The words "formally
  verified" or "mathematically equivalent" are never produced by this
  system.

## What is a semantic fingerprint?

A `SemanticFingerprint` is a deterministic, layered hash over normalized
observable information — deliberately not a hash of the source:

| Layer | Content | Available when |
| --- | --- | --- |
| `structural` | qubits, clbits, depth, normalized gate histogram | always |
| `operational` | ordered canonical operations | the artifact carries a gate trace |
| `probability` | exact computational-basis probabilities | measurement-free circuits |
| `measurement` | sampled frequencies (fixed rounding) | measured circuits |
| `resource` | depth, operation count | always |
| `environment` | safe environment/configuration record | always (versions may be unknown) |
| `combined` | hash over every available layer | always |

Layers stay independently inspectable so a user can see *which kind* of
identity holds (structural, behavioral, resource, environment) rather
than one opaque hash. Hashing is stable across JSON key order
(`lib/semantic/canonical.ts`, `lib/semantic/fingerprint.ts`).

## What is behavioral equivalence?

**Behavioral equivalence** is the verdict when every compared behavioral
dimension (state, exact probabilities, sampled measurements) agrees
within the policy, regardless of structural differences. Circuit
structure is reported separately — a behaviorally equivalent circuit with
a different gate multiset is exactly the interesting case the observatory
exists to expose.

## What is statistical equivalence?

Quantum measurement is probabilistic. Two *identical* programs sampled
twice rarely produce identical counts, so sampled distributions are
compared with explicit metrics and thresholds, never raw equality:

- **Total variation distance** — `(1/2)·Σ|pᵢ−qᵢ|`, range [0, 1].
- **Hellinger distance** — `(1/√2)·√Σ(√pᵢ−√qᵢ)²`, range [0, 1].

A comparison records `metric`, `value`, `threshold`, `pass`, and the
support size. The default policy (`statistical-default`) uses Hellinger
distance with threshold 0.05 and flags comparisons below 1024 shots as
weaker evidence in `limitations`. The `exact` policy uses total variation
with a 0.01 threshold.

Verdict wording is deliberate:

- "statistically indistinguishable under policy X" — sampled data agreed
- "observationally equivalent under policy X" — overall verdict
- "first observed divergence" — never "root cause"; causality requires a
  causal experiment, which Phase 6 does not run

## Global phase

Global phase is physically unobservable. State comparison is
global-phase invariant (cosine similarity over amplitude vectors, reused
from the Phase 5 Quantum Diff layer), so two states differing only by a
global phase are reported as agreeing, while relative-phase or amplitude
differences are reported as different. The distinction between
*global-phase-equivalent* and *observable-behavior-different* is
preserved end to end.

## What is reproducibility?

An execution is **reproduced** only when *all* of the following hold:

1. the reproduction run succeeded in the sandbox,
2. the recorded configuration was reconstructed (same source from the
   database, same recorded shots and seed when available), and
3. the behavior comparison between the original and the new semantic
   record passed under the policy.

A successful run alone is never "reproduced" — the evidence comparison is
the point. When the original recorded no seed, the report says so and the
sampled comparison is statistical. When no behavioral data exists at all,
the verdict is `INSUFFICIENT_EVIDENCE`, not a pass.

## What is a quantum execution capsule?

An `ExecutionCapsule` (`quantoo.execution.v1`) is an exportable JSON
artifact of one execution: source, canonical circuit, execution
configuration, semantic record, environment fingerprint, judge result,
and debugger trace. It contains technical data only — no secrets, no
session data, no other users' information.

Capsules are **untrusted input** when imported: `validateExecutionCapsule`
enforces the schema version, size caps (2 MB), nesting-depth limits, and
field bounds via Zod. Importing never executes code.

## What does Quantoo compare?

Given two of a user's executions, the comparison engine evaluates each
dimension independently and links every conclusion to its evidence:

```text
STRUCTURE     ordered operations (when traces exist) or gate multiset
STATE         final statevector, global-phase invariant
PROBABILITY   exact basis probabilities (measurement-free circuits)
MEASUREMENT   sampled frequencies under the policy's metric/threshold
RESOURCE      depth / operation deltas — a WARNING, never a correctness failure
ENVIRONMENT   framework, simulator, Python, NumPy, shots, seed
```

The overall verdict distinguishes:

```text
EQUIVALENT               structure and behavior evidence agree
BEHAVIORALLY_EQUIVALENT  behavior agrees, structure differs
STRUCTURALLY_EQUIVALENT  structure agrees, no behavioral evidence
RESOURCE_REGRESSION      behavior agrees, resources grew
ENVIRONMENT_DIFFERENT    behavior agrees, environment/config differs
DIFFERENT                a behavioral dimension exceeds tolerance
INSUFFICIENT_EVIDENCE    no comparable behavioral data
```

Correctness, performance, and environment are always separate
dimensions: resource growth is classified as a resource change, not a
failure.

Where traces exist on both sides, the comparison reports the **first
observed divergence** step, and the UI links directly into the Phase 5
debugger at that step ("Inspect at divergence").

## Execution environment record

Every execution records safe metadata from inside the runtime: Python,
Qiskit, Aer, and NumPy versions, plus shots and seed. Nothing sensitive
is captured — no tokens, cookies, environment variables, or paths.
Missing components are `null`, never guessed.

## Scaling limits

The exponential constraints carry over unchanged from Phase 5: exact
probabilities persist only for statevectors within the storage caps,
traces are subsampled per the snapshot policy, and semantic analysis
never bypasses execution limits. Large circuits produce records with
explicit `null` layers rather than dangerous computations.

## Architecture and data flow

```text
Execution (sandboxed pipeline)
      ↓
Execution artifact (persisted on Submission)
      ↓
Semantic extraction (lib/semantic/record.ts)
      ↓
Semantic record + layered fingerprint
      ↓
Comparison under policy (lib/semantic/compare.ts)
      ↓
Structured verdict + evidence (SemanticDifference[])
      ↓
Evidence history (SemanticComparison table) / reproduction report
```

API namespace: `/api/semantic/executions`, `/api/semantic/compare`,
`/api/semantic/reproduce`, `/api/semantic/capsules`,
`/api/semantic/baselines`. All endpoints require authentication, verify
ownership, validate input with Zod, and recompute every verdict
server-side. Client-provided verdicts are never trusted.

UI: the Semantic Observer lives inside the problem workspace (rendered
below the execution results) so the debugger and the observatory share
one surface.

## Phase boundary

Phase 6 is the foundation. The cross-version execution farm, dependency
migration, cross-framework (Qiskit ↔ Cirq ↔ PennyLane) execution, cloud
QPU orchestration, public semantic databases, and ecosystem-scale
telemetry are later phases. The abstractions here (policies, environment
fingerprints, capsules, layered fingerprints) are designed for those
extensions without breaking existing records.
