# Authentication Architecture

## Overview

Quantum Daily implements a production-quality authentication system built on:

- Secure HTTP-only session cookies
- bcrypt password hashing (12 salt rounds)
- Cryptographic token generation for email verification and password reset
- Rate limiting on all authentication endpoints
- Security event audit logging

## Architecture

```
Client Request
     ↓
Next.js Middleware (cookie presence check → redirect)
     ↓
API Route (input validation via Zod)
     ↓
Rate Limit Check (per-IP, per-action)
     ↓
Auth Service (business logic)
     ↓
Prisma ORM → PostgreSQL
```

## Components

### `lib/auth/`

| File | Purpose |
|------|---------|
| `validation.ts` | Zod schemas for all auth forms |
| `password.ts` | bcrypt hashing and verification |
| `tokens.ts` | Cryptographic token generation and SHA-256 hashing |
| `session.ts` | Session creation, validation, and destruction |
| `service.ts` | Core auth business logic (signup, login, verify, reset) |
| `email.ts` | Email service abstraction (dev: console, prod: SMTP) |
| `rate-limit.ts` | In-memory rate limiter (dev-friendly, swappable for Redis) |
| `security-events.ts` | Security event audit logging |
| `middleware.ts` | Route protection helpers |

## Password Storage

Passwords are hashed using **bcrypt** with 12 salt rounds:

```
Plaintext → bcrypt.hash(password, 12) → Storage Hash
```

- Never stored in plaintext
- Never logged
- Each hash has a unique salt
- Verification uses constant-time `bcrypt.compare()`

## Session Management

Sessions use **HTTP-only cookies**:

```
Cookie: quantoo-session=<token>
  HttpOnly: true
  Secure: true (production)
  SameSite: Lax
  Path: /
  MaxAge: 30 days
```

### Flow

1. Login succeeds → generate cryptographically random token (32 bytes)
2. Store SHA-256 hash of token in `sessions` table
3. Set raw token in HTTP-only cookie
4. On each request: hash cookie token, look up in database, check expiry
5. Logout: delete session from database, clear cookie

### Session Revocation

- Logout removes the current session
- Password reset invalidates ALL sessions for the user
- Future: session listing and individual revocation

## Email Verification

### Signup Flow

1. User signs up with email + password
2. System creates user with `emailVerified: null`
3. System generates a cryptographically random token (32 bytes)
4. System stores SHA-256 hash of token with 24-hour expiry
5. System sends verification email with raw token in URL
6. User clicks link → `GET /api/auth/verify-email?token=...`
7. System hashes token, looks up in database, validates expiry and single-use
8. On success: marks `emailVerified` and consumes token

### Resend Verification

- Invalidates any existing unused tokens
- Generates a new token and sends a new email
- Rate limited (3 per hour per IP)
- Always returns a generic message (prevents enumeration)

## Password Reset

### Flow

1. User requests reset at `/forgot-password`
2. System generates token, stores hash, sends email
3. Always returns the same response (enumeration protection)
4. User clicks link → `/reset-password?token=...`
5. User enters new password
6. System validates token, hashes new password, updates user
7. **All existing sessions are invalidated** (security measure)
8. User must log in again

### Token Properties

- Cryptographically random (32 bytes / 256 bits)
- Stored as SHA-256 hash
- 1-hour expiry
- Single-use (consumed on successful reset)
- Previous tokens invalidated when new one is requested

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 requests | 15 minutes |
| Signup | 3 requests | 1 hour |
| Forgot Password | 3 requests | 1 hour |
| Reset Password | 5 requests | 1 hour |
| Resend Verification | 3 requests | 1 hour |

**Implementation note:** The current rate limiter is in-memory and single-process. For production multi-server deployments, replace with Redis-backed rate limiting. The abstraction (`checkRateLimit`) supports this swap.

## Enumeration Protection

All authentication endpoints use generic responses:

- Login: "Invalid email or password." (not "user not found" or "wrong password")
- Signup: "An account with this email already exists." (after hashing the password to prevent timing attacks)
- Forgot Password: "If an account with that email exists, you'll receive instructions shortly."
- Resend Verification: "If an account with that email exists and needs verification, a new link has been sent."

## Security Event Logging

The following events are logged to the `security_events` table:

- `SIGNUP_SUCCESS`
- `LOGIN_SUCCESS`
- `LOGIN_FAILURE`
- `LOGOUT`
- `EMAIL_VERIFIED`
- `VERIFICATION_REQUESTED`
- `PASSWORD_RESET_REQUESTED`
- `PASSWORD_RESET_SUCCESS`
- `PASSWORD_CHANGED`
- `SESSION_REVOKED`

Events include: `userId`, `ipAddress`, `userAgent`, `metadata` (where safe), and `createdAt`.

**Never logged:** passwords, password hashes, raw tokens, session IDs, reset URLs.

## Environment Variables

```bash
AUTH_SECRET="..."   # Minimum 32 characters, change for production
APP_URL="..."       # Used in email links
EMAIL_FROM="..."    # Sender address for emails
SMTP_HOST="..."     # Optional: SMTP server for production email
```

## Future Enhancements (Not Implemented)

- Two-factor authentication (TOTP)
- Passkeys / WebAuthn
- Active session management UI
- Security key support
- Recovery codes
- Trusted devices
- Multiple verified emails
- Security notification emails
