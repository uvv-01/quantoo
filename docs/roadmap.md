# Quantum Daily — Development Roadmap

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
- [ ] Cross-version execution farm (Phase 7 — Compatibility Lab)
- [ ] Cross-framework execution (Phase 7+; abstraction ready)
- [ ] Noise-aware semantic analysis (later phase)

## Phase 7: Noise, Optimization & Hardware-Aware Simulation

- [ ] Noise model simulation
- [ ] Decoherence modeling
- [ ] Circuit optimization techniques
- [ ] Gate count and depth reduction
- [ ] Transpilation pipeline
- [ ] Hardware-aware circuit compilation
- [ ] Noise-aware debugging

## Phase 7: Real Hardware + Transpilation

- [ ] IBM Quantum integration
- [ ] Google Cirq integration
- [ ] Real QPU execution
- [ ] Transpilation visualization
- [ ] Queue management
- [ ] Results comparison (sim vs. hardware)
- [ ] Hybrid classical-quantum workflows

## Phase 8: Projects + Portfolio + Skill Intelligence

- [ ] Guided project templates
- [ ] Project submission and validation
- [ ] Portfolio generation
- [ ] Public profile pages
- [ ] Skill tracking and assessment
- [ ] Learning analytics
- [ ] Achievement system

## Phase 9: AI Tutor + Public Showcase + Production Hardening

- [ ] AI-assisted learning hints
- [ ] Adaptive problem recommendations
- [ ] Natural language quantum explanations
- [ ] Public showcase gallery
- [ ] Performance optimization
- [ ] Monitoring and alerting
- [ ] Documentation completeness
- [ ] Production deployment
