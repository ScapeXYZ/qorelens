# Security

QoreLens runs on Diana testnet. Before forwarding a wallet request, it displays
the exact payload for consent. The guard checks the Diana EVM chain ID and
binds the native signer separately from the EVM-lane account. The guided
transfer is a fee-checked `1 uqor` native self-transfer. Signing and sending
require a real wallet and the session guard.

The hosted CSP allows scripts, styles and fonts from the application origin,
and connections to that origin and Diana EVM RPC. The tested hosted release
detected real QoreX without wallet requests during the compatibility check.

A single public Diana EVM RPC supplies app chain observations. Recorded browser native REST and consensus RPC requests failed during CORS checks. Native transaction events and fees were inspected via host-side RPC. The native and EVM lanes are DISTINCT_BY_DERIVATION in the recorded run. The wallet did not return a PQ public key from signArbitrary. The verifier used the chain-read key. Wallet results are wallet-reported.
**VERIFIED** requires the independent verifier. A chain PQC event reports
what the chain observed. Transaction signing preimages and signature bytes
were not independently verified.

Build fingerprints detect asset changes within the verified build. Report
digests detect changes to canonical report content. Neither digest establishes
the identity of an author. Imported evidence stays separate from live results.

Keep testnet secrets in the wallet or ignored `.env.local`. Omit credentials,
private keys, and mnemonics from evidence and public issues.

Use [GitHub private vulnerability reporting](https://github.com/ScapeXYZ/qorelens/security/advisories/new) if enabled. Otherwise contact the repository maintainer privately.
Include the affected release, reproducible observations, and redacted evidence.
