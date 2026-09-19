# Quantum Compatibility & Reproducibility Lab

Phase 7. The lab turns the Phase 6 semantic infrastructure into an answer
to a deeper engineering question:

> Does this quantum program continue to behave the same when its execution
> environment changes?

This document explains the concepts, what Quantoo actually proves, and —
just as importantly — what it does not.

---

## What is quantum compatibility?

Compatibility does **not** mean package versions match. A program is
**compatible** with an environment when its *tested semantic behavior*
stays within the selected comparison policy after being executed there.

Two environments can have entirely different Qiskit versions and still be
behaviorally compatible for a given program — and identical versions do
not guarantee compatible behavior if transpilation or configuration
changed. Quantoo therefore compares behavior, not package names.

## What is behavioral compatibility?

A verdict computed from real execution evidence:

```text
COMPATIBLE                          behavior agrees under the policy
COMPATIBLE_WITH_RESOURCE_CHANGE     behavior agrees; depth/gates changed
BEHAVIORALLY_DIFFERENT              at least one behavioral dimension differs
EXECUTION_FAILED                    the candidate environment could not run the program
INSUFFICIENT_EVIDENCE               no comparable behavioral data (say so, never guess)
```

Structural change alone is never a behavioral regression: a circuit with
two extra cancelling gates that produces the same distribution is
`COMPATIBLE_WITH_RESOURCE_CHANGE`, not "different".

## What is an environment profile?

A **profile** is a controlled, explicitly provisioned execution
environment, declared in code (`lib/compat/environments.ts`):

```text
id            stable identifier recorded on every run
name          human-readable, with concrete versions (never "latest")
image         the vetted runtime image used for execution
```

Users can *select* profiles; they can never define new ones, name images,
install packages, or fetch dependencies. Profile ids are immutable once
used: changing what a profile means requires a new id, so stored evidence
always describes exactly what ran.

Availability is **measured**, not assumed. The registry probes the actual
runtime and reports `AVAILABLE` / `UNAVAILABLE` (with the measured
reason). An environment is never shown as usable unless it actually is.

## What is a compatibility policy?

A named, explicit rule set for what counts as a meaningful difference
(reusing the Phase 6 policies):

```text
statistical-default   Hellinger distance ≤ 0.05 on sampled distributions,
                      minimum 1024 shots, structure/state/resources/environment
                      compared with separate verdicts
exact                 total variation ≤ 0.01, tighter evidence requirements
```

Policies make every verdict reproducible: the same evidence plus the same
policy always yields the same status.

## What is reproducibility?

An execution is `REPRODUCED` only when **all** of the following hold:

1. the re-execution succeeded (through the standard sandboxed pipeline),
2. the recorded source and configuration were reconstructed, and
3. the behavior comparison passed under the policy.

A successful run alone is never "reproduced". The Phase 7 reproduction
report adds an explicit `ENVIRONMENT` check: reproducing through a
different runtime is visible as `ENVIRONMENT DIFFERENT` even when behavior
agrees — and that still does not by itself fail the reproduction verdict;
behavior remains the deciding evidence.

## What is an experiment?

A `CompatibilityExperiment` records one program, one baseline execution,
and a matrix of candidate environments:

```text
baseline program (from the user's own saved execution)
        ↓
same source + shared shots/seed (one server-generated seed)
        ↓
run in each candidate environment via the sandbox
        ↓
semantic comparison per candidate
        ↓
per-candidate report + overall status, stored as evidence
```

Run cells carry their own status (`SUCCEEDED`, `FAILED`, `TIMED_OUT`,
`RESOURCE_LIMIT`) and reference the created executions — never duplicated
payloads.

## Export and import

`GET /api/compatibility/experiments/[id]/export` returns a versioned
package (`quantoo.experiment.v1`): source, baseline capsule,
configuration, and the latest report. Technical data only — no secrets,
no session data.

Import treats the package as **untrusted input**: only the documented
schema version is accepted, source size is bounded, candidate environment
ids are filtered against the *local* registry (unknown ids are skipped,
never fetched), and the imported program executes only later, only inside
the sandbox. No field is ever interpreted as a command, path, or
dependency instruction. The embedded capsule/report are history, not
instructions.

## What does Quantoo actually prove?

With sufficient evidence, Quantoo can state:

- the program's **tested behavior** was statistically indistinguishable
  (or distinguishable) between two environments, under the selected
  policy and threshold, for the tested shots and seed;
- where the **first observed divergence** is in the execution trace;
- which environment components changed (recorded versions).

## What does Quantoo NOT prove?

- **Mathematical equivalence for all inputs.** A finite sampled comparison
  supports only "behavior was compatible under the tested configuration
  and policy" — never universal equivalence.
- **Root cause.** Divergence locations are "first observed divergence",
  not established causation.
- **Version safety in general.** One compatible program does not certify
  a framework version; it certifies one program against one environment
  under one policy.
- **Reproducibility from success.** A run that merely completes proves
  nothing; only the evidence comparison does.

Where evidence is missing — no artifact, no comparable record, an
unavailable environment — Quantoo reports `INSUFFICIENT EVIDENCE` or
`UNAVAILABLE` with a reason. It never invents a verdict.

## Why can two circuits differ structurally but remain compatible?

Because behavior, not structure, is the compatibility contract. `H + CX`
and `Ry(π/2) + CX` differ in gate vocabulary and operation count while
producing the same state; the lab reports the structural change as a
resource/structure note and the behavior as compatible. Conversely,
structurally near-identical circuits (`H` vs `X`) are behaviorally
different — structure alone would have hidden it.
