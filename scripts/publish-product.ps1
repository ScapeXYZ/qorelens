param([switch]$Resume)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Set-Location ..
function Checked {
    param([scriptblock]$Action)
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" }
}
$cutoff = '2026-11-07T21:15:57.730Z'
if (-not $Resume) {
    Checked { npm.cmd install --package-lock-only --ignore-scripts --no-audit --no-fund "--before=$cutoff" }
    Checked { npm.cmd ci --ignore-scripts --no-audit --no-fund "--before=$cutoff" }
}
Checked { npm.cmd run format }
Checked { npm.cmd run lint }
Checked { npm.cmd run format:check }
Checked { npm.cmd run build }
Checked { npm.cmd test }
if (-not $Resume) {
    Checked { npx.cmd --no-install playwright install chromium }
}
Checked { npm.cmd run test:browser }
Checked { node test/local-validation.mjs }
Checked { node feasibility/scan-literal-secrets.mjs }
Checked { git add -- .gitignore .github/workflows/product-pages.yml package.json package-lock.json README.md SECURITY.md docs/PHASE_0_ACCEPTANCE.md contracts foundry.toml playwright.config.mjs vitest.config.mjs scripts site src test }
Checked { node feasibility/scan-literal-secrets.mjs }
Checked { gitleaks git --staged --redact=100 . }
Checked { git commit -m 'Implement QoreLens product phases 1 through 3' }
Checked { node feasibility/scan-literal-secrets.mjs }
Checked { gitleaks git --redact=100 . }
Checked { git push -u origin HEAD }
Checked { git rev-parse HEAD }
