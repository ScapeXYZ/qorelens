import { test } from "vitest";
import { testAddress, testReports, testVerifier } from "./core.mjs";

test(
  "published PQ fixtures, ADR-36 and all five live-path controls",
  testVerifier,
);
test(
  "independent signer binding permits distinct EVM-lane addresses",
  testAddress,
);
test(
  "build fingerprint, JSON and Markdown round trips and tamper rejection",
  testReports,
);
