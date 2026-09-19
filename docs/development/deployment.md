# Production Deployment Guide

This guide describes deploying Quantoo with its quantum execution
sandbox. It describes what the repository provides; commands marked as
example values must be adapted to your infrastructure. Nothing here has
been verified against a specific hosting provider — verify each step in
your environment.

---

## 1. Prerequisites

- Node.js 20+ (22 recommended)
- PostgreSQL 14+
- Docker on the application host (required for sandbox execution in
  the default configuration)
- A secrets manager or equivalent for production secrets

## 2. Environment variables

Copy `.env.example` and configure at minimum:

| Variable | Purpose | Notes |
| -------- | ------- | ----- |
| `DATABASE_URL` | PostgreSQL connection string | App host must reach the DB; DB should not be publicly reachable |
| `AUTH_SECRET` | Session/cookie signing secret | Generate with `openssl rand -base64 32`; never reuse across environments |
| `QUANTOO_SANDBOX_MODE` | `docker` (recommended) or `host-fallback` | `disabled` disables execution entirely |
| `EXEC_TIMEOUT_MS` | Per-execution wall clock ceiling | Clamped to safe bounds server-side |
| `EXEC_MEMORY_MB` | Per-execution memory ceiling | Clamped server-side |

The application validates all environment variables at startup and
refuses to boot with invalid configuration. See `lib/env.ts` for the
authoritative list.

## 3. Build and start

```bash
npm ci
npm run build
npm run db:migrate:prod   # apply Prisma migrations
npm start                 # serves the production build
```

Run behind a TLS-terminating reverse proxy. Do not expose the Node
process directly to the internet.

## 4. Quantum runtime images

The sandbox executes quantum programs inside pinned images built from
`services/quantum-runtime/`:

```bash
cd services/quantum-runtime
docker build -t quantoo-runtime:latest .
docker build --build-arg REQUIREMENTS_FILE=requirements-legacy.txt \
  -t quantoo-runtime:legacy .
```

The default image is required; the legacy image is optional and only
needed for the compatibility lab's second environment. Deployments
without the legacy image honestly report that environment as
UNAVAILABLE.

## 5. Health checks

`GET /api/health` performs layered, independently measured checks:

| Check | Meaning |
| ----- | ------- |
| `application` | Process is up and serving |
| `database` | Live query round-trip succeeded |
| `sandbox` | Docker is reachable and the runtime image exists (docker mode) |
| `runtime` | Sandbox availability in measured backend terms |

A 200 response with `status: "ok"` means the checked layers answered;
each layer's individual status is in the body. Wire liveness probes to
`application` and readiness probes to `database` + `sandbox`.

## 6. Database migrations and data safety

- Apply migrations with `prisma migrate deploy` during deployment.
- Migrations are additive; existing execution artifacts remain readable
  across upgrades (older artifacts report unknown fields as null).
- Backups are **not** configured by this repository. Configure
  PostgreSQL point-in-time recovery and test restores. Research
  artifacts are stored in the database and are covered by the same
  backups.

## 7. Secrets and credentials

- Keep `AUTH_SECRET`, `DATABASE_URL`, and any future provider
  credentials out of the repository and out of images.
- Quantoo never embeds credentials in execution capsules, artifacts,
  logs, or API responses. If a future hardware provider integration is
  added, its credentials must live in server-side secret storage and
  must never reach the browser or exports.

## 8. Observability

The application logs structured JSON (level, message, context) with
secrets and user code excluded from operational logs. Rate-limit
events, sandbox failures, and execution outcomes are logged with
stable fields. Ship stdout to your log pipeline; latency/error-rate
dashboards are deployment-specific and not preconfigured.

## 9. Verification checklist

After deploying, verify in order:

1. `GET /api/health` returns 200 with `database: "ok"`.
2. Sign up a test account and receive verification email (SMTP must be
   configured by the deployment).
3. Open a problem, execute a program, confirm a judged result.
4. Run a compatibility experiment (requires the legacy image for a
   second environment; otherwise expect honest UNAVAILABLE labels).
5. Confirm rate limits respond 429 on a burst of execution requests
   from one account.

If any step cannot be verified, do not advertise the affected feature
as available.
