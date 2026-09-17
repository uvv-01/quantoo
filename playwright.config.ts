import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Quantoo end-to-end tests.
 *
 * The web server command reuses the dev server on an already-running
 * instance when REUSEExisting is needed; by default a fresh server is
 * started with QUANTOO_SANDBOX_MODE=host-fallback so tests do not require
 * Docker, exercising the same runner code as the container path.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share a database; keep ordering deterministic
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        port: 3100,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          QUANTOO_SANDBOX_MODE: "host-fallback",
          PORT: "3100",
        },
      },
});
