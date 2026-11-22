const allowed = new Set([
  "CHAIN-OBSERVED",
  "WALLET-REPORTED",
  "ADVERTISED-ONLY",
  "UNSUPPORTED",
  "MISMATCH",
  "NOT EXERCISED",
  "BLOCKED",
]);
export const reasonRequired = new Set([
  "NOT EXERCISED",
  "BLOCKED",
  "UNSUPPORTED",
  "MISMATCH",
  "ADVERTISED-ONLY",
]);
export const verdicts = new Set([...allowed, "VERIFIED"]);

export function withReason(row, fallback) {
  if (!reasonRequired.has(row.verdict)) return row;
  return { ...row, reason: row.reason || fallback };
}

export function evidence(verdict, details = {}) {
  if (!allowed.has(verdict))
    throw Error("Independent verifier owns the VERIFIED verdict");
  return withReason(
    { ...details, verdict },
    details.error || details.observed || "Capability was not run",
  );
}
export const lenses = [
  "Network guard",
  "Provider diagnostics",
  "Verifier self-test",
  "Message signing",
  "Tamper controls",
  "Key binding",
  "Wallet verify cross-check",
  "Hybrid transaction",
  "Deployed probe",
  "Diana precompile",
  "signDirect",
  "eth_sendTransaction",
  "wallet_sendCalls",
  "Atomic calls",
];
export const emptyMatrix = () =>
  Object.fromEntries(lenses.map((name) => [name, evidence("NOT EXERCISED")]));

export const invalidKeyReason =
  "Signer has no valid ML-DSA-87 key registered on Diana";
export const validBinding = (binding) =>
  binding.registered === true &&
  binding.algorithmId === 1 &&
  binding.keyBytes === 2592 &&
  binding.possessionProven === true;

export function keyBindingEvidence(binding) {
  return evidence(validBinding(binding) ? "CHAIN-OBSERVED" : "BLOCKED", {
    evidenceClass: "INDEPENDENT",
    observed: "Native signer registry read",
    binding,
    ...(validBinding(binding) ? {} : { reason: invalidKeyReason }),
  });
}

export function walletCrossCheckVerdict(checks) {
  if (
    checks.some(
      (x) => typeof x.observed === "boolean" && x.observed !== x.expected,
    )
  )
    return "MISMATCH";
  if (
    checks.length !== 3 ||
    checks.some((x) => typeof x.observed !== "boolean")
  )
    return "BLOCKED";
  return checks[0].observed === true ? "WALLET-REPORTED" : "MISMATCH";
}
