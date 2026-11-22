import { mkdir, writeFile } from "node:fs/promises";
import { testAddress, testReports, testVerifier } from "./core.mjs";

const verifier = await testVerifier();
await testAddress();
const roundTrip = await testReports();
const { report, markdown, ...results } = roundTrip;
await mkdir("artifacts/product", { recursive: true });
await Promise.all([
  writeFile(
    "artifacts/product/fingerprinted-sample.json",
    JSON.stringify(report, null, 2) + "\n",
  ),
  writeFile("artifacts/product/fingerprinted-sample.md", markdown),
  writeFile(
    "artifacts/product/local-results.json",
    JSON.stringify(
      {
        fixtures: verifier.checks.length,
        positives: verifier.checks.filter((x) => x.valid).length,
        negativeControls: verifier.checks.filter((x) => !x.valid).length,
        distinctLaneBinding: "PASS",
        ...results,
        build: report.build,
        integrity: report.integrity,
      },
      null,
      2,
    ) + "\n",
  ),
]);
console.log(
  JSON.stringify({
    fixtureChecks: verifier.checks.length,
    ...results,
    build: report.build.fingerprint,
  }),
);
