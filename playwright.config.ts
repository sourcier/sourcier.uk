import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/e2e",
  outputDir: "./test-results",
  snapshotDir: "./src/e2e/__snapshots__",
  // Folder per platform+arch so baselines are grouped rather than suffixed
  snapshotPathTemplate: `{snapshotDir}/{testFileName}-snapshots/{platform}-${process.arch}/{arg}-{projectName}{ext}`,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [
        ["dot"],
        ["html", { outputFolder: "reports/playwright", open: "never" }],
        ["json", { outputFile: "test-results.json" }],
      ]
    : [
        ["list"],
        ["html", { outputFolder: "reports/playwright", open: "never" }],
      ],
  webServer: {
    // Playwright owns the server lifecycle — no background process juggling needed.
    command: "pnpm serve:dist",
    port: 9000,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: "http://localhost:9000",
    contextOptions: { reducedMotion: "reduce" },
    launchOptions: {
      args: ["--force-prefers-reduced-motion"],
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "desktop-1024",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 900 },
      },
    },
    {
      name: "tablet",
      use: { ...devices["Galaxy Tab S9"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
