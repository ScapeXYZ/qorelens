param([string]$Remote)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Set-Location ..
function Checked {
    param([scriptblock]$Action)
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE. Stop publishing." }
}
Checked { git check-ignore -v -- .env.local }
Checked { node feasibility/scan-literal-secrets.mjs }
if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) { throw 'Install the missing Gitleaks CLI before publishing.' }
Checked { git add -- .gitignore LICENSE package.json package-lock.json .github/workflows/feasibility-pages.yml feasibility/site feasibility/contracts feasibility/test feasibility/script feasibility/foundry.toml feasibility/serve.mjs feasibility/runner-evidence.mjs feasibility/scan-literal-secrets.mjs feasibility/publish.ps1 feasibility/toolchain/package.json feasibility/toolchain/package-lock.json feasibility/toolchain/browser-crypto.mjs feasibility/toolchain/build-browser.mjs }
Checked { node feasibility/scan-literal-secrets.mjs }
Checked { gitleaks git --staged --redact=100 . }
Checked { git commit -m 'Prepare final QoreLens Phase 0 session' }
Checked { node feasibility/scan-literal-secrets.mjs }
Checked { gitleaks git --redact=100 . }
$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    if (-not $Remote) { $Remote = Read-Host 'Empty GitHub repository HTTPS clone URL' }
    if ($Remote -notmatch '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$') { throw 'Invalid HTTPS GitHub clone URL' }
    Checked { git remote add origin $Remote }
    Checked { git branch -m main }
} elseif ($Remote -and $origin -ne $Remote) {
    throw 'Existing origin differs from the supplied URL'
}
Checked { git push -u origin HEAD }
Checked { git rev-parse HEAD }
