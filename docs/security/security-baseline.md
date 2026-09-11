# Security Baseline

> **Status: Phase 1 — Foundation**

## Overview

This document describes the security baseline established in Phase 1. This is a starting point, not a production security certification.

## Implemented

### Environment Validation
- All environment variables validated at startup using Zod
- Production builds fail with invalid configuration
- Secrets never logged or exposed in responses

### Secure Error Handling
- Application error boundary catches and logs client errors
- Server errors return sanitized messages (no stack traces, database errors, or secrets)
- API responses use consistent error format

### Input Validation
- Zod schemas for API input validation
- Prisma parameterized queries prevent SQL injection
- No raw SQL queries

### Frontend Security
- Content Security Policy headers (via Next.js defaults)
- XSS prevention through React's automatic escaping
- No `dangerouslySetInnerHTML` without sanitization
- CSRF protection through same-origin requests

### Dependency Security
- Dependencies audited periodically
- No known critical vulnerabilities in direct dependencies
- `.gitignore` prevents committing secrets and build artifacts

### Access Control
- Server/client boundary discipline
- No sensitive data in client bundles
- Environment variables with `NEXT_PUBLIC_` prefix are safe to expose

## Not Yet Implemented (Phase 2+)

- Authentication and session management
- Multi-factor authentication
- Passkey support
- Rate limiting
- Account lockout
- Email verification
- Password reset
- Role-based access control
- API key management

## Guidelines

### Never Commit
- API keys, passwords, database credentials
- Private keys, OAuth secrets, session secrets
- `.env` files (only `.env.example` is committed)
- Tokens, certificates

### Never Expose
- Stack traces to end users
- Database schema or query errors
- Internal file paths
- Environment variable values (except `NEXT_PUBLIC_*`)
- Prisma query details

### Logging Rules
- Never log: passwords, tokens, secrets, API keys, credentials
- Always log: request IDs, user IDs (where safe), event types, severity
- Use structured JSON logging for machine parsing
