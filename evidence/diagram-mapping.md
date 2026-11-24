# Architecture evidence mapping

| Node or arrow                                                                | Implementation or evidence                                                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Browser UI and lenses                                                        | [site/index.html](../site/index.html), [runSession](../src/lens/session.mjs#L43)                                                   |
| Independently check the ML-DSA-87 message signature and five modified inputs | [verifyMessage](../src/verify/verdict.mjs#L28), [controls](../src/verify/vector-checks.mjs#L19), [demo report](video-session.json) |
| Generate and import reports                                                  | [createReport](../src/report/integrity.mjs#L40), [importReport](../src/report/integrity.mjs#L88)                                   |
| Build-fingerprint consistency check                                          | [verifyBuild](../src/report/fingerprint.mjs#L2), [live host capture](live-integrity-20261124-015741-452.json)                      |
| QoreX native getKey, signArbitrary, signAndBroadcast                         | [runSession](../src/lens/session.mjs#L43), [recorded requests](video-session.json)                                                 |
| QoreX EVM eth_chainId and eth_accounts                                       | [runSession](../src/lens/session.mjs#L43), [recorded requests](video-session.json)                                                 |
| Diana EVM JSON-RPC eth_call for key status, pqcVerify and the deployed probe | [keyStatus and pqcVerify](../src/chain/precompiles.mjs#L26), [probeEvidence](../src/lens/session.mjs#L22)                          |
| Diana EVM JSON-RPC nonce and balance                                         | [runSession](../src/lens/session.mjs#L433), [recorded report](video-session.json)                                                  |
| Host-side native RPC transaction and events, EVM historical state            | [raw RPC capture](video-session-rpc-verification.json)                                                                             |
| Browser native REST and consensus RPC CORS limitation                        | [README limitations](../README.md#limitations), historical browser report                                                          |

The solid Diana path is the app’s EVM JSON-RPC route. The dotted path is the host’s native RPC route. The saved host evidence also includes EVM reads for historical nonce and balance.
