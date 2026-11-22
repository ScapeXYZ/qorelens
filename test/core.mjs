import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { bindAccount } from "../src/lens/account.mjs";
import { evidence, emptyMatrix } from "../src/lens/evidence.mjs";
import {
  createReport,
  importReport,
  renderMarkdown,
} from "../src/report/integrity.mjs";
import { verifyBuild } from "../src/report/fingerprint.mjs";
import { selfTest, verifyMessage } from "../src/verify/verdict.mjs";

const read = (name) => readFile(name);
const vectors = JSON.parse(await read("test/vectors/public-vectors.json"));
export async function testVerifier() {
  const result = selfTest(vectors);
  assert.equal(result.verdict, "VERIFIED");
  assert.equal(result.checks.length, 16);
  assert.equal(result.checks.filter((c) => c.valid).length, 6);
  assert.equal(result.checks.filter((c) => !c.valid).length, 10);
  assert.throws(() => evidence("VERIFIED"), /verifier/);
  const row = vectors.message.cases[0];
  const key = vectors.canonical.find(
    (x) => x.address === vectors.message.signer,
  ).publicKey;
  const check = await verifyMessage({
    fixtureResult: result,
    vectors,
    binding: {
      registered: true,
      algorithmId: 1,
      keyBytes: 2592,
      publicKey: "0x" + key,
    },
    signature: row.signature,
    address: vectors.message.signer,
    chainId: vectors.chainId,
    message: new TextDecoder().decode(Buffer.from(row.data, "hex")),
  });
  assert.equal(check.result.verdict, "VERIFIED");
  assert.equal(check.result.classical.valid, true);
  assert.equal(
    check.result.checks.slice(1).filter((x) => x.valid === false).length,
    5,
  );
  await assert.rejects(
    verifyMessage({ fixtureResult: { ...result } }),
    /self-test/,
  );
  return result;
}

export async function testAddress() {
  const row = vectors.message.cases[0];
  const identity = bindAccount(
    {
      bech32Address: vectors.message.signer,
      pubKey: Buffer.from(row.signature.classical.publicKey, "base64"),
    },
    "0x" + "ab".repeat(20),
  );
  assert.equal(identity.classification, "DISTINCT_BY_DERIVATION");
  assert.equal(identity.c, identity.a);
  assert.notEqual(identity.c, identity.d);
}

const distFetch = async (url, alter) =>
  new Response(
    (await read("dist/" + url.pathname.split("/").at(-1))) +
      (alter ? "tampered" : ""),
  );
export async function testReports() {
  const build = await verifyBuild("https://example.invalid/", (url) =>
    distFetch(url, false),
  );
  delete build.vectorText;
  await assert.rejects(
    verifyBuild("https://example.invalid/", (url) =>
      distFetch(url, url.pathname === "/app.css"),
    ),
    /fingerprint mismatch/,
  );
  const results = emptyMatrix();
  results["Verifier self-test"] = await testVerifier();
  const report = await createReport({
    build,
    utc: new Date().toISOString(),
    browser: "Node fixture replay",
    wallet: null,
    scope:
      "Recorded fixture evidence. No wallet requests or chain observations.",
    results,
  });
  const markdown = renderMarkdown(report);
  assert.deepEqual(await importReport(JSON.stringify(report)), report);
  assert.deepEqual(await importReport(markdown), report);
  await assert.rejects(
    importReport(JSON.stringify({ ...report, wallet: { version: "changed" } })),
    /integrity/,
  );
  await assert.rejects(
    importReport(
      markdown
        .replace("# QoreLens evidence", "# QoreLens evidence")
        .replace("Build ", "Build changed "),
    ),
    /differs/,
  );
  return {
    report,
    markdown,
    json: "PASS",
    markdownRoundTrip: "PASS",
    tamper: "PASS",
  };
}
