import { classifyLaneIdentity } from "../verify/crypto.mjs";
export function bindAccount(native, evm) {
  if (!/^0x[0-9a-f]{40}$/i.test(evm ?? ""))
    throw Error("Invalid EVM-lane account");
  const identity = classifyLaneIdentity(native, evm);
  if (!identity.scheme || identity.classification === "UNRESOLVED")
    throw Error(
      "Native signer public key does not derive its displayed address",
    );
  return identity;
}
