# Architecture

![Browser, QoreX and Diana testnet data flows](images/architecture.png)

The browser runs the app, verifier and report tools. The native QoreX lane signs and broadcasts. Its EVM lane supplies account and network information. A separate Diana JSON-RPC endpoint provides chain reads.

```mermaid
flowchart LR
  UI["Browser UI and lenses"]
  V["ML-DSA-87 verifier and five tamper controls"]
  R["Report generator and importer"]
  F["Build-fingerprint check"]
  N["QoreX native lane"]
  E["QoreX EVM lane"]
  D["Diana testnet through EVM JSON-RPC"]
  H["Host-side checks, not part of the app"]
  C["Diana native REST/RPC · browser CORS boundary"]
  UI -->|verifyMessage| V
  UI -->|createReport and importReport| R
  UI -->|verifyBuild| F
  UI -->|getKey, signArbitrary, signAndBroadcast| N
  UI -->|eth_chainId and eth_accounts| E
  UI -->|eth_call: key status, pqcVerify and probe| D
  UI -->|eth_getTransactionCount and eth_getBalance| D
  H -.->|Native RPC transaction and event reads| C
```

Native REST and consensus RPC are blocked by CORS in browsers in the recorded run. The host uses the separate native RPC endpoint for transaction and event reads. The archived verification uses native RPC for inclusion and events and EVM JSON-RPC for historical nonce and balance.

[Implementation and evidence mapping](../evidence/diagram-mapping.md).
