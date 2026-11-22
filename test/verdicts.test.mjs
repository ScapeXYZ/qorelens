import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  emptyMatrix,
  evidence,
  invalidKeyReason,
  keyBindingEvidence,
  lenses,
  reasonRequired,
  walletCrossCheckVerdict,
} from "../src/lens/evidence.mjs";
import {
  createReport,
  importReport,
  renderMarkdown,
} from "../src/report/integrity.mjs";

const recorded = JSON.parse(
  await readFile(
    new URL("./fixtures/rc1-verdicts.json", import.meta.url),
    "utf8",
  ),
);

describe("verdict semantics using recorded real session data", () => {
  it.each([
    ["sessionA", "CHAIN-OBSERVED"],
    ["sessionB", "BLOCKED"],
  ])("%s registry result becomes %s", (name, expected) => {
    const fixture = recorded[name];
    expect(fixture.source).toBe("recorded real session data");
    expect(Object.keys(fixture.results).sort()).toEqual([...lenses].sort());
    const row = keyBindingEvidence(fixture.results["Key binding"].binding);
    expect(row.verdict).toBe(expected);
    if (expected === "BLOCKED") expect(row.reason).toBe(invalidKeyReason);
  });

  it.each([
    { registered: false },
    { algorithmId: 0 },
    { keyBytes: 0 },
    { possessionProven: false },
  ])("blocks each invalid key condition in isolation: %j", (condition) => {
    const binding = recorded.sessionA.results["Key binding"].binding;
    expect(keyBindingEvidence({ ...binding, ...condition })).toMatchObject({
      verdict: "BLOCKED",
      reason: invalidKeyReason,
    });
  });

  it("requires a positive valid case for a wallet verification verdict", () => {
    const checks =
      recorded.sessionA.results["Wallet verify cross-check"].checks;
    expect(walletCrossCheckVerdict(checks)).toBe("WALLET-REPORTED");
    expect(
      walletCrossCheckVerdict(
        checks.map((x) => ({ ...x, expected: false, observed: false })),
      ),
    ).toBe("MISMATCH");
    expect(walletCrossCheckVerdict(checks.slice(1))).toBe("BLOCKED");
  });

  it("gives all initial capabilities a reason, including the transaction", () => {
    for (const name of lenses) {
      expect(emptyMatrix()[name]).toMatchObject({
        verdict: "NOT EXERCISED",
        reason: expect.stringMatching(/\S/),
      });
    }
  });

  it.each([...reasonRequired])(
    "rejects blank reasons for %s and preserves real reasons in both exports",
    async (verdict) => {
      const payload = {
        build: { fingerprint: "unit-test" },
        results: { Lens: { verdict, reason: " " } },
      };
      await expect(createReport(payload)).rejects.toThrow(/missing reason/);
      payload.results.Lens = evidence(verdict, {
        reason: "Reason for the outcome",
      });
      const report = await createReport(payload);
      expect(report.schemaVersion).toBe(2);
      expect(await importReport(JSON.stringify(report))).toEqual(report);
      const md = renderMarkdown(report);
      expect(md.split("~~~json")[0]).toContain("Reason for the outcome");
      expect(await importReport(md)).toEqual(report);
    },
  );
});
