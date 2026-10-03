import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";

const isCI = Boolean(process.env.CI);
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || "http://127.0.0.1:3100";

const mobileProject = (name: string, width: number, height: number) => ({
  name,
  testMatch: /mobile\.spec\.ts/,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  },
});

const visualProject = (name: string, width: number, height: number, isMobile = false) => ({
  name,
  testMatch: /visual\.spec\.ts/,
  testIgnore: isMobile ? undefined : /mobile-visual\.spec\.ts/,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile,
    hasTouch: isMobile,
    colorScheme: "light" as const,
    reducedMotion: "reduce" as const,
  },
});

export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 7_500,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.005,
      animations: "disabled",
      caret: "hide",
      stylePath: join(__dirname, "e2e", "visual", "screenshot.css"),
    },
  },
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: isCI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: isCI ? "on-first-retry" : "off",
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [/mobile\.spec\.ts/, /visual\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    mobileProject("mobile-320", 320, 720),
    mobileProject("mobile-375", 375, 812),
    mobileProject("mobile-414", 414, 896),
    visualProject("visual-desktop", 1440, 900),
    visualProject("visual-mobile-320", 320, 720, true),
    visualProject("visual-mobile-375", 375, 812, true),
    visualProject("visual-mobile-414", 414, 896, true),
  ],
});
