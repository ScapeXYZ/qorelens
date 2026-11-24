# Network-feature declaration evidence

Checked 2026-11-24 against frozen v1.0.0. The form selections below are operator-supplied. Diana Testnet evidence is scoped to the address associated with each record.

## Hybrid ML-DSA-87 transactions — DECLARE for the native signer

Requires a successful native transaction and a chain-reported `pqc_hybrid_verify` event with `status=verified` for each address declared for this feature. The native signer is `qor1ylgewp0h038mrnslyte4yst20q0zwdhqs7fujv` (registry address `0x27d19705f77c4fb1ce1f22f352416a781e2736e0`). The browser submits through QoreX and observes nonce and balance changes in [session.mjs](../../src/lens/session.mjs#L433-L478). Host RPC captured the events.

| Evidence                                                |    Block | Code | Receipt                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | -------: | ---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo-video session, `pqc_hybrid_verify status=verified` | 10625585 |    0 | [Explorer](https://dashboard.qorechain.io/explorer/tx/5216F3E05807BDEBD8E843E831635FE60316D294FE94DE03690F3C5D520D8DDE) · [host capture](../../evidence/video-session-rpc-verification.json)                                                 |
| rc2 Session A, `pqc_hybrid_verify status=verified`      | 10570113 |    0 | [Explorer](https://dashboard.qorechain.io/explorer/tx/AD56AC8AEAC810C7393C96AD9CD31C55DDDC7ECD3C9C7F96BF6F03D653956E0A) · [manifest](../../evidence/acceptance-manifest.json), host `rc2-session-a/rpc-2026-11-22T19-09-29-399Z/result.json` |
| rc1 Session A, superseded, historical                   | 10559088 |    0 | [Explorer](https://dashboard.qorechain.io/explorer/tx/B839B613A4A1A386730C5B279B41C954C40E81EFB53C9371498EB622C9AB2C91); not needed for declaration                                                                                          |

The `DCCB4273…` candidate was located as an audit reference; it is excluded from the qualifying set. The deployer’s EVM receipt records deployment success. It does not establish a native hybrid verification event for the deployer. All transaction conclusions here are CHAIN-OBSERVED.

## PQC key registration with proof of possession — DECLARE registry state; REQUEST MANUAL REVIEW if transaction required

Requires recorded registry state for each address: `registered=true`, `algorithmId=1`, `keyBytes=2592`, `possessionProven=true`. The signer’s saved [demo report](../../evidence/video-session.json) and [rc2 Session A report](../../evidence/rc2-session-a.json) return exactly `registered=true`, `algorithmId=1`, `keyBytes=2592` and `possessionProven=true`. These are registry fields. The deployment capture `feasibility/evidence/08-probe-deploy.json` records the same wrapper values for deployer `0x2ed58f9428D1A07F70AEF3BF5114330F15934b89` / `qor19m2cl9pg6xs87u9w7wl4z9pnpu2exjufzzxhhj`. [Registry decode and reads](../../src/chain/precompiles.mjs#L30-L54) define the fields. **Registry state only.** No independently identified registration transaction is cited.

## EVM window (incl. scoped) — REMOVE

Requires the window-open transaction hash, block and scope, plus the accepted EVM transaction inside it. The [origin audit](../../evidence/origin-audit.md) documents use of the scaffold window helper. The successful deployment [receipt](https://dashboard.qorechain.io/explorer/tx/0x54029f6dca0b82dbde7a5de5325c5ca9bc88914d46cb17276e6ffdefd58ae36a) is at block 10516811 with EVM status `0x1`. The saved deployment JSON does not identify a window-open receipt, block, or scope. Remove this selection. The saved evidence does not substantiate a window-open transaction or its scope.

## Solidity PQC signature check — REMOVE

Requires a deployed Solidity contract that invokes `pqcVerify` and evidence of that path executing. [QoreLensProbe.sol](../../contracts/QoreLensProbe.sol#L12-L21) forwards `pqcKeyStatus` only. Solidity contract reads the PQC key registry through the precompile; the pqcVerify precompile is exercised by direct eth_call. See [the JavaScript request](../../src/chain/precompiles.mjs#L55) and [its caller](../../src/lens/session.mjs#L371). Remove this selection.

## Solidity PQC key status — ADD

The deployed [QoreLensProbe.sol](../../contracts/QoreLensProbe.sol#L12-L21) at `0x05d2c199925e43767b79a6564542de75fa03f0c5` forwards `pqcKeyStatus` to the registry. The deployment receipt and the saved `Deployed probe` row in the [video report](../../evidence/video-session.json) show deployment and exercise through the wrapper.

## Organizer message

> Could you manually review QoreLens’s existing Diana Testnet evidence? The demo transaction in block 10625585 returned code 0 and emitted `pqc_hybrid_verify status=verified` for our native signer. The signer’s registry fields are `registered=true`, `algorithmId=1`, `keyBytes=2592` and `possessionProven=true`. The deployer’s saved read documents proof-of-possession state. We have registry-state evidence only for registration. Our EVM deployment succeeded at block 10516811; we have the scaffold-helper record and deployment receipt, and would appreciate confirmation of whether an existing window-open transaction and its scope can be attributed. The deployed Solidity probe calls `pqcKeyStatus`; our `pqcVerify` exercise is a direct eth_call. Please advise which of the supported declarations your verifier can substantiate.

## Form changes

Keep Hybrid ML-DSA-87 transactions for the native signer and keep PQC key registration with proof of possession as registry-state evidence. Uncheck EVM window (incl. scoped) and Solidity PQC signature check. Check Solidity PQC key status.
