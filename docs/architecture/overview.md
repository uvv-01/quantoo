# Quantum Daily — Architecture Overview

> This document describes the high-level architecture of Quantum Daily.
> **Status: Phase 1 — Foundation**

## Vision

Quantum Daily is a developer-first quantum-computing learning and engineering platform. The complete workflow:

```
LEARN → CHALLENGE → WRITE CODE → EXECUTE → TEST → FAIL → DEBUG → UNDERSTAND → FIX → OPTIMIZE → NOISE → HARDWARE → PROJECT → PORTFOLIO
```

## System Architecture

```
┌─────────────────────────────────────────────┐
│                Next.js App                  │
│  (React, TypeScript, Tailwind, shadcn/ui)  │
├─────────────────────────────────────────────┤
│          API Routes / Server Actions        │
├─────────────────────────────────────────────┤
│             Prisma ORM Layer                │
├─────────────────────────────────────────────┤
│            PostgreSQL Database              │
└─────────────────────────────────────────────┘

Future additions:
┌─────────────────────────────────────────────┐
│          Execution API (Phase 4)            │
├─────────────────────────────────────────────┤
│      Job / Sandbox Layer (Phase 4)          │
├─────────────────────────────────────────────┤
│   Python Quantum Runtime (Phase 4-7)        │
│   (Qiskit Aer, PennyLane, NumPy, SciPy)    │
├─────────────────────────────────────────────┤
│        Execution Artifact (Phase 4)         │
├─────────────────────────────────────────────┤
│         Quantum Judge (Phase 4)             │
├─────────────────────────────────────────────┤
│        Quantum Debugger (Phase 5)           │
└─────────────────────────────────────────────┘
```

## Implemented (Phase 1)

- Next.js 16 application with App Router
- TypeScript strict mode
- Tailwind CSS 4 with design tokens
- Component library (Button, Card, Badge, Alert, Skeleton, EmptyState)
- Prisma schema (User, Profile, Problem, ProblemVersion, ProblemTag, UserProblemProgress, UserActivity, DailyChallenge)
- Environment validation with Zod
- Structured logging abstraction
- Health check API endpoint
- Error handling (error boundary, not-found, loading states)
- Responsive layout with header, footer, navigation
- Light/dark theme support
- Accessibility foundation (skip links, focus indicators, semantic HTML, ARIA)
- CI pipeline (GitHub Actions)

## Planned

- Authentication system (Phase 2)
- Problem/content engine with versioning (Phase 3)
- Code workspace and execution sandbox (Phase 4)
- Quantum Judge evaluation engine (Phase 4)
- Quantum debugger (Phase 5)
- Noise simulation and optimization (Phase 6)
- Real quantum hardware execution (Phase 7)
- Projects and portfolio system (Phase 8)
- AI tutor and public showcase (Phase 9)

## Directory Structure

```
quantoo/
├── app/               # Next.js App Router pages and API routes
├── components/        # React components (ui/, layout/, providers/)
├── lib/               # Shared utilities, env, logging, constants
├── prisma/            # Database schema and migrations
├── public/            # Static assets
├── tests/             # Unit and integration tests
├── e2e/               # End-to-end tests (Playwright, Phase 4+)
├── docs/              # Documentation
└── .github/workflows/ # CI/CD pipelines
```

## Design Principles

1. **Strict TypeScript** — No `any` types. All data structures are explicitly typed.
2. **Server/Client boundary** — Clear separation between server and client components.
3. **Accessibility first** — WCAG compliance from Phase 1.
4. **Progressive disclosure** — Build foundations before features.
5. **No fake data** — Empty states over fabricated content.
6. **Security by default** — Environment validation, input sanitization, error handling.
