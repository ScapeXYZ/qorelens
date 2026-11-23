# QoreLens

**Advertised capabilities. Verified behavior.**

QoreLens is an open-source, static, testnet-only lab for the QoreX wallet on QoreChain's Diana testnet. It exercises what the wallet advertises, checks the results with its own post-quantum verifier, and exports a reproducible report. Submitted to the **Quantum Pass** track of Build Before Q-Day.

## The problem

Wallet documentation, advertised capability flags and runtime behavior can disagree, and developers lose time finding out which to trust. QoreLens exercises each capability, verifies the output independently of the wallet, and says plainly what could not be verified.

## Why QoreChain

It reads the signer's registered ML-DSA-87 key from Diana's PQC registry and verifies the wallet's signature against it, reads a deployed probe contract, and confirms a real hybrid-signed transaction on Diana testnet.

## Live application

[Open QoreLens](https://scapexyz.github.io/qorelens/).

## Five-minute judge path

Use a fresh desktop Chrome profile. No local setup or server is needed; the app runs from GitHub Pages. Confirm
**Build verified · c0384c3b74aa**, run the verifier self-test, read the deployed
probe, and try the report export and import. Follow the
[guided fresh-profile test](JUDGE_TEST.md), including its explanation of
[which session an export describes](JUDGE_TEST.md#which-session-does-an-export-describe).

## No wallet? View recorded evidence.

Download the [Session A JSON](evidence/rc2-session-a.json) or
[Markdown](evidence/rc2-session-a.md) and select **Import report**. Recorded rc2
Session A used QoreX v0.4.3 and comes from the same commit as deployed
[v1.0.0][release]. You can inspect the record without wallet permissions.

## With QoreX (full run)

Tested with QoreX v0.4.3 set to Diana Testnet, using an account with a registered PQC key and enough testnet QOR for one fee. Click Run guided session. QoreLens shows the exact payload before each request; you approve up to six prompts. Open Message signing and inspect the automatically executed bit-flip tamper test in the evidence drawer. The verifier rejects the modified message. Export the report and compare it with the recorded Session A. The only transaction sent is a 1 uqor self-transfer. If your account is unregistered or unfunded, those rows report BLOCKED or NOT EXERCISED with the reason.

Review each payload before selecting **Continue to QoreX**. Use **Download JSON** or **Download Markdown** to save the report.

## Requirements and evidence

| Requirement                                           | Evidence                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen build                                          | [Release tag][release], [build manifest][fingerprint], [Pages CI][ci]                                                                                                                                                                                                                                                                                      |
| Message signing — VERIFIED (independent verification) | [Session A report](evidence/rc2-session-a.json) records independent ML-DSA-87 signature verification against the chain-read public key and rejection of all five tamper controls.                                                                                                                                                                          |
| Diana probe                                           | [Probe deployment][probe]                                                                                                                                                                                                                                                                                                                                  |
| Hybrid-signed transaction — CHAIN-OBSERVED            | [rc2 transaction][rc2-tx], block 10570113. Submitted through QoreX and accepted by Diana with code `0`. Diana emitted `pqc_hybrid_verify` with `status=verified`. The event was inspected host-side, outside the browser product. Hybrid signing is inferred from chain-reported evidence. Signature bytes and preimages were not independently inspected. |
| Historical acceptance                                 | [Phase 0 replay limitation](docs/PHASE_0_ACCEPTANCE.md), [rc1 transaction][rc1-tx]                                                                                                                                                                                                                                                                         |
| create-qorechain-dapp scaffold                        | Phase 0 recovery transcript `feasibility/evidence/00-scaffold-recovery.txt` records successful Foundry scaffold creation.                                                                                                                                                                                                                                  |
| QoreX connection                                      | [Recorded Session A](evidence/rc2-session-a.json) includes the native and EVM lane evidence and four approvals.                                                                                                                                                                                                                                            |
| Testnet deployment                                    | [Diana probe deployment][probe] and the [hosted CI build][ci]                                                                                                                                                                                                                                                                                              |

QoreLens was built for [Build Before Q-Day](https://build.qorechain.io/).

## How it works and architecture

The static TypeScript app checks its asset hashes before enabling the lenses.
The wallet adapter checks Diana EVM chain ID `0x2648` and binds the native signer
on `qorechain-diana`. An EVM RPC client reads the on-chain key and the Foundry
probe. An independent verifier checks the fixed-message ML-DSA-87 signature
against the chain-read key and rejects five tamper controls. JSON and Markdown
exports contain the same canonical report payload and digest.

## Security and trust

**VERIFIED** requires independent verification. **CHAIN-OBSERVED** and
**WALLET-REPORTED** describe positive evidence from their respective sources.
Non-positive verdicts carry reasons. A report digest checks integrity.
Authorship, origin, and signing time require separate evidence. Imported
evidence stays separate from live results. See [Security](SECURITY.md).

## Limitations

Best viewed at desktop widths (1024 px or more). On narrower screens the matrix scrolls horizontally and the Verdict column may need scrolling.

- Testnet only. The recorded behavior is tied to QoreX v0.4.3.
- The native and EVM addresses in Session A are `DISTINCT_BY_DERIVATION`.
  The native lane did not expose a chain query in that session.
- `signArbitrary` did not return a PQ public key. Verification used the
  registry key. Transaction signature bytes and preimages were not independently
  inspected.
- The app relies on a single public Diana EVM RPC. Browser requests to native
  REST and consensus RPC failed in the recorded CORS checks. Native event and
  fee confirmation used host-side RPC.
- The rc2 transaction is **CHAIN-OBSERVED**. Diana reported a verified PQC event.
  Hybrid signing is inferred from chain-reported evidence. The explorer's
  `0.06 QOR` display matches the `60,000 uqor` fee, while the message sent
  `1 uqor` from the native signer to itself.
- rc1 sessions are **superseded, historical**. Phase 0 evidence is **historical,
  replayed**. The [approved Phase 0 limitation](docs/PHASE_0_ACCEPTANCE.md)
  preserves the original wording.

## Addresses and build

| Item                    | Recorded value                                                     |
| ----------------------- | ------------------------------------------------------------------ |
| Diana probe             | `0x05d2c199925e43767b79a6564542de75fa03f0c5`                       |
| Probe deployer, EVM     | `0x2ed58f9428D1A07F70AEF3BF5114330F15934b89`                       |
| Probe deployer, native  | `qor19m2cl9pg6xs87u9w7wl4z9pnpu2exjufzzxhhj`                       |
| Session A native signer | `qor1ylgewp0h038mrnslyte4yst20q0zwdhqs7fujv`                       |
| Frozen Pages commit     | `613335b03e1c95b587a67fada29031ed415e17de`                         |
| Build fingerprint       | `c0384c3b74aa4495e8d221058d85a68db23f2c250e3664c362a7385be28e4fb4` |
| Bundle SHA-256          | `014ea592456d5a74a989f3f9da0158afb6609defebc7e7c950fc1f61544daa60` |
| Pages CI run            | [45053626379][ci]                                                  |

## Evidence manifest

See the [acceptance manifest](evidence/acceptance-manifest.json),
[AI usage](AI_USAGE.md), [Contributing](CONTRIBUTING.md), and
[post-hackathon backlog](docs/POST_HACKATHON.md).

## License

[MIT](LICENSE).

[ci]: https://github.com/ScapeXYZ/qorelens/actions/runs/45053626379
[fingerprint]: https://scapexyz.github.io/qorelens/fingerprint.json
[release]: https://github.com/ScapeXYZ/qorelens/tree/v1.0.0
[probe]: https://dashboard.qorechain.io/explorer/tx/0x54029f6dca0b82dbde7a5de5325c5ca9bc88914d46cb17276e6ffdefd58ae36a
[rc1-tx]: https://dashboard.qorechain.io/explorer/tx/B839B613A4A1A386730C5B279B41C954C40E81EFB53C9371498EB622C9AB2C91
[rc2-tx]: https://dashboard.qorechain.io/explorer/tx/AD56AC8AEAC810C7393C96AD9CD31C55DDDC7ECD3C9C7F96BF6F03D653956E0A
