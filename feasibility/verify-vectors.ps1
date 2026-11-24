$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (Test-Path -LiteralPath 'evidence/qoresign-vector-verification.json') { throw 'Vector evidence already exists' }
$program = @'
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const evidence = resolve("evidence/qoresign-vector-verification.json");
const source = "https://github.com/qorechain/qoresign.git";
const vectorPath = "vectors/qoresign-v1.json";
const preserved = readFileSync("C:/dev/qorelens/feasibility/evidence/qoresign-v1.json");
const git = (args, cwd = process.cwd()) => execFileSync("git", args, { cwd, timeout: 60000, maxBuffer: 12_000_000 });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const scratch = mkdtempSync(join(tmpdir(), "qorelens-qoresign-origin-"));
const output = { source, vectorPath, preservedSha256: sha(preserved),
  acquisition: "The saved download command used main and recorded no commit or tag.", scratch };
try {
  const deployedExpected = "8444b1c39b5f4b2419055d704288656989193c80ac5e104adfb109242d15674e";
  const deployed = git(["-c", "safe.directory=" + process.cwd(), "show", "v1.0.0:test/vectors/public-vectors.json"]);
  output.deployedSha256 = sha(deployed);
  assert.equal(output.deployedSha256, deployedExpected);
  git(["clone", "--no-checkout", source, scratch]);
  const at = (args) => git(args, scratch);
  const candidates = at(["log", "--all", "--format=%H", "--", vectorPath]).toString().trim().split(/\s+/).filter(Boolean);
  output.matches = [];
  for (const commit of candidates) {
    let bytes;
    try { bytes = at(["show", commit + ":" + vectorPath]); } catch { continue; }
    if (sha(bytes) !== output.preservedSha256) continue;
    const files = at(["ls-tree", "--name-only", commit]).toString().trim().split(/\r?\n/);
    const notices = files.filter((n) => /^(?:LICENSE|LICENCE|COPYING|NOTICE)(?:[.-].*)?$/i.test(n));
    output.matches.push({ commit, tagsPointingAtCommit: at(["tag", "--points-at", commit]).toString().trim().split(/\r?\n/).filter(Boolean),
      notices: Object.fromEntries(notices.map(n => [n, at(["show", commit + ":" + n]).toString("utf8")])) });
  }
  const upstream = JSON.parse(preserved);
  const product = JSON.parse(deployed);
  const changes = [];
  function compare(a, b, path = "") {
    if (a && b && typeof a === "object" && typeof b === "object") {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const next = path ? path + "." + key : key;
        if (!Object.hasOwn(b, key)) changes.push({ path: next, kind: "omitted" });
        else if (!Object.hasOwn(a, key)) changes.push({ path: next, kind: "added" });
        else compare(a[key], b[key], next);
      }
    } else if (a !== b) changes.push({ path, kind: "changed" });
  }
  compare(upstream, product);
  output.transform = changes;
  output.status = output.matches.length ? "CONTENT MATCH; review notices and revision provenance" : "OPEN: no exact upstream blob match";
  output.revisionCaveat = "Exact bytes establish a matching upstream version, not the exact main-branch HEAD at download time. Multiple commits may carry identical bytes.";
  if (!output.matches.length) process.exitCode = 1;
} catch (error) {
  output.status = "OPEN";
  output.error = String(error);
  process.exitCode = 1;
}
writeFileSync(evidence, JSON.stringify(output, null, 2) + "\n", { flag: "wx" });
console.log(output.status + " " + evidence);

'@
$program | node --input-type=module -
exit $LASTEXITCODE
