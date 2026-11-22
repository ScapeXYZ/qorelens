# QoreLens

**Inspect the wallet. Verify the evidence.** QoreLens is a testnet-only lab for
QoreX on Diana. It separates what the wallet reports, what the chain observes,
and what an independent verifier can prove.

## Live application

[Open QoreLens](https://scapexyz.github.io/qorelens/).

## Five-minute judge path

Use a fresh desktop Chrome profile with the development server stopped. Confirm
**Build verified · c0384c3b74aa**, run the verifier self-test, read the deployed
probe, and try the report export and import. Follow the
[guided fresh-profile test](JUDGE_TEST.md), including its explanation of
[which session an export describes](JUDGE_TEST.md#which-session-does-an-export-describe).

## No wallet? View recorded evidence.

Download the [Session A JSON](evidence/rc2-session-a.json) or
[Markdown](evidence/rc2-session-a.md) and select **Import report**. Recorded rc2
Session A used QoreX v0.4.3 and comes from the same commit as deployed
[v1.0.0][release]. You can inspect the record without wallet permissions.

## Requirements and evidence

| Requirement           | Evidence                                                                             |
| --------------------- | ------------------------------------------------------------------------------------ |
| Frozen build          | [Release tag][release], [build manifest][fingerprint], [Pages CI][ci]                |
| Independent PQ check  | [Session A report](evidence/rc2-session-a.json), Message signing and Tamper controls |
| Diana probe           | [Probe deployment][probe]                                                            |
| Testnet self-transfer | [rc2 transaction][rc2-tx], block 10570113                                            |
| Historical acceptance | [Phase 0 replay limitation](docs/PHASE_0_ACCEPTANCE.md), [rc1 transaction][rc1-tx]   |

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
