import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:5000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // CI 允許 1 次 retry（偶爾的 flake 不該卡 PR）
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // 雙 reporter：list 提供 streaming 進度（CI 上看哪個 test 卡住），github 提供 annotation
  reporter: process.env.CI ? [["list"], ["github"]] : "html",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // 全域動作 timeout：避免某個 action 永遠卡住
    actionTimeout: 25_000,
    navigationTimeout: 30_000,
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
