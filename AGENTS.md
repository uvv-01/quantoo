# AGENTS.md — Non-Obvious Learnings

## Project Structure

- `lib/auth/session.ts` exports `getAuthenticatedUser()` (not `getSessionUser`). Returns `{ id, email, emailVerified, ... }` or `null`.
- The Prisma seed script (`prisma/seed.ts`) uses `npx tsx` to run TypeScript directly. The `package.json` `prisma.seed` field is configured for this.
- ESLint has `react-hooks/set-state-in-effect` rule enabled. Avoid calling `setState` directly in `useEffect` bodies — use an async function with a `cancelled` flag pattern instead.

## Database

- Prisma schema requires both sides of a relation to be defined. If you add a relation field on model A pointing to model B, model B must have the corresponding reverse relation field, or `prisma generate` will fail.
- When using `prisma.$transaction`, all operations in the array execute atomically. Use this for operations that must succeed or fail together (e.g., consuming a token + marking verified).
- `prisma.problem.findUnique` with a compound `where` on `@@unique` fields requires `where: { field1_field2: { ... } }` syntax (underscore-joined).

## Testing

- React client components with `useEffect` + `fetch` cause `act(...)` warnings in tests because the async state updates happen outside `act`. This is expected behavior with React Testing Library — the tests still pass and assertions work correctly.
- The `@testing-library/react@16` requires `@testing-library/dom` as an explicit peer dependency.
- Vitest runs in `jsdom` environment. Server-side modules (Prisma, Next.js server actions) are not available in unit tests — test the logic in isolation, not the full stack.

## Build & Lint

- `npm run build` uses Turbopack by default with Next.js 16. Build output shows routes as `○` (static) or `ƒ` (dynamic).
- ESLint config uses flat config (`eslint.config.mjs`), not `.eslintrc`. New rules can be added there.
- TypeScript strict mode is enabled. All new files must be fully typed — no implicit `any`.

## Authentication

- Session cookie name is `quantoo-session`. The middleware checks for this cookie's presence (fast check) while full validation happens server-side.
- Password reset invalidates ALL sessions for the user, not just the current one.
- Rate limiting is in-memory only (not Redis). Document this limitation for future distributed deployment.

## Content Architecture

- Problem `testSpecification` JSON field stores test cases for the future Judge (Phase 4). It is NOT executed in Phase 3 — it is pure data.
- `ProblemRelation` uses `fromId`/`toId` with a `type` enum. PREREQUISITE means "fromId requires toId". NEXT means "fromId comes before toId".
- Concept slugs must be unique and lowercase-hyphenated. Tag slugs follow the same convention.
- The seed script (`prisma/seed.ts`) cannot use template literals with backticks inside them for long strings — use a `lines()` helper with regular string concatenation instead.
