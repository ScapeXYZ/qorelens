import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  testMatch: "**/*.spec.mjs",
  timeout: 25_000,
  globalTimeout: 75_000,
  expect: { timeout: 6_000 },
  use: {
    baseURL: process.env.QORELENS_BROWSER_TEST_URL ?? "http://127.0.0.1:4400",
    actionTimeout: 8_000,
    navigationTimeout: 10_000,
  },
});
