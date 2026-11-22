import { readFile } from "node:fs/promises";
import {
  emptyMatrix,
  invalidKeyReason,
  keyBindingEvidence,
} from "../../src/lens/evidence.mjs";
import {
  canonical,
  createReport,
  renderMarkdown,
  sha256,
} from "../../src/report/integrity.mjs";
import { test, expect } from "@playwright/test";

test("Chromium fixture verifier and fingerprinted JSON and Markdown export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status").first()).toContainText(
    "Build verified",
  );
  await page.getByRole("button", { name: "Run verifier self-test" }).click();
  await expect(
    page.getByRole("row", { name: /Verifier self-test/ }),
  ).toContainText("VERIFIED");
  for (const type of ["JSON", "Markdown"]) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download " + type }).click(),
    ]);
    await page.locator("#import").setInputFiles(await download.path());
    await expect(page.locator("#import-status")).toContainText("hash valid");
  }
});

test("MOCK injected provider is refused before signing", async ({ page }) => {
  await page.route("https://evm-testnet.qore.host/", (route) => route.abort());
  await page.addInitScript(() => {
    window.__qorexMock = true;
    window.qorex = { version: "MOCK", native: {}, evm: {} };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Run guided session" }).click();
  await expect(page.getByRole("row", { name: /Network guard/ })).toContainText(
    "Real QoreX native and EVM providers are required",
  );
  await expect(
    page.getByRole("row", { name: /Message signing/ }),
  ).toContainText("NOT EXERCISED");
});

test("recorded real session data: unregistered Key binding renders BLOCKED", async ({
  page,
}) => {
  const { sessionB } = JSON.parse(
    await readFile(
      new URL("../fixtures/rc1-verdicts.json", import.meta.url),
      "utf8",
    ),
  );
  const results = emptyMatrix();
  results["Key binding"] = keyBindingEvidence(
    sessionB.results["Key binding"].binding,
  );
  const report = await createReport({
    build: { fingerprint: "fixture" },
    results,
  });
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("Build verified");
  await page.locator("#import").setInputFiles({
    name: "recorded-session-b.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(report)),
  });
  const imported = page.locator("#imported");
  await expect(imported).toContainText(invalidKeyReason);
  const rendered = JSON.parse(await imported.textContent());
  expect(rendered.results["Key binding"].verdict).toBe("BLOCKED");
  expect(rendered.results["Hybrid transaction"]).toMatchObject({
    verdict: "NOT EXERCISED",
    reason: expect.stringMatching(/\S/),
  });
});

test("legacy rc1 JSON and Markdown show schema and fingerprint notices", async ({
  page,
}) => {
  const body = {
    schema: "qorelens-report-v1",
    build: { commit: "fixture", fingerprint: "rc1-fixture" },
    results: { "Hybrid transaction": { verdict: "NOT EXERCISED" } },
  };
  const report = {
    ...body,
    integrity: { algorithm: "SHA-256", digest: await sha256(canonical(body)) },
  };
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("Build verified");
  for (const [name, text] of [
    ["legacy.json", JSON.stringify(report)],
    ["legacy.md", renderMarkdown(report)],
  ]) {
    await page.locator("#import").setInputFiles({
      name,
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
    await expect(page.locator("#import-status")).toContainText(
      "Legacy schema (rc1)",
    );
    await expect(page.locator("#import-status")).toContainText(
      "Build fingerprint differs",
    );
  }
});
