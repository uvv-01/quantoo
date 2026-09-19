# Contributing to Quantoo

Thank you for your interest in improving Quantoo — a platform for
building, executing, understanding, comparing, reproducing, and
preserving the behavior of quantum software.

## Development setup

```bash
git clone https://github.com/uvv-01/quantoo
cd quantoo
npm install
cp .env.example .env   # then edit DATABASE_URL and AUTH_SECRET
npx prisma generate
npx prisma migrate dev
npm run dev
```

Requirements: Node.js 20+ and a PostgreSQL database. The quantum runtime
needs Docker for full sandbox execution; see
[docs/development/quantum-runtime.md](docs/development/quantum-runtime.md).

## Validation before every contribution

Run the repository's actual checks — a PR is reviewable only when these
pass:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests live under `tests/` and run with vitest. Tests that need Docker
probe for it honestly and skip with a clear reason when unavailable;
they never fake results.

## Ground rules

- **Evidence over claims.** Features that display scientific or
  technical statements must derive them from persisted execution
  evidence. Never fabricate results, availability, or measurements.
- **Nothing executes on import.** Imported capsules, packages, and
  artifacts are untrusted data: validate structurally, never run.
- **Environments are code-defined.** Users select registered runtime
  environments; they never define, install, or fetch them.
- **Server-side authority.** Identity, ownership, verdicts, and limits
  are always computed server-side. Client input is validated with Zod.
- **Secrets stay out.** Never commit `.env`, credentials, or tokens.
  Capsules and artifacts contain technical data only.

## Code style

- TypeScript strict mode; `npm run format` applies Prettier.
- ESLint must pass with zero warnings (`npm run lint`).
- Prefer small, typed modules under `lib/<domain>/` with colocated
  validation and tests.

## Commit messages

Use concise, imperative subjects, e.g. `feat: add semantic comparison
policies` or `fix: enforce artifact size limits`. No AI attribution,
no co-author trailers.

## Where to make changes

| Area                          | Location                          |
| ----------------------------- | --------------------------------- |
| Execution, sandbox, judge     | `lib/exec/`, `lib/judge/`         |
| Debugger / traces             | `lib/exec/`, `components/workspace/` |
| Semantic engine               | `lib/semantic/`                   |
| Compatibility lab             | `lib/compat/`                     |
| Observatory, artifacts        | `lib/artifacts/`, `app/observatory/` |
| Benchmarks                    | `lib/benchmarks/`                 |
| Projects                      | `lib/projects/`                   |
| Hardware abstraction          | `lib/hardware/`                   |
| Quantum runtime (Python)      | `services/quantum-runtime/`       |
