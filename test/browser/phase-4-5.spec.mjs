import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const output = "artifacts/product/phase-4-5";
const origin = /^http:\/\/127\.0\.0\.1:\d+\//;

test("responsive screenshots, keyboard drawer, read-only mobile and CSP", async ({
  page,
}) => {
  await mkdir(output, { recursive: true });
  const requests = [];
  const errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(String(error)));
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page
      .locator("#status")
      .waitFor({ state: width === 360 ? "hidden" : "visible" });
    if (width > 680)
      await expect(page.locator("#status")).toContainText("Build verified");
    if (width === 360) {
      await expect(page.locator("#run")).toBeHidden();
      await expect(page.locator("#import")).toBeVisible();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: output + "/qorelens-" + width + ".png",
      fullPage: true,
    });
  }
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to evidence" }),
  ).toBeFocused();
  const lens = page.getByRole("button", {
    name: "Message signing",
    exact: true,
  });
  await lens.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Message signing" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lens).toBeFocused();
  const probe = await page.evaluate(async () => {
    const target = "https://example.invalid/qorelens-csp";
    const violations = [];
    const capture = (event) => {
      violations.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      });
    };
    document.addEventListener("securitypolicyviolation", capture);
    let onViolation;
    let timer;
    const event = new Promise((resolve) => {
      onViolation = (signal) => {
        if (
          signal.effectiveDirective === "connect-src" &&
          [target, new URL(target).origin].includes(signal.blockedURI)
        )
          resolve(true);
      };
      document.addEventListener("securitypolicyviolation", onViolation);
      timer = setTimeout(() => resolve(false), 4000);
    });
    const request = fetch(target, { signal: AbortSignal.timeout(4000) }).then(
      () => ({ rejected: false }),
      (error) => ({ rejected: true, error: String(error) }),
    );
    const [observed, fetchResult] = await Promise.all([event, request]);
    clearTimeout(timer);
    document.removeEventListener("securitypolicyviolation", onViolation);
    document.removeEventListener("securitypolicyviolation", capture);
    return { target, observed, fetchResult, violations };
  });
  const unexpected = requests.filter((url) => !origin.test(url));
  await writeFile(
    output + "/browser-audit.json",
    JSON.stringify(
      {
        requests,
        violations: probe.violations,
        forbiddenProbe: probe,
        unexpectedRequests: unexpected,
        pageErrors: errors,
        keyboard: "PASS",
        walletRequests: 0,
      },
      null,
      2,
    ) + "\n",
  );
  expect(
    probe.observed,
    "The actual connect-src violation event arrived within 4 seconds",
  ).toBe(true);
  expect(probe.fetchResult.rejected).toBe(true);
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("axe WCAG AA accessibility checks at all three widths", async ({
  page,
}) => {
  const axe = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
  const evidence = [];
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(await readFile(axe, "utf8"));
    const report = await page.evaluate(() =>
      window.axe.run({
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      }),
    );
    evidence.push({
      width,
      passes: report.passes.length,
      violations: report.violations.map((x) => ({
        id: x.id,
        impact: x.impact,
        nodes: x.nodes.map((node) => ({
          selectors: node.target,
          failureSummary: node.failureSummary,
        })),
      })),
    });
  }
  await mkdir(output, { recursive: true });
  await writeFile(
    output + "/axe.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  expect(evidence.flatMap((x) => x.violations)).toEqual([]);
});
