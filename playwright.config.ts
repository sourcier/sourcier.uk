import { defineConfig } from "@playwright/test";

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
    browserName: "chromium",
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    baseURL: "http://localhost:9000",
    contextOptions: { reducedMotion: "reduce" },
    launchOptions: {
      args: ["--force-prefers-reduced-motion"],
    },
  },
  projects: [
    {
      name: "mobile-s",
      testMatch: "visual.spec.ts",
      use: {
        viewport: { width: 320, height: 900 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-m",
      testMatch: "visual.spec.ts",
      use: {
        viewport: { width: 375, height: 900 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-l",
      testMatch: "visual.spec.ts",
      use: {
        viewport: { width: 425, height: 900 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet",
      testMatch: "visual.spec.ts",
      use: {
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop-s",
      testMatch: "visual.spec.ts",
      use: { viewport: { width: 1024, height: 900 } },
    },
    {
      name: "desktop-m",
      testMatch: "visual.spec.ts",
      use: { viewport: { width: 1280, height: 900 } },
    },
    {
      name: "desktop-l",
      testMatch: "visual.spec.ts",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "responsive",
      testMatch: "responsive.spec.ts",
      use: { viewport: { width: 1280, height: 900 } },
    },
  ],
});
