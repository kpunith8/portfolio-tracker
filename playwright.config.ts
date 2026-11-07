import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "next dev tests/integration-app --webpack --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/dashboard",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: "",
      FYERS_APP_ID: "",
      FYERS_SECRET_ID: "",
      FYERS_OWNER_KINDE_ID: "",
    },
  },
});
