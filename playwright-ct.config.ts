import { defineConfig, devices } from "@playwright/experimental-ct-react";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/components",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    ctPort: 3101,
    trace: "on-first-retry",
    ctViteConfig: {
      resolve: {
        alias: [
          {
            find: "next/navigation",
            replacement: path.resolve(
              __dirname,
              "tests/components/mocks/navigation.ts",
            ),
          },
          {
            find: /.*\/app\/dashboard\/market-actions$/,
            replacement: path.resolve(
              __dirname,
              "tests/components/mocks/market-actions.ts",
            ),
          },
        ],
      },
    },
  },
});
