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

**Not yet implemented:** advanced debugger (breakpoints, time machine), noise models, transpilation, real hardware, projects, portfolio, skill graph, AI tutor.

**Not yet implemented:** Code execution, quantum simulation, debugger, real hardware, projects, portfolio, AI tutor.

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

Future (Phase 5+):
  Quantum Debugger → Noise Engine → Transpilation → Real QPU → Portfolio
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
| `docker network create quantoo-sandbox` | Create the isolated sandbox network |

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
│   │   └── drafts/       # Code draft persistence (Phase 4)
│   ├── dashboard/        # Dashboard
│   ├── problems/         # Problem catalog UI
│   │   └── [slug]/solve/ # Quantum workspace (Phase 4)
│   ├── learn/            # Learning paths UI
│   ├── projects/         # Projects
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
| 5 | Quantum Debugger | Planned |
| 6 | Noise, Optimization & Hardware-Aware Simulation | Planned |
| 7 | Real Hardware + Transpilation | Planned |
| 8 | Projects + Portfolio + Skill Intelligence | Planned |
| 9 | AI Tutor + Public Showcase + Production Hardening | Planned |

See [docs/roadmap.md](docs/roadmap.md) for detailed phase breakdowns.

## Security

- Environment validation prevents building with invalid configuration
- Secure HTTP headers (X-Frame-Options, CSP, HSTS)
- No stack traces or database errors exposed to users
- Secrets excluded from version control via `.gitignore`
- Structured logging excludes sensitive data

See [docs/security/security-baseline.md](docs/security/security-baseline.md).

## Quantum Architecture (Future)

The platform will eventually support:

- **Quantum Judge** — Multi-layer evaluation (structural, functional, state, distribution, unitary, observable, entanglement, statistical, resource, noise, hardware)
- **Quantum Debugger** — Step-through debugging with breakpoints, state snapshots, probability distributions, Bloch sphere visualization
- **Noise Simulation** — Real-world noise models and decoherence
- **Real Hardware** — IBM Quantum, Google Cirq integration

See [docs/architecture/](docs/architecture/) for detailed designs.

## License

Private repository — owned by [uvv-01](https://github.com/uvv-01).
