# Quantoo

**Practice quantum computing like an engineer.**

Quantoo is a developer-first quantum-computing learning and engineering platform. It provides a structured path from quantum fundamentals through real hardware execution, with professional-grade tools at every stage.

## Vision

The complete quantum engineering workflow:

```
Learn → Challenge → Write Code → Execute → Test → Fail → Debug → Understand → Fix → Optimize → Noise → Hardware → Project → Portfolio
```

Quantum Daily builds this workflow incrementally across nine development phases.

## Current Status

**Phase 1 — Foundation** ✅
**Phase 2 — Authentication & Security** ✅
**Phase 3 — Problem & Content Engine** ✅
**Phase 4 — Code Workspace, Execution & Judge** ✅
**Phase 5 — Quantum Debugger & Execution Traces** ✅
**Phase 6 — Quantum Semantic Observatory** ✅
**Phase 7 — Quantum Compatibility & Reproducibility Lab** ✅
**Phase 8 — Quantum Software Observatory: Production & Research Launch** ✅

### Phase 1 — Foundation
- Next.js application with TypeScript strict mode
- Tailwind CSS with a coherent design token system
- Component library (Button, Card, Badge, Alert, Skeleton, EmptyState)
- PostgreSQL database schema via Prisma
- Environment validation with Zod
- Structured logging abstraction
- Health check API endpoint
- Error handling (error boundary, not-found, loading states, empty states)
- Responsive layout with light/dark theme support
- Accessibility foundation (skip links, focus indicators, ARIA, semantic HTML)
- CI pipeline (GitHub Actions)
- Architecture, security, and roadmap documentation

### Phase 2 — Authentication & Security
- User registration with email verification
- Secure login with HTTP-only session cookies
- Password hashing with bcrypt (12 salt rounds)
- Email verification flow with cryptographically random tokens
- Forgot password / password reset flow
- Password change in settings (requires current password)
- Rate limiting on all auth endpoints
- Security event logging (audit trail)
- Protected route middleware
- Enumeration protection (generic error messages)
- Auth-aware header (login/signup when unauthenticated, profile/settings/sign out when authenticated)
- Security settings page (email verification, change password, session management)

### Phase 3 — Problem & Content Engine
- Enhanced Prisma schema: Concepts, Tags, Learning Topics, Problem Relations, Test Specifications
- Problem discovery page with search, difficulty/concept/tag filtering, and pagination
- Problem detail page with description, learning objectives, requirements, hints, expected outcomes, and related problems
- Learning topics page with concept coverage and problem counts
- Topic detail page with ordered problem lists
- RESTful API endpoints for problems, topics, and user progress
- Progress tracking system (start, attempt, solve) with ownership enforcement
- 5 high-quality seed problems (Qubit Basics, X Gate, Superposition, Measurement, Bell State)
- Quantum concept taxonomy (10 concepts across 4 categories)
- Problem relation system (prerequisite, next, related, same-concept)
- Test specification architecture for future Judge integration
- 198 unit tests across 19 test files

### Phase 4 — Code Workspace, Execution & Judge
- Interactive problem workspace (`/problems/[slug]/solve`) with a CodeMirror Python editor, starter code, and draft autosave
- Qiskit/Aer quantum runtime (`services/quantum-runtime`) executing submissions with scenario variants (zero state, superposition)
- Docker sandbox: per-run container with no network, CPU/memory caps, PID limit, read-only filesystem, dropped capabilities, and an explicit minimal environment (no secrets)
- Resource policy: configurable and clamped limits for qubits, depth, operations, shots, wall clock, memory, and output size
- Execution API (`POST /api/executions/run`) with session authentication, per-user rate limiting, and Zod validation
- First Quantum Judge: STATE (global-phase-invariant), DISTRIBUTION (tolerance, scenario-based), STRUCTURAL, and ENTANGLEMENT checks driven by authored test specifications
- Execution artifacts persisted per run (`Submission` model) with structured, safe error codes; submission history endpoint
- Code persistence (`ProblemDraft` model) with per-user ownership and autosave
- Automatic progress recording — `SOLVED` only from a real judge pass
- Execution result UI: verdicts, per-check explanations, circuit metrics, measurement counts, program output
- Runtime, judge, sandbox security, and validation test suites (runner tests skip gracefully when the runtime is absent)

**Not yet implemented:** noise models, transpilation, real hardware, projects, portfolio, skill graph, AI tutor.

### Phase 5 — Quantum Debugger & Execution Traces
- Gate-level execution trace persisted with every successful run (`TraceStep` list preserving real operation ordering)
- Quantum Time Machine: first/previous/next/last navigation, step scrubber, play/pause, reset — all state views follow the selected step
- State inspection from exact statevector snapshots: basis state, amplitude (real/imaginary), magnitude, probability, and phase with global-phase normalization and careful handling of near-zero amplitudes
- Exact probabilities (derived from the actual statevector) kept strictly distinct from sampled measurement frequencies
- Interactive circuit view: qubits/classical bits, gate positions, measurements, executed vs upcoming operations, accessible current-step indicators (position, borders, labels — never color alone)
- Failure localization: judge failures map to trace regions with evidence-based language ("Failure observed after step N.") and a one-click "open debugger near step" from the results panel
- Reference-comparison foundation (Quantum Diff): STRUCTURE / STATE / PROBABILITY / MEASUREMENT / RESOURCE categories with global-phase-invariant state similarity and probability tolerance — never source-text equality
- Debugger modes (Beginner / Developer / Research) with graceful "unavailable for this execution" handling; Research exposes density matrix and unitary views under strict size caps
- Debugger API (`/api/executions/[id]`, `/api/executions/[id]/trace`, `/api/submissions/[id]/debug`) with session auth and ownership enforcement (foreign resources indistinguishable from missing ones)
- Snapshot scaling policy: qubit ceilings, snapshot subsampling beyond `EXEC_SNAPSHOT_MAX_STEPS`, payload caps for statevector/density-matrix/unitary
- Comprehensive tests: diff/localization units, real-Qiskit runtime trace/inspection tests, debugger authorization and API tests, and Playwright E2E for correct/failed/error/privacy debugger flows

### Phase 6 — Quantum Semantic Observatory
- Semantic record extraction from every persisted execution artifact: canonical circuit (normalized gate names, real operation order), exact probabilities, sampled measurement frequencies, statevector evidence — missing data stays `null`, never fabricated
- Layered semantic fingerprints (structural / operational / probability / measurement / resource / environment / combined), deterministic and independently inspectable — never source-text hashes
- Policy-driven comparison engine (`statistical-default`, `exact`) across STRUCTURE / STATE / PROBABILITY / MEASUREMENT / RESOURCE / ENVIRONMENT with total-variation and Hellinger metrics, configurable thresholds, and shot-count-aware weak-evidence notes
- Evidence-linked verdicts (`EQUIVALENT`, `BEHAVIORALLY_EQUIVALENT`, `RESOURCE_REGRESSION`, `ENVIRONMENT_DIFFERENT`, `DIFFERENT`, `INSUFFICIENT_EVIDENCE`) with precise language: "observationally equivalent under policy X", "first observed divergence" — never "formally verified" or "root cause"
- Global-phase-invariant state comparison preserved from Phase 5; global-phase-only differences are never behavioral differences
- Regression baselines per user/problem; comparisons against a baseline classify behavioral, resource, and environment changes as separate dimensions
- Execution reproduction through the standard sandboxed pipeline (recorded source, shots, seed from the database) with mandatory evidence comparison before any "REPRODUCED" verdict
- Versioned execution capsules (`quantoo.execution.v1`) with export and defensive Zod validation (size caps, depth limits, field bounds); import never executes code
- Environment record captured inside the runtime (Python, Qiskit, Aer, NumPy, shots, seed) — safe technical metadata only
- Semantic API namespace (`/api/semantic/executions`, `/compare`, `/reproduce`, `/capsules`, `/baselines`) with session auth, ownership enforcement, Zod validation, rate limits, and fully server-side verdict recomputation
- Semantic Observer UI embedded in the workspace: execution selection, per-dimension evidence, baseline management, one-click reproduction, capsule download, and "Inspect at divergence" deep link into the Phase 5 debugger
- Test coverage: statistics and canonical-form units, real-Qiskit comparison scenarios (equivalent representations, real behavioral differences, resource-only regressions, environment changes, reproduction), and real-database security tests (401s, cross-user isolation, malformed capsules, foreign baselines)

### Phase 7 — Quantum Compatibility & Reproducibility Lab
- Controlled environment registry: code-declared profiles with concrete versions (default Qiskit 1.2.4 runtime plus a pinned legacy Qiskit 1.1.2 image), measured availability probing with honest UNAVAILABLE reporting — users select environments, never define, install, or fetch them
- Same-program cross-environment execution: a compatibility experiment re-runs the user's baseline program in each candidate environment through the standard sandboxed pipeline with one shared shots/seed configuration, so environments differ only by their runtime
- Evidence-backed compatibility reports (`quantoo.compatibility.v1`): per-candidate STRUCTURE / PROBABILITY / MEASUREMENT / BEHAVIOR / RESOURCE / ENVIRONMENT dimensions with honest statuses (COMPATIBLE, COMPATIBLE_WITH_RESOURCE_CHANGE, BEHAVIORALLY_DIFFERENT, EXECUTION_FAILED, INSUFFICIENT_EVIDENCE) — structural change alone is never a behavioral regression
- Reproduction report now records an explicit ENVIRONMENT check alongside behavior (a successful run alone is still never "reproduced")
- Versioned reproducibility packages (`quantoo.experiment.v1`) with export and untrusted-input import: schema pinned, size bounded, unknown environment ids skipped (never fetched), imported source executed only inside the sandbox
- Compatibility API namespace (`/api/compatibility/environments`, `/experiments`, `/experiments/[id]`, `/experiments/[id]/export`, `/import`) with session auth, ownership enforcement, Zod validation, a dedicated rate limit, and server-side verdict recomputation
- Compatibility Lab UI inside the workspace: environment matrix with availability labels, experiment execution, per-dimension evidence, "Inspect at divergence" deep link into the Phase 5 debugger, and package export/import
- Test coverage: registry/fingerprint/policy units, real cross-environment integration (the same Bell program through both runtimes, genuine version metadata on both sides, X-vs-H behavioral difference across environments), full experiment flow over the real database, cross-user isolation, and tampered-package rejection

**Not yet implemented:** cross-framework execution (PennyLane/Cirq), noise models, transpilation visualization, real hardware, unlisted artifact visibility.

### Phase 8 — Quantum Software Observatory: Production & Research Launch
- Research artifacts (`quantoo.artifact.v1`): provenance-preserving evidence documents assembled from compatibility experiments — capsules, compatibility reports, and reproduction reports are embedded snapshots frozen at publish time
- Versioning and integrity: immutable published versions, sha-256 hashes over canonical JSON, tamper-evident export envelope with hash verification on import
- Visibility control (`PRIVATE`/`PUBLIC`) with explicit user-driven publishing; imports are untrusted data (schema, size, depth, and hash validated, never executed) and create new private artifacts whose baseline is established by a real local execution
- Benchmark corpus: code-defined canonical programs (state preparation, entanglement, measurement, noise sensitivity) with seeded, evidence-producing runs through the standard sandbox pipeline and run-to-run comparison that classifies correctness / behavioral / resource regressions
- Projects: user-organized evidence containers referencing real problems, executions, experiments, and artifacts with server-side ownership enforcement on every referenced resource
- Hardware abstraction layer: provider-independent backend contract (capabilities, measured availability, circuit validation, job lifecycle) with the sandboxed Aer simulator honestly labeled `LOCAL_SIMULATOR` — no provider is reported available without measured evidence, and remote-simulator/QPU adapters remain unwritten rather than stubbed
- Execution provenance: every execution artifact and capsule records the backend and controlled environment that produced it (backward compatible; older capsules report `null`)
- Layered health endpoint (`/api/health`): application, database, sandbox, and runtime availability measured independently — never inferred from configuration
- Unified error taxonomy with stable machine-readable codes; rate-limit events logged for observability
- Observatory UI: `/observatory` artifact browsing and detail pages, `/benchmarks`, working `/projects`, and Observatory navigation
- Open-source documentation set: CONTRIBUTING, SECURITY, production deployment guide, observatory model, and the research artifact specification

**Not yet implemented:** real QPU integration (requires provider credentials; the backend contract is ready), noise models, transpilation visualization.

## Architecture

```
┌─────────────────────────────────────────────┐
│                Next.js 16 App               │
│  (React 19, TypeScript, Tailwind CSS 4)     │
├─────────────────────────────────────────────┤
│          Auth Middleware (cookie check)      │
├─────────────────────────────────────────────┤
│  API Routes (auth, problems, progress, etc.)│
├─────────────────────────────────────────────┤
│  Service Layer                              │
│  ├─ Auth (signup, login, sessions)           │
│  ├─ Problem (CRUD, search, filter, paginate) │
│  ├─ Learning (topics, concepts, progress)    │
│  ├─ Progress (attempts, completion)          │
│  ├─ Execution (run workflow, artifacts)      │
│  └─ Judge (STATE/DISTRIBUTION/STRUCTURAL/…)  │
├─────────────────────────────────────────────┤
│  Validation (Zod) │ Security Events │ Email │
├─────────────────────────────────────────────┤
│             Prisma ORM Layer                │
├─────────────────────────────────────────────┤
│            PostgreSQL Database              │
└─────────────────────────────────────────────┘

Quantum execution (Phase 4):
  Workspace UI → Execution API → Sandbox boundary → Docker container
       ↓
  Qiskit/Aer runtime → Execution artifact → Quantum Judge → Verdict
       ↓
Quantum debugging (Phase 5):
  Execution artifact → Gate trace + state snapshots → Debugger API
       ↓
  Time Machine UI (circuit view, state/amplitude/phase inspection,
  failure localization, reference comparison)
```

See [docs/architecture/](docs/architecture/) for detailed documentation.

## Technology

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| UI | React 19, Tailwind CSS 4 |
| Database | PostgreSQL, Prisma 5 |
| Auth | bcryptjs, secure HTTP-only cookies |
| Quantum runtime | Python 3.11, Qiskit, Qiskit Aer |
| Sandbox | Docker (per-run container, no network) |
| Code editor | CodeMirror 6 (@uiw/react-codemirror) |
| Validation | Zod |
| Testing | Vitest, React Testing Library |
| Linting | ESLint 9, Prettier |
| CI | GitHub Actions |

## Development

### Prerequisites

- Node.js 20+ (recommended: 22)
- PostgreSQL
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/uvv-01/quantoo.git
cd quantoo

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start development server
npm run dev
```

The app runs at `http://localhost:3000`.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run unit tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npx prisma studio` | Open Prisma Studio |
| `docker build -t quantoo/quantum-runtime:latest services/quantum-runtime` | Build the sandbox runtime image |
| `docker network create --internal quantoo-sandbox` | Create the isolated sandbox network (no egress) |

### Environment Variables

See `.env.example` for the full list. Key variables:

```bash
DATABASE_URL          # PostgreSQL connection string
APP_URL               # Application URL (server-side, for email links)
NEXT_PUBLIC_APP_URL   # Application URL (client-side)
AUTH_SECRET           # Session/CSRF secret (min 32 chars, change for production)
EMAIL_FROM            # Sender email address
SMTP_HOST             # SMTP server (optional, logs to console in dev)
SMTP_PORT             # SMTP port
SMTP_USER             # SMTP username
SMTP_PASSWORD         # SMTP password
LOG_LEVEL             # debug | info | warn | error
QUANTOO_SANDBOX_MODE  # docker (default) | host-fallback (local dev only) | disabled
EXEC_MAX_QUBITS       # Sandbox qubit limit (default 8, clamped)
EXEC_TIMEOUT_MS       # Execution wall-clock limit (default 15000)
EXEC_MEMORY_MB        # Sandbox memory limit (default 512)
```

## Testing

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

Tests cover:
- Utility functions, constants, logger
- Button and Card components
- All route pages (home, dashboard, problems, learn, projects, profile, settings)
- Health API endpoint
- Auth validation schemas (signup, login, forgot-password, reset-password, change-password)
- Password hashing and verification (bcrypt)
- Token generation and hashing (session, verification, reset)
- Rate limiting logic
- Problem validation schemas (list query, slug params, attempt/solve)
- Problem service logic (filtering, search, pagination)
- Concept/tag normalization and validation
- Problem relation types and test specification architecture
- Progress tracking logic (status transitions, attempt counting, ownership)
- Security tests (draft protection, authorization, input validation, data isolation)
- Quantum Judge checks (state with global-phase invariance, distributions, structure, entanglement)
- Execution limits clamping and run-request validation
- Quantum runtime runner integration tests (real Qiskit execution, error classification, sandbox restrictions; skip when the runtime is not installed)
- Sandbox boundary security (mode gating, disabled refusal, no stack traces in failures)

## Project Structure

```
quantoo/
├── app/                  # Next.js App Router
│   ├── api/
│   │   ├── auth/         # Auth routes (signup, login, logout, etc.)
│   │   ├── health/       # Health check endpoint
│   │   ├── problems/     # Problem listing and detail
│   │   ├── learn/        # Learning topics
│   │   ├── progress/     # User progress tracking
│   │   ├── executions/   # Run submissions & history (Phase 4)
│   │   ├── drafts/       # Code draft persistence (Phase 4)
│   │   ├── semantic/     # Semantic observatory (Phase 6)
│   │   ├── compatibility/ # Compatibility lab (Phase 7)
│   │   ├── artifacts/    # Research artifacts (Phase 8)
│   │   ├── benchmarks/   # Benchmark corpus & runs (Phase 8)
│   │   ├── projects/     # Project evidence containers (Phase 8)
│   │   └── hardware/     # Backend registry & availability (Phase 8)
│   ├── dashboard/        # Dashboard
│   ├── problems/         # Problem catalog UI
│   │   └── [slug]/solve/ # Quantum workspace (Phase 4)
│   ├── learn/            # Learning paths UI
│   ├── observatory/      # Research artifact browsing (Phase 8)
│   ├── benchmarks/       # Benchmark corpus UI (Phase 8)
│   ├── projects/         # Projects (Phase 8)
│   ├── profile/          # User profile
│   └── settings/         # Settings
├── components/
│   ├── ui/               # Reusable UI components
│   ├── layout/           # Header, Footer, ThemeToggle
│   └── providers/        # ThemeProvider
├── lib/
│   ├── auth/             # Auth service, session, tokens, email
│   ├── exec/             # Execution: sandbox, limits, validation, service
│   ├── judge/            # Quantum Judge checks
│   ├── semantic/         # Semantic records, fingerprints, capsules (Phase 6)
│   ├── compat/           # Environment registry, compatibility engine (Phase 7)
│   ├── artifacts/        # Research artifact types, integrity, service (Phase 8)
│   ├── benchmarks/       # Benchmark corpus, runs, comparison (Phase 8)
│   ├── projects/         # Project service & validation (Phase 8)
│   ├── hardware/         # Backend contract, registry, availability (Phase 8)
│   ├── errors/           # Unified error taxonomy (Phase 8)
│   ├── server/           # Server-side services
│   │   ├── problem-service.ts
│   │   ├── learning-service.ts
│   │   └── progress-service.ts
│   ├── validation/       # Zod schemas
│   ├── constants.ts      # App constants
│   ├── env.ts            # Environment validation
│   ├── logger.ts         # Structured logging
│   ├── prisma.ts         # Prisma client singleton
│   └── utils.ts          # Utility functions
├── middleware.ts          # Route protection middleware
├── prisma/               # Database schema + migrations + seed
├── services/
│   └── quantum-runtime/  # Python sandbox runtime (Qiskit/Aer)
├── tests/                # Unit & integration tests
├── e2e/                  # E2E tests (future)
└── docs/                 # Documentation
```

## Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation | ✅ Complete |
| 2 | Authentication & Security | ✅ Complete |
| 3 | Problem & Content Engine | ✅ Complete |
| 4 | Code Workspace + Execution + Judge | ✅ Complete |
| 5 | Quantum Debugger | ✅ Complete |
| 6 | Quantum Semantic Observatory | ✅ Complete |
| 7 | Quantum Compatibility & Reproducibility Lab | ✅ Complete |
| 8 | Quantum Software Observatory: Production & Research Launch | ✅ Complete |

The planned phase sequence is complete. Development continues as normal
open-source evolution: releases, fixes, performance, security updates,
provider integrations, and community contributions.

See [docs/roadmap.md](docs/roadmap.md) for detailed phase breakdowns.

## Security

- Environment validation prevents building with invalid configuration
- Secure HTTP headers (X-Frame-Options, CSP, HSTS)
- No stack traces or database errors exposed to users
- Secrets excluded from version control via `.gitignore`
- Structured logging excludes sensitive data
- Untrusted code executed only in sandboxed, resource-capped, network-isolated containers
- Imported capsules, packages, and artifacts validated structurally and never executed

See [SECURITY.md](SECURITY.md) for the reporting process and the full
security model, and [docs/security/security-baseline.md](docs/security/security-baseline.md).

## Quantum Architecture (Future)

Remaining on the post-roadmap horizon (documented as future because the
integrations do not exist yet):

- **Real hardware** — QPU access through the Phase 8 backend contract, once a provider integration with real credentials exists
- **Noise simulation** — noise models and decoherence-aware semantic analysis
- **Transpilation visualization** — transpiler pass inspection
- **Cross-framework execution** — PennyLane/Cirq runtime environments

See [docs/architecture/](docs/architecture/) for detailed designs.

## License

Private repository — owned by [uvv-01](https://github.com/uvv-01).
