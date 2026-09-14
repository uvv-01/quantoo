# Quantum Daily

**Practice quantum computing like an engineer.**

Quantum Daily is a developer-first quantum-computing learning and engineering platform. It provides a structured path from quantum fundamentals through real hardware execution, with professional-grade tools at every stage.

## Vision

The complete quantum engineering workflow:

```
Learn → Challenge → Write Code → Execute → Test → Fail → Debug → Understand → Fix → Optimize → Noise → Hardware → Project → Portfolio
```

Quantum Daily builds this workflow incrementally across nine development phases.

## Current Status

**Phase 1 — Foundation** ✅
**Phase 2 — Authentication & Security** ✅

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
- 110 unit tests across 14 test files

**Not yet implemented:** Problems, code execution, quantum simulation, debugger, real hardware, projects, portfolio, AI tutor.

## Architecture

```
┌─────────────────────────────────────────────┐
│                Next.js 16 App               │
│  (React 19, TypeScript, Tailwind CSS 4)     │
├─────────────────────────────────────────────┤
│          Auth Middleware (cookie check)      │
├─────────────────────────────────────────────┤
│     API Routes (auth, health, future)       │
├─────────────────────────────────────────────┤
│     Auth Service (signup, login, etc.)       │
├─────────────────────────────────────────────┤
│  Session Mgmt │ Password │ Tokens │ Email   │
├─────────────────────────────────────────────┤
│             Prisma ORM Layer                │
├─────────────────────────────────────────────┤
│            PostgreSQL Database              │
└─────────────────────────────────────────────┘

Future (Phase 4+):
  Execution API → Job/Sandbox → Python Runtime → Qiskit Aer
       ↓
  Execution Artifact → Quantum Judge → Debugger → UI
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

## Project Structure

```
quantoo/
├── app/                  # Next.js App Router
│   ├── api/health/       # Health check endpoint
│   ├── dashboard/        # Dashboard
│   ├── problems/         # Problem catalog
│   ├── learn/            # Learning paths
│   ├── projects/         # Projects
│   ├── profile/          # User profile
│   └── settings/         # Settings
├── components/
│   ├── ui/               # Reusable UI components
│   ├── layout/           # Header, Footer, ThemeToggle
│   └── providers/        # ThemeProvider
├── lib/                  # Utilities, env, logging, constants
├── prisma/               # Database schema
├── tests/                # Unit tests
├── e2e/                  # E2E tests (future)
└── docs/                 # Documentation
```

## Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation | ✅ Complete |
| 2 | Authentication & Security | ✅ Complete |
| 3 | Problem & Content Engine | Planned |
| 4 | Code Workspace + Execution + Judge | Planned |
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
