# Batch B claims sweep

**Technical clarification:** Only the message signature is independently verified by QoreLens. The transaction is chain-observed. This distinction was checked in the README, judge guide, project description, YouTube description and pinned-comment draft.

2026-11-24. Reviewed README, the judge guide, AI usage, security, contribution and backlog documents, and the platform text drafts. The scan returned no hits for the directive's prohibited claims or tracking parameters after the wording changes.

| Claim checked               | Evidence and wording used                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope of independent checks | The fixed-message ML-DSA-87 signature is checked against the chain-read key. Transaction outcomes use the separate host RPC capture. [Description](../docs/submission/project-description.md) · [Report](video-session.json) · [RPC](video-session-rpc-verification.json) |
| Tamper tests                | Five deliberately modified inputs were rejected in the recorded run. [Plain-English copy](../docs/submission/plain-english.md) · [Tamper controls](video-session.json)                                                                                                    |
| Hybrid transaction          | CHAIN-OBSERVED. The event is chain-reported and was read host-side. Transaction signature bytes and preimages are outside the independent verification scope. [RPC](video-session-rpc-verification.json)                                                                  |
| Registry                    | The signer is described with literal returned fields. The deployer has recorded proof-of-possession state. No registration transaction is cited. [Badge evidence](../docs/submission/badge-evidence.md)                                                                   |
| EVM window and Solidity     | Window-open receipt remains unidentified. The deployed probe reads registry status. JavaScript calls the signature-verification precompile through a direct eth_call. [Badge evidence](../docs/submission/badge-evidence.md)                                              |
| Report provenance           | The digest checks integrity. The build manifest records provenance. [Implementation](../src/report/integrity.mjs)                                                                                                                                                         |
| Phase 0 and candidate       | Historical replay, and the rejected UI candidate is outside the submission. [Phase 0 limitation](../docs/PHASE_0_ACCEPTANCE.md) · [GitHub evidence](github-remote-post-cleanup-20261124-015733-435.txt)                                                                   |

Addresses, transaction IDs and heights were sourced from the saved reports, deployment receipt and acceptance manifest. The structured [deployment record](deployments.testnet.json) carries the corresponding values. The published docs confirmed the extension defaults to mainnet and the faucet requires sign-in. A current faucet quota and version-specific desktop switch label were not established, so the guide leaves them out.

| Check                             | Result                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Local relative file links         | PASS. Targets exist, including PNGs and the diagram.                                                                            |
| Prettier                          | PASS for formatted submission sources.                                                                                          |
| Original exports                  | All four SHA-256 values match the CP1 ledger.                                                                                   |
| Literal staged secret scan        | PASS on the initial staged set. One ignored local value was compared, zero matching files. Final staging is checked separately. |
| Staged Gitleaks                   | BLOCKED by Windows EPERM in this environment. Requires a host run before any commit.                                            |
| Hosted mobile report at 390 × 844 | BLOCKED by Chromium ERR_NETWORK_ACCESS_DENIED. Mobile image omitted pending readable hosted evidence.                           |
| Signed-out links and image        | Pending the post-publication check.                                                                                             |

## CP2 presentation review

The README puts the wallet-free steps ahead of the screenshots. The provenance statement is limited to the frozen commit and fingerprint in the saved demo export and host capture. The visual materials use actual subtitle-free frames and margin captions. The architecture mapping separates the browser EVM JSON-RPC route from the dotted host-side native RPC route.

2026-11-24. Corrected both root references under the product lead disposition. Verified published hashes and addresses against Git objects, chain evidence and recorded checksums. Shortened full identifiers in prose and extended the existing exact digest exception to the two original video-session paths.
