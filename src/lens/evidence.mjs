const allowed = new Set([
  "CHAIN-OBSERVED",
  "WALLET-REPORTED",
  "ADVERTISED-ONLY",
  "UNSUPPORTED",
  "MISMATCH",
  "NOT EXERCISED",
  "BLOCKED",
]);
export function evidence(verdict, details = {}) {
  if (!allowed.has(verdict))
    throw Error("Independent verifier owns the VERIFIED verdict");
  return { ...details, verdict };
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
];
export const emptyMatrix = () =>
  Object.fromEntries(lenses.map((name) => [name, evidence("NOT EXERCISED")]));
