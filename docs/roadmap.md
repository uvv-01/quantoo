# Quantoo — Development Roadmap

## Phase 1: Foundation ✅

- [x] Next.js application with TypeScript strict mode
- [x] Tailwind CSS with design tokens
- [x] Component library (Button, Card, Badge, Alert, Skeleton)
- [x] Prisma database schema
- [x] Environment validation (Zod)
- [x] Structured logging
- [x] Health check API
- [x] Error handling, loading states, empty states
- [x] Responsive layout
- [x] Accessibility foundation
- [x] CI pipeline
- [x] Unit tests
- [x] Documentation

## Phase 2: Authentication & Security ✅

- [x] Custom authentication system (bcrypt, HTTP-only cookies)
- [x] Email/password registration with validation
- [x] Email verification with cryptographically random tokens
- [x] Login/logout with secure session management
- [x] Password reset flow (forgot password → email → reset)
- [x] Password change in settings (requires current password)
- [x] Rate limiting on all auth endpoints
- [x] Security event audit logging
- [x] Enumeration protection (generic error messages)
- [x] Protected route middleware
- [x] Auth-aware UI (header, settings/security)
- [ ] Multi-factor authentication (TOTP)
- [ ] Passkey support (WebAuthn)
- [ ] Account lockout (progressive delays)

## Phase 3: Problem & Content Engine ✅

- [x] Enhanced Prisma schema (Concepts, Tags, Learning Topics, Relations, Test Specs)
- [x] Problem discovery page with search, difficulty/concept/tag filtering, pagination
- [x] Problem detail page (description, objectives, requirements, hints, outcomes)
- [x] Learning topics page with concept coverage
- [x] Topic detail page with ordered problem lists
- [x] RESTful API endpoints (problems, topics, progress)
- [x] Progress tracking system (start, attempt, solve)
- [x] 5 high-quality seed problems with educational content
- [x] Quantum concept taxonomy (10 concepts, 4 categories)
- [x] Problem relation system (prerequisite, next, related)
- [x] Test specification architecture for future Judge
- [x] 198 unit tests across 19 test files
- [ ] Problem creation and management (admin tools)
- [ ] Problem versioning (content revisions)
- [ ] Daily challenge system
- [ ] Content authoring tools (admin UI)

## Phase 4: Code Workspace + Execution + Judge

- [x] Code editor integration (CodeMirror 6 with Python language support)
- [x] Quantum execution sandbox (Docker container per run, no network, capped resources)
- [x] Python runtime (Qiskit + Qiskit Aer) with scenario variants
- [x] Execution artifact generation (persisted Submission with structured results)
- [x] Quantum Judge evaluation engine (STATE, DISTRIBUTION, STRUCTURAL, ENTANGLEMENT)
- [x] Resource metrics (qubits, depth, gate counts, shots, wall clock)
- [x] Code persistence (drafts with autosave) and submission history foundation
- [ ] Multi-layer assessment beyond the four implemented check types (UNITARY, OBSERVABLE, … — reported as SKIPPED)
- [ ] Execution queue for concurrent runs (currently inline with a wall-clock ceiling)

## Phase 5: Quantum Debugger (delivered)

- [x] Step forward / backward (Quantum Time Machine: first/prev/next/last,
  scrubber, play/pause, reset)
- [x] Gate trace timeline
- [x] State snapshot inspection (exact statevector; partial traces labeled)
- [x] Amplitude / probability / phase inspector (global-phase aware)
- [x] Probability distribution visualization (exact vs sampled clearly
  distinguished)
- [x] Reference vs. student comparison (Quantum Diff foundation:
  STRUCTURE / STATE / PROBABILITY / MEASUREMENT / RESOURCE)
- [x] Failure localization ("Failure observed after step N.", evidence-based)
- [x] Circuit view with executed/upcoming operations and accessible current
  step indicators
- [x] Density matrix and unitary inspection with strict size limits
- [ ] Breakpoint support (deferred — Phase 5 steps through recorded traces;
  interactive breakpoints belong to a later phase)
- [ ] Bloch sphere rendering (deferred)

## Phase 6: Quantum Semantic Observatory (delivered)

- [x] Semantic record extraction from persisted execution artifacts
  (probabilities, measurements, statevector evidence, canonical circuit)
- [x] Layered semantic fingerprint (structural / operational / probability /
  measurement / resource / environment / combined — independently
  inspectable, never source-text hashing)
- [x] Canonical circuit representation with gate-name normalization;
  operations never reordered (order is semantically significant)
- [x] Statistical comparison (total variation & Hellinger distance with
  configurable thresholds, shot-count awareness, weak-evidence notes)
- [x] Comparison policies (statistical-default, exact) with per-dimension
  inclusion and explicit NOT_COMPARED semantics
- [x] Structured evidence-linked verdicts (EQUIVALENT,
  BEHAVIORALLY_EQUIVALENT, RESOURCE_REGRESSION, ENVIRONMENT_DIFFERENT,
  DIFFERENT, INSUFFICIENT_EVIDENCE) — global-phase preserved from Phase 5
- [x] First observed divergence localization with debugger deep link
  ("Inspect at divergence")
- [x] Regression baselines per user/problem with policy-bound comparisons
- [x] Execution reproduction through the standard sandboxed pipeline
  (recorded source/shots/seed; evidence comparison required — a
  successful run alone is never "reproduced")
- [x] Versioned execution capsules (quantoo.execution.v1) with export and
  defensive validation (size/depth/schema caps; import never executes)
- [x] Environment record from the runtime (Python/Qiskit/Aer/NumPy,
  shots, seed) — safe metadata only, nulls never guessed
- [x] Semantic API namespace (/api/semantic/*) with auth, ownership,
  Zod validation, rate limits, and server-side verdict recomputation
- [x] Semantic Observer UI inside the workspace with baseline and
  reproduction controls and capsule export
- [ ] Cross-framework execution (Phase 7+; abstraction ready)
- [ ] Noise-aware semantic analysis (later phase)

## Phase 7: Quantum Compatibility & Reproducibility Lab (delivered)

- [x] Controlled environment registry (lib/compat/environments.ts):
  code-declared profiles with concrete versioned names (never "latest"),
  measured availability probing (docker image inspect with TTL cache),
  and honest UNAVAILABLE reporting — users select profiles, never define,
  install, or fetch them
- [x] Controlled legacy runtime image (qiskit 1.1.2 / qiskit-aer 0.14.2 /
  numpy 1.26.4) built from services/quantum-runtime with a pinned
  requirements-legacy.txt and parameterized Dockerfile
- [x] Environment selection threaded through the standard execution
  service and sandbox — registry ids only; every environment run passes
  the same auth, limits, judging, and persistence as any other execution
- [x] Compatibility experiments (CompatibilityExperiment /
  CompatibilityRun): one program, one baseline execution, one shared
  shots/seed configuration, executed in each candidate environment
- [x] Evidence-backed compatibility reports (quantoo.compatibility.v1)
  with per-candidate dimensions (STRUCTURE / PROBABILITY / MEASUREMENT /
  BEHAVIOR / RESOURCE / ENVIRONMENT) and honest overall statuses
  (COMPATIBLE, COMPATIBLE_WITH_RESOURCE_CHANGE, BEHAVIORALLY_DIFFERENT,
  EXECUTION_FAILED, INSUFFICIENT_EVIDENCE)
- [x] Reproduction report environment dimension: reproducing through a
  different runtime is visible as ENVIRONMENT DIFFERENT (behavior remains
  the deciding evidence)
- [x] Versioned reproducibility packages (quantoo.experiment.v1) with
  export and untrusted-input import: schema pinned, size bounded,
  environment ids filtered against the local registry, source executed
  only inside the sandbox, no field ever interpreted as a command
- [x] Compatibility API namespace (/api/compatibility/*) with session
  auth, ownership enforcement, Zod validation, dedicated rate limit, and
  server-side verdict recomputation
- [x] Compatibility Lab UI inside the workspace: environment matrix with
  availability labels, experiment execution, per-dimension evidence,
  "Inspect at divergence" debugger deep link, package export/import
- [x] Tests: registry/fingerprint/policy units, real cross-environment
  integration (host 1.2.4 vs legacy 1.1.2 image with genuine metadata on
  both sides), full experiment flow over the real DB, cross-user
  isolation, and tampered-package rejection

## Phase 8: Quantum Software Observatory — Production & Research Launch (delivered)

- [x] Research artifacts (quantoo.artifact.v1): provenance-preserving
  evidence documents assembled from compatibility experiments, with
  capsules, compatibility reports, and reproduction reports frozen at
  publish time
- [x] Artifact versioning and integrity: immutable versions,
  sha-256 hashes over canonical JSON, tamper-evident export envelope,
  defensive import validation (schema, size, depth, hash checks) —
  import never executes code
- [x] Artifact visibility (PRIVATE / PUBLIC) with explicit user-driven
  publishing and server-enforced ownership; no accidental exposure of
  private source
- [x] Benchmark corpus: code-defined official benchmarks (state
  preparation, entanglement, measurement, noise sensitivity) with
  seeded, evidence-producing runs through the standard sandbox pipeline
- [x] Benchmark comparison: run-to-run behavioral comparison with
  classification of correctness / behavioral / resource regressions
- [x] Projects: user-organized evidence containers referencing real
  problems, executions, experiments, and artifacts with ownership
  enforcement on every referenced resource
- [x] Hardware abstraction layer: provider-independent backend contract
  (capabilities, availability probing, job lifecycle), local Aer
  simulator adapter honestly labeled LOCAL_SIMULATOR, and an
  /api/hardware/backends endpoint — no provider is claimed available
  without measured evidence, and remote-simulator/QPU adapters remain
  unwritten rather than stubbed
- [x] Execution provenance: every execution artifact and capsule now
  records the backend and controlled environment that produced it
  (backward compatible; older capsules report null)
- [x] Layered health endpoint: application / database / sandbox / runtime
  availability each measured independently, never guessed from config
- [x] Unified error taxonomy with stable machine-readable codes and
  rate-limit event logging
- [x] Observatory UI: artifact browsing and detail pages, benchmarks
  page, working projects page, and Observatory navigation
- [x] Open-source documentation set: CONTRIBUTING, SECURITY, deployment
  guide, observatory model, and artifact specification
- [ ] Real QPU integration (requires provider credentials and accounts;
  the backend contract is ready for a real adapter)
- [ ] Noise-model simulation and decoherence modeling
- [ ] Transpilation visualization
- [ ] Unlisted artifact visibility state

## Post-roadmap

The planned phase sequence is complete. Future development proceeds as
normal open-source evolution: releases, bug fixes, performance work,
security updates, provider integrations, research improvements, new
experiments, benchmarks, and compatibility environments.
