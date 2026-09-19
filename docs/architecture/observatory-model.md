# The Quantoo Observatory Model

Quantoo is infrastructure for building, executing, understanding,
comparing, reproducing, and preserving the behavior of quantum software.
This document explains the objects that make that possible and how they
relate to each other.

The full lifecycle:

```text
LEARN → BUILD → EXECUTE → TEST → FAIL → DEBUG
  → UNDERSTAND → MEASURE → COMPARE → CHECK COMPATIBILITY
  → REPRODUCE → VERIFY → PRESERVE EVIDENCE → PUBLISH
```

---

## Core objects

### Submission and execution artifact

A **Submission** is one attempt to run a quantum program. It persists the
source code, judge verdict, and an **execution artifact** — the JSON
record of what actually happened: per-scenario outcomes (circuit
metadata, counts, exact probabilities, statevector snapshots, gate
trace), the runtime-reported environment, and (since Phase 8) the
**backend provenance** identifying which execution backend and
controlled runtime environment produced it. Every higher-level object is
derived from this evidence; nothing is asserted without it.

### Semantic record and fingerprint

A **semantic record** (Phase 6) is extracted from an execution artifact:
canonical circuit, exact probability distributions, measurement
frequencies, resource usage, and the environment fingerprint. Its
**semantic fingerprint** layers structural, operational, probability,
measurement, resource, and environment hashes into independently
inspectable digests. Fingerprints describe *behavior*, never source text.

### Comparison and compatibility

Two records compared under an explicit policy produce a **semantic
comparison**: per-dimension verdicts with statistical evidence
(TV distance, Hellinger distance, shot-count awareness) and a
first-divergence pointer into the debugger.

The Phase 7 **compatibility experiment** asks the wider question — does
behavior survive an environment change? One program executes in a
baseline and in controlled candidate environments (code-defined, pinned
runtime images). The **compatibility report**
(`quantoo.compatibility.v1`) grades each candidate per dimension
(STRUCTURE / PROBABILITY / MEASUREMENT / BEHAVIOR / RESOURCE /
ENVIRONMENT) with honest overall statuses such as COMPATIBLE or
BEHAVIORALLY_DIFFERENT.

### Execution capsule

A **capsule** (`quantoo.execution.v1`) is the exportable, versioned
snapshot of one execution: source, canonical circuit, configuration,
semantic record, judge result, trace, environment, and backend
provenance. Capsules are untrusted data on import: validation is
structural (schema, size, depth caps) and importing never executes
anything.

### Reproduction report

A **reproduction** re-executes recorded source with the recorded
shots/seed through the standard sandboxed pipeline and compares the new
evidence against the original. The report states what matched, what
differed, where the first divergence is, and which environment each side
used — a run in a different environment is never silently labeled a
full reproduction.

### Research artifact

A **research artifact** (`quantoo.artifact.v1`, Phase 8) preserves
provenance across all of the above. Assembled from a compatibility
experiment, it freezes the capsules, the compatibility report, and any
reproduction reports at publish time, so it remains interpretable even
if original rows are deleted. Artifacts are:

- **Versioned** — published versions are immutable; changes create v2,
  v3, …
- **Integrity-checked** — each version carries a sha-256 hash over its
  canonical JSON; the export envelope carries a tamper-evident
  document hash
- **Visibility-controlled** — PRIVATE by default; publishing is an
  explicit user action, and importing never executes code

### Benchmarks

A **benchmark** is a canonical program in a versioned corpus (state
preparation, entanglement, measurement, noise sensitivity). A benchmark
**run** executes through the standard pipeline and persists a full
semantic record; **comparison** classifies correctness, behavioral, and
resource regressions between runs. The corpus is infrastructure for real
measurements — no results exist until a real execution produces them.

### Projects

A **project** is a user-organized evidence container. Items reference
real problems, executions, compatibility experiments, and research
artifacts; ownership of every referenced private resource is enforced
server-side. Projects reference evidence — they never fabricate
achievements.

### Hardware backends

The **backend registry** (Phase 8) defines the provider-independent
execution-target contract: capabilities, measured availability, circuit
validation, and job lifecycle. The one registered backend today is the
platform's sandboxed Aer simulator, labeled `LOCAL_SIMULATOR` — never
quantum hardware. Remote simulators and QPUs plug into the same
contract when a real integration exists; availability is always
measured, never configured.

---

## How the objects connect

```text
        SUBMISSION (execution artifact)
                │
        ┌───────┴────────┐
        ▼                ▼
  SEMANTIC RECORD   EXECUTION CAPSULE
        │                │
        ▼                │
  SEMANTIC COMPARISON    │
        │                │
        ▼                ▼
  COMPATIBILITY EXPERIMENT ── REPORT
        │
        ▼
  REPRODUCTION REPORT
        │
        ▼
  RESEARCH ARTIFACT (versioned, hashed, exportable)
        │
        ▼
  PROJECT / PUBLIC OBSERVATORY
```

## Evidence-first principle

Every technical statement the platform displays is traceable to
persisted execution evidence. Where evidence is missing — an unknown
environment, an unprobed backend, an insufficient shot count — Quantoo
reports "unknown", "unavailable", or "insufficient evidence" rather
than a plausible guess.
