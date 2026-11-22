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
