# Testing and reproduction

## Frozen build

The [host live-integrity record](../evidence/live-integrity-20261124-015741-452.json) compares all eight hosted asset hashes with the frozen manifest. The [close-out ledger](../evidence/closeout-ledger.md) records the scratch rebuild match, saved test counts and video report replay.

Hash the downloaded asset in Git Bash:

```bash
curl -fLsS https://scapexyz.github.io/qorelens/app.js -o app.js
sha256sum app.js
```

Or use PowerShell to hash the downloaded file:

```powershell
curl.exe -fLsS https://scapexyz.github.io/qorelens/app.js -o app.js
Get-FileHash -Algorithm SHA256 -LiteralPath ./app.js
```

Expect `014ea592456d`. The CP1 Windows PowerShell host check already confirmed the hosted bytes.

## Report digest

Import JSON or Markdown from **Reports**. The [importer](../src/report/integrity.mjs#L88) parses the report and separates the integrity block. The [canonicalizer](../src/report/integrity.mjs#L14) sorts object keys recursively, preserves array order, and serializes the remaining values as JSON. The importer computes SHA-256 over the UTF-8 bytes and compares the stored digest. A digest match is an integrity check. Authorship and the accuracy of observations require separate evidence.

## Developer commands

From a separate checkout, run `npm ci`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, and `npm run test:browser`. The [frozen Pages CI run](https://github.com/ScapeXYZ/qorelens/actions/runs/45053626379) and [ledger](../evidence/closeout-ledger.md) are the records for the build and tests. The wallet-free route is in the [judge guide](../JUDGE_TEST.md).
