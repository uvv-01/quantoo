# Security Policy

## Reporting a vulnerability

Do not open a public issue for security problems. Report privately via
GitHub's *Report a vulnerability* feature on this repository, or contact
the maintainer directly. Include reproduction steps and affected
endpoints. You will receive an acknowledgment and a remediation
timeline. Please do not test against deployments you do not own.

## Security model — what Quantoo protects

Quantoo executes untrusted user code. The defenses below are enforced
in code and verified by automated tests:

**Execution isolation.** Quantum programs run in a per-run sandbox:
in Docker mode each execution is a fresh container with no network,
read-only filesystem, tmpfs scratch, dropped capabilities, and hard
CPU/memory/time/output limits. Host-fallback mode is disabled by
default and, when explicitly enabled, still enforces resource caps and
a restricted process environment. See
[docs/security/execution-security.md](docs/security/execution-security.md).

**Environment control.** Runtime environments are code-defined profiles
mapping to pinned, separately built images. Users can never define
environments, install packages, or supply image references.

**Authentication and authorization.** All state-changing APIs require a
server-side session; ownership is enforced on every private resource
and cross-user access is indistinguishable from not-found. Rate limits
apply to authentication, execution, semantic, compatibility,
observatory, and export endpoints.

**Untrusted imports.** Capsules, compatibility packages, and research
artifacts are validated structurally (schema version, size, depth,
string bounds) and integrity-checked. Importing never executes code,
installs dependencies, or fetches URLs.

**Secret hygiene.** Secrets live in environment variables validated at
boot; `.env` is excluded from version control; capsules, artifacts, and
logs contain technical data only — never credentials, session data, or
environment variables. Error responses expose categories, never stack
traces.

## What remains dependent on deployment infrastructure

Quantoo's in-application defenses do not replace infrastructure
controls. A production deployment is additionally responsible for:

- TLS termination and HSTS configuration at the edge,
- network isolation of the database (the app is the only client),
- Docker daemon hardening — the daemon is a trusted component and its
  compromise bypasses sandbox isolation,
- operating-system-level sandboxing and seccomp profiles for the
  runtime containers,
- secret storage (vault, managed secret manager) rather than plaintext
  environment files,
- backups, monitoring, and incident response.

No system is absolutely secure. The guarantees above are specific,
tested, and bounded; anything outside them is the deployment's
responsibility, not a claim Quantoo makes.

## Scope

In-scope: this repository's application code, sandbox configuration,
API surface, and documentation. Out-of-scope: GitHub infrastructure,
third-party quantum providers (none are integrated yet), and the
security of self-hosted deployments.
