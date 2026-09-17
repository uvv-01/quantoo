/**
 * Authentication setup for the debugger E2E suite.
 *
 * Creates one shared account and persists its session as Playwright
 * storage state. Doing this once per run (rather than per test) keeps the
 * suite well inside the signup/login rate limits, which are real product
 * behavior and not something the tests should fight.
 */

import { test as setup } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const authDir = path.join(__dirname, ".auth");
const authFile = path.join(authDir, "user.json");
const foreignFile = path.join(authDir, "foreign.json");

/**
 * The foreign user must be distinct from the owner user. Signup is rate
 * limited per IP, so the two accounts are created in one setup pass and
 * reused across runs; sessions are simply re-established when missing.
 */
const FOREIGN_EMAIL = "e2e-foreign-user@example.com";

setup("create and authenticate a test account", async ({ request }) => {
  // Reuse an existing session across runs: a valid stored state means the
  // suite stays far away from the signup/login rate limits.
  if (fs.existsSync(authFile)) {
    try {
      const stored = JSON.parse(fs.readFileSync(authFile, "utf8"));
      const hasSession = (stored.cookies ?? []).some(
        (c: { name: string }) => c.name === "quantoo-session",
      );
      if (hasSession && fs.existsSync(foreignFile)) return;
    } catch {
      // Corrupt state file: recreate it below.
    }
  }

  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "correct-horse-42";

  const signup = await request.post("/api/auth/signup", {
    data: { email, password, confirmPassword: password },
  });
  if (!signup.ok()) {
    const body = await signup.text();
    // An existing account is acceptable (rerun); anything else is a failure.
    if (!/already exists/i.test(body)) {
      throw new Error(`signup failed (${signup.status()}): ${body}`);
    }
  }

  const login = await request.post("/api/auth/login", {
    data: { email, password },
  });
  if (!login.ok()) {
    throw new Error(`login failed (${login.status()})`);
  }

  fs.mkdirSync(authDir, { recursive: true });
  await request.storageState({ path: authFile });

  // Foreign user: create if needed, sign in, persist as a separate state.
  const foreignSignup = await request.post("/api/auth/signup", {
    data: { email: FOREIGN_EMAIL, password, confirmPassword: password },
  });
  if (!foreignSignup.ok()) {
    const body = await foreignSignup.text();
    if (!/already exists/i.test(body)) {
      throw new Error(
        `foreign signup failed (${foreignSignup.status()}): ${body}`,
      );
    }
  }
  const foreignLogin = await request.post("/api/auth/login", {
    data: { email: FOREIGN_EMAIL, password },
  });
  if (!foreignLogin.ok()) {
    throw new Error(`foreign login failed (${foreignLogin.status()})`);
  }
  await request.storageState({ path: foreignFile });
});
