import { verifyPq, verifyAdr36 } from "./crypto.mjs";
import {
  verifyVectors,
  base64,
  hex,
  hexString,
  framed,
  utf8,
  controls,
} from "./vector-checks.mjs";
import { sha256 } from "../report/integrity.mjs";

const passingFixtures = new WeakSet();
export function selfTest(vectors) {
  const checks = verifyVectors(vectors, verifyPq);
  const pass = checks.length === 16 && checks.every((check) => check.matches);
  const result = {
    verdict: pass ? "VERIFIED" : "MISMATCH",
    evidenceClass: "INDEPENDENT",
    scope:
      "Published PQ verification cases and five negative controls per arbitrary message",
    checks,
  };
  if (pass) passingFixtures.add(result);
  return result;
}

export async function verifyMessage({
  fixtureResult,
  vectors,
  binding,
  signature,
  address,
  chainId,
  message,
  signerPublicKey,
}) {
  if (!passingFixtures.has(fixtureResult))
    throw Error("The verifier fixture self-test must pass in this session");
  if (
    !binding?.registered ||
    binding.algorithmId !== 1 ||
    binding.keyBytes !== 2592
  )
    throw Error("Native signer has no registered ML-DSA-87 key");
  const key = hex(binding.publicKey.slice(2));
  if (key.length !== 2592 || signature?.pq?.algorithmId !== 1)
    throw Error("Unexpected ML-DSA-87 key or signature algorithm");
  const sig = base64(signature.pq.signature);
  if (sig.length !== 4627)
    throw Error("Expected a 4,627-byte ML-DSA-87 signature");
  const data = utf8(message),
    bytes = framed(data, chainId);
  const wrong = vectors.canonical
    .map((x) => hex(x.publicKey))
    .find((x) => hexString(x) !== hexString(key));
  const cases = [{ name: "valid" }, ...controls(data, chainId, sig, wrong)].map(
    (c) => ({
      ...c,
      key: c.key ?? key,
      bytes: c.bytes ?? bytes,
      signature: c.signature ?? sig,
    }),
  );
  const checks = cases.map((c) => {
    const start = performance.now();
    try {
      return {
        name: c.name,
        valid: verifyPq(c.key, c.bytes, c.signature),
        ms: performance.now() - start,
      };
    } catch (error) {
      return {
        name: c.name,
        error: String(error),
        ms: performance.now() - start,
      };
    }
  });
  let classical;
  try {
    classical = verifyAdr36(signature.classical, address, data);
    if (signerPublicKey)
      classical.keyMatchesSigner =
        hexString(base64(signature.classical.publicKey)) ===
        hexString(Uint8Array.from(signerPublicKey));
  } catch (error) {
    classical = { error: String(error) };
  }
  const agrees =
    signature.pq.publicKey === undefined ||
    hexString(base64(signature.pq.publicKey)) === hexString(key);
  const matches = checks.every((c, i) => c.valid === (i === 0)) && agrees;
  return {
    result: {
      verdict: matches ? "VERIFIED" : "MISMATCH",
      evidenceClass: "INDEPENDENT",
      checks,
      classical,
      keySha256: await sha256(key),
      signatureSha256: await sha256(sig),
      keyMatches: agrees,
      signatureFields: Object.keys(signature),
      signatureBytes: sig.length,
      publicKeyBytes: key.length,
    },
    cases,
    changedMessage: new TextDecoder().decode(
      Uint8Array.from(data, (n, i) => (i === 0 ? n ^ 1 : n)),
    ),
    changedSignature: {
      ...signature,
      pq: {
        ...signature.pq,
        signature: btoa(String.fromCharCode(...cases[2].signature)),
      },
    },
  };
}
