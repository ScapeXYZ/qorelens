import { ripemd160 } from "@noble/hashes/legacy.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bech32 } from "@scure/base";
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { verifyVectors, utf8, base64, hexString } from "./vector-checks.mjs";

export const verifyPq = (key, bytes, signature) =>
  ml_dsa87.verify(signature, bytes, key, { context: new Uint8Array() });

const encodeBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

export function encodeSelfTransfer(address) {
  const value = MsgSend.fromPartial({
    fromAddress: address,
    toAddress: address,
    amount: [{ denom: "uqor", amount: "1" }],
  });
  return {
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: encodeBase64(MsgSend.encode(value).finish()),
  };
}

export function verifyAdr36(component, signer, data) {
  if (component?.keyType !== "secp256k1")
    throw new Error("Unsupported ADR-36 classical key type");
  const signDoc = {
    account_number: "0",
    chain_id: "",
    fee: { amount: [], gas: "0" },
    memo: "",
    msgs: [
      { type: "sign/MsgSignData", value: { data: encodeBase64(data), signer } },
    ],
    sequence: "0",
  };
  return {
    valid: secp256k1.verify(
      base64(component.signature),
      sha256(utf8(JSON.stringify(signDoc))),
      base64(component.publicKey),
      { prehash: false },
    ),
  };
}

export function qorAddressHex(address) {
  const decoded = bech32.decode(address);
  const bytes = bech32.fromWords(decoded.words);
  if (decoded.prefix !== "qor" || bytes.length !== 20)
    throw new Error("Invalid QoreChain native address");
  return "0x" + hexString(bytes);
}

export function classifyLaneIdentity(key, evmAccount) {
  const c = qorAddressHex(key.bech32Address);
  const d = evmAccount.toLowerCase();
  const pk =
    typeof key.pubKey === "string"
      ? base64(key.pubKey)
      : Uint8Array.from(key.pubKey ?? []);
  if (pk.length !== 33 || ![2, 3].includes(pk[0]))
    throw Error(
      "Native getKey did not provide a compressed secp256k1 public key",
    );
  const point = secp256k1.Point.fromHex(hexString(pk));
  const a = "0x" + hexString(ripemd160(sha256(pk)));
  const b =
    "0x" + hexString(keccak_256(point.toBytes(false).slice(1)).slice(-20));
  const scheme = c === a ? "HASH160" : c === b ? "KECCAK256" : null;
  const classification = !scheme
    ? "UNRESOLVED"
    : c === d
      ? "SAME_ACCOUNT"
      : scheme === "HASH160"
        ? "DISTINCT_BY_DERIVATION"
        : "ACCOUNT_SELECTION_MISMATCH";
  const nativeKey = {
    algo: key.algo,
    pubKey: Array.from(pk),
    address: key.address,
    bech32Address: key.bech32Address,
  };
  for (const [name, value] of Object.entries(key)) {
    if (
      /eth|evm/i.test(name) &&
      typeof value === "string" &&
      /^(0x)?[0-9a-f]{40}$/i.test(value)
    )
      nativeKey[name] = value;
  }
  return {
    classification,
    scheme,
    a,
    b,
    c,
    d,
    addressesEqual: c === d,
    nativeKey,
    evidenceClass: "INDEPENDENT",
    inputsClass: "WALLET-REPORTED",
  };
}
