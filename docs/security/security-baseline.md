# Security Baseline

> **Status: Phase 2 — Authentication & Security**

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

### Authentication (Phase 2)
- Secure HTTP-only session cookies (HttpOnly, Secure, SameSite=Lax)
- bcrypt password hashing (12 salt rounds)
- Cryptographic token generation for email verification and password reset
- Tokens stored as SHA-256 hashes, single-use, time-limited
- Enumeration protection on login, signup, forgot-password, resend-verification
- Rate limiting on all auth endpoints (in-memory, Redis-swappable)
- Security event audit logging (10 event types)
- Protected route middleware
- Password reset invalidates all user sessions
- Generic error messages across all auth flows

## Not Yet Implemented (Phase 3+)

- Multi-factor authentication (TOTP)
- Passkey support (WebAuthn)
- Account lockout (progressive delays)
- Role-based access control
- API key management
- IP-based anomaly detection

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
