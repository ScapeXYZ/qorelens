# QoreLens close-out ledger

**CP1 PASS** on 2026-11-24. Batch B is underway. Worktree branch `closeout-gate0`
at `ced65d4afb83`.

## Master directive task register

| #   | Task                                             | Status            | Evidence or dependency                                                                                                                                                                                                           |
| --- | ------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fresh post-cleanup GitHub evidence               | PASS              | 2026-11-24. [Post-cleanup host capture](github-remote-post-cleanup-20261124-015733-435.txt).                                                                                                                                     |
| 2   | Live Pages fingerprint and asset hashes          | PASS              | 2026-11-24. [Live manifest and eight asset matches](live-integrity-20261124-015741-452.json).                                                                                                                                    |
| 3   | Licensing disposition                            | PASS              | 2026-11-24. DISPOSITION-1. [Inventory](third-party-inventory.json), [notices](../THIRD_PARTY_NOTICES.md), [vector verification](qoresign-vector-verification.json) and [distribution analysis](distribution-notice-analysis.md). |
| 4   | Gate 0 approval (CP1)                            | PASS              | 2026-11-24. [CP1 evidence package](../artifacts/closeout/CP1/INDEX.md).                                                                                                                                                          |
| 5   | Badge investigation (4 declarations)             | PASS              | 2026-11-24. [Five declaration decisions](../docs/submission/badge-evidence.md), including removal of the EVM window declaration.                                                                                                 |
| 6   | Project description rewrite                      | PASS              | 2026-11-24. [Approved narrowed project description](../docs/submission/project-description.md).                                                                                                                                  |
| 7   | Direct live demo link                            | PASS              | 2026-11-24. [Direct live demo](../docs/submission/links.md).                                                                                                                                                                     |
| 8   | Direct YouTube link                              | PASS              | 2026-11-24. [Direct video link](../docs/submission/links.md).                                                                                                                                                                    |
| 9   | Featured image 1200x630                          | IN PROGRESS       | [1200 × 630 cover](../docs/cover/featured-1200x630.png) rendered. Signed-out file check pending publication.                                                                                                                     |
| 10  | Desktop and mobile screenshots                   | PASS              | 2026-11-24. [Three full-resolution originals](demo-still-extraction.md) and three annotated desktop stills. Mobile omitted because hosted Chromium access was blocked.                                                           |
| 11  | Architecture diagram                             | PASS              | 2026-11-24. [Diagram](../docs/images/architecture.svg), [PNG](../docs/images/architecture.png), [Mermaid](../docs/ARCHITECTURE.md) and [source mapping](diagram-mapping.md).                                                     |
| 12  | Plain-English product explanation                | PASS              | 2026-11-24. [Approved narrowed explanation](../docs/submission/plain-english.md).                                                                                                                                                |
| 13  | Wallet-free judge path                           | PASS              | 2026-11-24. [Five-minute guide](../JUDGE_TEST.md). Signed-out walkthrough is a later gate.                                                                                                                                       |
| 14  | README, notices, docs, credits, requirements map | BLOCKED           | [Submission materials](../README.md) and [claims sweep](claims-sweep.md) ready for review. Staged Gitleaks requires Windows host.                                                                                                |
| 15  | Package review and publication (CP2, then push)  | APPROVAL REQUIRED | CP2 package prepared. Host scan and Claude review required before publication.                                                                                                                                                   |
| 16  | Signed-out verification of all links             | PENDING           | Scheduled after the preceding gate or task.                                                                                                                                                                                      |
| 17  | Wallet-free walkthrough, at least two people     | PENDING           | Scheduled after the preceding gate or task.                                                                                                                                                                                      |
| 18  | Wallet-connected walkthrough                     | PENDING           | Scheduled after the preceding gate or task.                                                                                                                                                                                      |
| 19  | Submission fields prepared                       | PENDING           | Scheduled after the preceding gate or task.                                                                                                                                                                                      |
| 20  | Final acceptance, submission, freeze (CP4)       | PENDING           | Scheduled after the preceding gate or task.                                                                                                                                                                                      |

## Gate 0 supporting evidence

## 1. Scaffold — PASS for recorded use

The first scaffold attempt failed at registry discovery. The recovery and run
transcripts show successful use of `create-qorechain-dapp@0.12.0`, with
`foundry`, testnet, npm, prompts skipped and no dependency install. The
generated window helper was used during feasibility deployment preparation.
See [the origin audit](origin-audit.md) for the invocation and generated
file inventory. Product `src/` is project-written. No tracked file matched the generated template bytes. The generated window helper supported the project deployment recorded in `feasibility/evidence/08-probe-deploy.json`, transaction `0x54029f6dca`.

```powershell
node "C:\dev\qorelens\feasibility\toolchain\node_modules\create-qorechain-dapp\dist\index.js" "qorelens" "--template" "foundry" "--network" "testnet" "--package-manager" "npm" "--yes" "--no-install"
```

## 2. Origin audit — evidence documented

[Origin audit](origin-audit.md) inventories the 73 base tracked files,
distinguishes the generated scaffold from tracked project files, and records
limited local and public identifier and URL searches. The checks found
expected reuse within QoreLens. The searches do not establish universal
originality. README claims were traced to source and saved evidence, with
excluded wallet capabilities and inferred hybrid signing called out.
Saved tests show 16 Vitest, 2 Foundry and 6 Playwright passes. The verifier
covers all five tamper controls, and the tests exercise BLOCKED key mappings
and schema v2 reason enforcement with legacy v1 import retained.

## 3. Licenses — DISPOSITION-1

[Inventory](third-party-inventory.json) records pinned versions, installed
license metadata, frozen bundle evidence and both lockfiles.
[Repository notices](../THIRD_PARTY_NOTICES.md) contain complete installed license
texts for the identified product dependencies and kit packages, plus the
upstream IBM Plex copyright. The host match establishes Apache-2.0 and upstream NOTICE attribution at revision `efe0f85d27cf`. The original download used unpinned main. The matching revision establishes content equivalence, not definitive historical HEAD provenance. The deployed subset omits 21 paths and changes no retained values. Frozen distribution notice coverage remains unresolved. The scratch
rebuild reproduced both frozen JavaScript hashes with and without esbuild
metafiles. The [notice analysis](distribution-notice-analysis.md) records
package-level retained headers and WOFF2 name-table evidence. No vendored forge-std was found. The frozen
deployed site stays in place, and repository notices alone are not proof
that all redistribution obligations are met.

## 4. PR #2 and remote master

| Check                      | Saved host result                                   | Post-cleanup result                                                                       |
| -------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| PR #2 `ui-polish → master` | CLOSED at 2026-11-23T16:22:33Z, `mergedAt: null`    | Fresh lookup blocked                                                                      |
| Remote master              | `ced65d4afb83`                                      | Fresh lookup blocked                                                                      |
| Frozen `v1.0.0`            | `613335b03e1c`, ancestor of remote master           | Local tag preserved; fresh remote lookup blocked                                          |
| Rejected commit            | `5bf46d278d96`, not an ancestor of remote master    | Still not an ancestor of the local master snapshot                                        |
| Candidate branch and tag   | Both remote candidate refs present in that snapshot | User reports remote deletion. Local branch and tag still resolve to the candidate commit. |

The [host log](github-remote-verification.txt) predates cleanup. Fresh
`git ls-remote` exited 128: `Failed to connect to github.com:443 after 186 ms: Could not connect to server`.
Fresh `gh pr view 2` exited 1 with the GitHub GraphQL socket permission error.
A live Pages fingerprint request exited 7:
`Failed to connect to scapexyz.github.io:443 after 177 ms: Could not connect to server`.
The post-cleanup remote state and fingerprint remain independently unverified in this environment.

## 5. Commit dates — PASS for inspected history

First reachable base commit: `a211efeffc28 (see evidence/origin-audit.md)`,
2026-11-21 23:21:16 UTC, Temitope.
Last base commit: `ced65d4afb83`,
2026-11-23 02:00:46 UTC, Temitope.
Both fall within 4 November–2 December 2026. No inherited template commit
history was identified in the inspected ancestry.

## 6. Video-session intake — report and independent host RPC PASS

[JSON](video-session.json) SHA-256:
`320c6ba9a3c8`.
[Markdown](video-session.md) SHA-256:
`be1dd8822cf6`.
Both match the originals and import to the same payload. The report code
recomputed digest `6dfebd3df958`.
The full build block matches frozen commit
`613335b03e1c`, fingerprint
`c0384c3b74aa`,
and Actions run `45053626379`. Offline replay accepted the original
4,627-byte signature against the saved chain-read key and rejected all five
controls. The fixed-message signature is independently VERIFIED.

The [host RPC file](video-session-rpc-verification.json) contains seven raw
responses. Offline replay of those responses reproduced all five host checks.

| Check                | Confirmed result                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Native and EVM chain | `qorechain-diana` and `0x2648`                                                                                                  |
| Native transaction   | `5216F3E05807`, block 10625585, code 0, gas used 167527. Recomputed hash from native transaction bytes matched.                 |
| Sender and recipient | `qor1ylgewp0h038mrnslyte4yst20q0zwdhqs7fujv` for both                                                                           |
| Message and fee      | 1 uqor self-transfer, memo `qorelens-gate-g6`, 60,000 uqor fee confirmed against native event                                   |
| Historical EVM state | At heights 10625584 → 10625585, nonce 6 → 7 and balance `0x5665dcf3e5ca90000` → `0x56588a58fbe230000`; matches the saved report |
| PQC event            | `pqc_hybrid_verify`, signer address matched, `status=verified` reported by chain                                                |

The transaction remains **CHAIN-OBSERVED**. The event is chain-reported.
Transaction signature bytes and preimages were not independently
cryptographically verified. The fixed-message signature remains
independently VERIFIED within the scope above.

The [manifest](acceptance-manifest.json) entry **demo-video session, v1.0.0**
now cites these independent chain reads.

## Evidence preservation

SHA-256 of checked-out bytes on 2026-11-24.

| Original export             | Before         | After          |
| --------------------------- | -------------- | -------------- |
| evidence/rc2-session-a.json | `0691a7f469c8` | `0691a7f469c8` |
| evidence/rc2-session-a.md   | `2c4b48c01038` | `2c4b48c01038` |
| evidence/video-session.json | `320c6ba9a3c8` | `320c6ba9a3c8` |
| evidence/video-session.md   | `be1dd8822cf6` | `be1dd8822cf6` |

## Close-out host results

Fresh [GitHub evidence](github-remote-post-cleanup-20261124-015733-435.txt) supersedes the earlier lookup limitations. PR #2 is closed and unmerged. The candidate branch and tag are absent remotely and retained locally. The approved Pages guard and Gitleaks configuration account for the configuration differences alongside docs and evidence. The [live host report](live-integrity-20261124-015741-452.json) confirms all eight asset SHA-256 values and the frozen commit, fingerprint and bundle hashes.

- The frozen-distribution notice gaps remain recorded in the notice analysis. Repository notices are the approved disposition.

## S3 staged secret-scan investigation — 2026-11-24

Host Gitleaks returned exit 1 with seven redacted findings. Reproduced the 4,660,671-byte staged binary diff locally (SHA-256 `aec231963eea`). This ledger update is unstaged so the investigated diff stays reproducible.

| Diff line | File location                                                         | Finding                          | Classification                         |
| --------: | --------------------------------------------------------------------- | -------------------------------- | -------------------------------------- |
|      1517 | `docs/cover/featured-1200x630.jpg`, Git index header (no source line) | Sourcegraph token rule           | Git-generated object ID false positive |
|     68370 | `evidence/video-session.json:459`                                     | Generic API key, Key binding     | Public registry-key digest             |
|     68423 | `evidence/video-session.json:512`                                     | Generic API key, Message signing | Public registry-key digest             |
|     68524 | `evidence/video-session.json:613`                                     | Generic API key, Tamper controls | Public registry-key digest             |
|     69335 | `evidence/video-session.md:483`                                       | Generic API key, Key binding     | Public registry-key digest             |
|     69388 | `evidence/video-session.md:536`                                       | Generic API key, Message signing | Public registry-key digest             |
|     69489 | `evidence/video-session.md:637`                                       | Generic API key, Tamper controls | Public registry-key digest             |

All six digest lines equal SHA-256 over the 2,592-byte Diana registry public key in the saved Key binding result. They also match the existing digest in the acceptance manifest and the exact digest already covered by the rule-scoped allowlist. The redacted report has empty File fields, so a path-dependent exception cannot resolve these findings in a single stdin stream. The staged JPEG matches the locally rendered cover byte for byte. The flagged line is the Git index header immediately before the binary patch. Its new SHA-1 object ID matches the staged blob and an independent Git blob hash calculation over the 85,097 JPEG bytes. No JPEG source line corresponds to the match.

S3 remains active. Proposed for Claude review: retain the rules and scan staged file contents with path context from a temporary snapshot of the index. This includes the original JPEG bytes and avoids synthetic diff headers. If needed, extend only the existing exact public-digest exception to the two exact video-session paths. Do not use the exception with a pathless scan. No configuration or original evidence changed.

Claude approved conditional remediation. The [investigation record](secret-scan-s3.md) links the Windows host runner. Local Gitleaks launch returned EPERM. S3 remains active pending the host scans and negative control.

### S6 stop — second Windows host attempt

2026-11-24. Second attempt exited 1 at line 89. Redacted host log: `C:/Users/USER/AppData/Local/Temp/qorelens-s3-c1525a8a-759d-4f28-b895-8fdd5ef15360.log`. Gitleaks 8.30.1 scanned 48 staged files. The Sourcegraph finding disappeared. The six known generic-api-key findings recurred at their exact source lines. All four original export SHA-256 hashes remained unchanged.

The unexpected-finding log line concatenates six rules, six absolute paths, and six line numbers. Windows PowerShell 5.1 reproduced the cause with synthetic JSON: ConvertFrom-Json emitted one array object, which the outer array expression stored as one finding. Enumerate the parsed array explicitly in Read-Findings for both initial and control scans. Then resolve each reported path against its scan root, verify containment, and compare exact relative paths, rule IDs, and line numbers. Keep every existing rejection and exit-code check.

S3 and S6 remain active. No third attempt, script change, or scanner configuration change. Proposed correction awaits Claude authorization.

### CP2 corrections and authorized S6 validation

2026-11-24. The corrected matcher passed Windows PowerShell 5.1 synthetic tests for valid enumeration, unexpected findings, duplicates, traversal and out-of-root paths. The authorized Windows host run is still required. See the [S3 investigation](secret-scan-s3.md), [frame provenance](demo-still-extraction.md) and [diagram mapping](diagram-mapping.md).

The [reference audit](hash-audit.md) records the original locations and verification sources. The [acceptance manifest](acceptance-manifest.json), [deployment records](deployments.testnet.json), and saved host captures retain full values. The final Windows security proof is required before the local close-out commit.
