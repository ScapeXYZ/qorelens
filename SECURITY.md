# Security

QoreLens requests consent before every wallet bridge call. Diana is pinned and the native signer is derived and checked separately from the EVM-lane account. The only transfer is a fee-checked 1 uqor self-transfer.

The public Diana EVM RPC is trusted for chain observations. Wallet returns are untrusted until independently verified, and a passing local fixture self-test is required for VERIFIED. Build fingerprints and report hashes detect changes within their stated scope. They do not authenticate an origin or report author. Imported evidence stays separate from live results.

Never share keys or mnemonics. Keep local credentials in the ignored .env.local or in the wallet.
