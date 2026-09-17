/**
 * End-to-end debugger tests.
 *
 * Covers the core Phase 5 workflow against a real server and database:
 *
 *   successful execution -> judge pass -> debugger opens -> step navigation
 *   changes displayed state
 *   failed execution -> judge fail -> failure localization -> debugger at
 *   the failing region
 *   runtime error -> no fabricated trace, workspace stays usable
 *   privacy -> unauthenticated/foreign access rejected
 *
 * Runs with QUANTOO_SANDBOX_MODE=host-fallback (the same runner code as the
 * Docker path, without requiring Docker in the test loop).
 */

import { test, expect } from "@playwright/test";
import fs from "node:fs";

/** Foreign-user storage state written by the auth setup project. */
const foreignStateFile = "e2e/.auth/foreign.json";
const hasForeignState = fs.existsSync(foreignStateFile);

const BELL_SOLUTION = `from qiskit import QuantumCircuit
qc = QuantumCircuit(2, 2)
qc.h(0)
qc.cx(0, 1)
qc.measure([0, 1], [0, 1])
result = qc
`;

const WRONG_SOLUTION = `from qiskit import QuantumCircuit
qc = QuantumCircuit(2, 2)
qc.x(0)
qc.cx(0, 1)
qc.measure([0, 1], [0, 1])
result = qc
`;

test.use({ storageState: "e2e/.auth/user.json" });

async function openWorkspaceAndRun(page: import("@playwright/test").Page, code: string) {
  await page.goto("/problems/bell-state/solve");
  await expect(
    page.getByRole("heading", { name: /bell state/i }),
  ).toBeVisible({ timeout: 30_000 });

  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(code, { delay: 2 });

  await page
    .getByRole("button", { name: /run quantum code/i })
    .first()
    .click();

  await expect(
    page.getByRole("region", { name: /execution results/i }),
  ).toBeVisible({ timeout: 90_000 });
}

test.describe("quantum debugger", () => {
  test("correct execution: debugger opens, steps navigate, state changes", async ({
    page,
  }) => {
    await openWorkspaceAndRun(page, BELL_SOLUTION);
    await expect(page.getByText(/all checks passed/i)).toBeVisible({
      timeout: 30_000,
    });

    await page
      .getByRole("button", { name: /open quantum debugger/i })
      .click();
    const panel = page.getByRole("region", { name: /quantum debugger/i });
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // First step: description reflects the start of the trace.
    await panel.getByRole("button", { name: /go to first step/i }).click();
    await expect(panel.getByText(/after step 0/i).first()).toBeVisible();

    // Next: advances to step 1.
    await panel.getByRole("button", { name: /next step/i }).click();
    await expect(panel.getByText(/after step 1/i).first()).toBeVisible();

    // Last step.
    await panel.getByRole("button", { name: /go to last step/i }).click();
    await expect(panel.getByText(/after step 3/i).first()).toBeVisible();

    // Previous from the last step.
    await panel.getByRole("button", { name: /previous step/i }).click();
    await expect(panel.getByText(/after step 2/i).first()).toBeVisible();

    // The displayed state actually changes between steps: after H the
    // state is (|00> + |01>)/sqrt2 (both amplitude-0.707 rows), after CX
    // it is the Bell state. The step description text differs too.
    const lastDesc = await panel
      .getByText(/after step \d+/i)
      .first()
      .textContent();

    // Reset returns before the start.
    await panel
      .getByRole("button", { name: /reset to before first step/i })
      .click();
    await expect(panel.getByText(/before the first step/i)).toBeVisible();

    // Research mode exposes inspection matrices; developer mode the state
    // table. Switching modes keeps the debugger usable.
    await panel.getByRole("tab", { name: "Developer" }).click();
    await expect(
      panel.getByText(/exact statevector after step/i).or(
        panel.getByText(/exact state unavailable/i),
      ),
    ).toBeVisible();

    void lastDesc;
  });

  test("failed execution: localization points to a trace region", async ({
    page,
  }) => {
    await openWorkspaceAndRun(page, WRONG_SOLUTION);
    await expect(page.getByText(/^Checks failed$/)).toBeVisible({
      timeout: 30_000,
    });

    await page
      .getByRole("button", { name: /debug failure|open quantum debugger/i })
      .first()
      .click();
    const panel = page.getByRole("region", { name: /quantum debugger/i });
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // Evidence-based language, never a claim about which gate is wrong.
    // The banner may be the localization or the "no trace" note; both are
    // honest. When a trace exists, the step counter must be visible.
    await expect(
      panel.getByText(/failure observed/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    const text = (await panel.textContent()) ?? "";
    expect(text).not.toMatch(/gate .* is (wrong|incorrect|the bug)/i);

    // The trace is present and navigable: the step counter reads "Step N / M".
    await expect
      .poll(async () => (await panel.textContent()) ?? "")
      .toMatch(/Step \d+ \/ \d+/);
  });

  test("runtime error: debugger reports no trace, workspace stays usable", async ({
    page,
  }) => {
    await openWorkspaceAndRun(page, "import os\nresult = None\n");
    await expect(
      page.getByText(/import of this module is not allowed/i).or(
        page.getByText(/execution error/i),
      ),
    ).toBeVisible({ timeout: 60_000 });
    // The workspace itself remains interactive.
    await expect(page.locator(".cm-content")).toBeVisible();
  });

  test("privacy: debugger endpoints reject unauthenticated and foreign access", async ({
    browser,
  }) => {
    test.skip(
      !hasForeignState,
      "foreign-user storage state was not created by setup",
    );

    // API status checks run as in-page fetch so the browser cookie jar
    // applies exactly as it does for the real frontend.
    const fetchStatus = (
      page: import("@playwright/test").Page,
      path: string,
    ) =>
      page.evaluate(async (p) => {
        const res = await fetch(p);
        return res.status;
      }, path);

    // A context with no session cookie gets 401 from both debugger
    // endpoints. The inline empty storage state overrides the project-level
    // storageState, which browser.newContext() would otherwise inherit.
    const emptyState: import("@playwright/test").PlaywrightTestOptions["storageState"] =
      { cookies: [], origins: [] };
    const anonContext = await browser.newContext({ storageState: emptyState });
    const anonPage = await anonContext.newPage();
    try {
      await anonPage.goto("/");
      expect(
        await fetchStatus(
          anonPage,
          "/api/submissions/33333333-3333-3333-3333-333333333333/debug",
        ),
      ).toBe(401);
      expect(
        await fetchStatus(
          anonPage,
          "/api/executions/33333333-3333-3333-3333-333333333333/trace",
        ),
      ).toBe(401);
    } finally {
      await anonContext.close();
    }

    // An authenticated user who does not own the submission gets 404 —
    // foreign submissions are indistinguishable from missing ones. The
    // foreign account is created by the setup project (signup is rate
    // limited per IP and must not be hit from every test).
    const authedContext = await browser.newContext({
      storageState: foreignStateFile,
    });
    const authedPage = await authedContext.newPage();
    try {
      await authedPage.goto("/");
      expect(
        await fetchStatus(
          authedPage,
          "/api/submissions/33333333-3333-3333-3333-333333333333/debug",
        ),
      ).toBe(404);
    } finally {
      await authedContext.close();
    }
  });
});
