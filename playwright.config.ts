import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests against the running development copy (see e2e/README.md).
 * They don't start anything themselves: run the API, worker and `npm run dev` first.
 */
export default defineConfig({
  testDir: "./e2e",
  // Tests share one database, so run them one after another.
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
