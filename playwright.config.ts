import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:5000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : [
        {
          command: `cd ../safety-stock-automation && python -c "from app import app; app.run(port=5000, use_reloader=False)"`,
          port: 5000,
          reuseExistingServer: true,
          timeout: 30_000,
        },
        {
          command: "npm run dev",
          port: 3000,
          reuseExistingServer: true,
          timeout: 30_000,
        },
      ],
});

export { API_URL };
