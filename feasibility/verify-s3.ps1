$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$root = (Get-Location).Path
$safe = "safe.directory=$($root.Replace('\','/'))"
$work = Join-Path ([IO.Path]::GetTempPath()) ('qorelens-s3-' + [guid]::NewGuid())
$log = "$work.log"
$utf8 = [Text.UTF8Encoding]::new($false)
$files = @('rc2-session-a.json','rc2-session-a.md','video-session.json','video-session.md')
function Write-Log($message) {
    Add-Content -LiteralPath $log -Value $message
    Write-Host $message
}
function Hash-Exports {
    foreach ($name in $files) {
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path 'evidence' $name)).Hash
        "$name $hash"
    }
}
function Invoke-Scan([string[]]$arguments) {
    Write-Log ('> gitleaks ' + ($arguments -join ' '))
    $saved = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & gitleaks @arguments 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $saved }
    foreach ($line in $output) { Write-Log ([string]$line) }
    Write-Log "exit=$code"
    return $code
}
function Read-Findings($report) {
    if (!(Test-Path -LiteralPath $report -PathType Leaf)) { return }
    $parsed = Get-Content -Raw -Encoding UTF8 -LiteralPath $report | ConvertFrom-Json
    foreach ($finding in $parsed) { $finding }
}
function Get-FindingPath([string]$scanRoot, [string]$reportedPath) {
    if ([string]::IsNullOrWhiteSpace($reportedPath) -or $reportedPath -match '(^|[\\/])\.\.([\\/]|$)') {
        throw 'Finding path is empty or contains traversal.'
    }
    $prefix = [IO.Path]::GetFullPath($scanRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $candidate = if ([IO.Path]::IsPathRooted($reportedPath)) { $reportedPath } else { Join-Path $prefix $reportedPath }
    $full = [IO.Path]::GetFullPath($candidate)
    if (!$full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Finding path escapes its scan root.'
    }
    $full.Substring($prefix.Length).Replace('\','/')
}
function Confirm-Findings($report, [string]$scanRoot, [hashtable]$positions) {
    $seen = @{}
    foreach ($finding in @(Read-Findings $report)) {
        $relative = Get-FindingPath $scanRoot $finding.File
        if ($finding.RuleID -cne 'generic-api-key' -or $relative -cnotin @($positions.Keys) -or $finding.StartLine -notin $positions[$relative]) {
            throw "Unexpected finding: $($finding.RuleID) $relative line $($finding.StartLine)"
        }
        $id = "$($relative):$($finding.StartLine)"
        if ($seen.ContainsKey($id)) { throw "Duplicate finding: $id" }
        $seen[$id] = $true
        $id
    }
}
function Invoke-SnapshotScan($report) {
    Invoke-Scan @('dir',$snapshot,'--config',$config,'--redact=100','--report-format','json','--report-path',$report)
}

function Write-Snapshot {
    Write-Log '> git diff --cached --name-only --diff-filter=ACMR -z and git show :<path>'
    $snapshotCode = @'
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = process.cwd().replaceAll(String.fromCharCode(92), '/');
const dest = path.resolve(process.argv[2]);
function git(args) {
    return cp.execFileSync('git', ['-c', 'safe.directory=' + root, ...args], {
        maxBuffer: 60 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']
    });
}
const names = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    .toString().split(String.fromCharCode(0)).filter(Boolean);
for (const name of names) {
    const target = path.resolve(dest, name);
    if (!target.startsWith(dest + path.sep)) throw Error('Path escapes snapshot.');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, git(['show', ':' + name]));
}
console.log('Staged files copied: ' + names.length);
'@
    $summary = $snapshotCode | & node - $snapshot
    if ($LASTEXITCODE -ne 0) { throw 'Snapshot creation failed.' }
    Write-Log ($summary -join [Environment]::NewLine)
}

$before = @(Hash-Exports)
Write-Log 'Original export SHA-256 before:'
$before | ForEach-Object { Write-Log $_ }
$snapshot = Join-Path $work 'index'
$config = Join-Path $root '.gitleaks.toml'
$null = New-Item -ItemType Directory -Path $snapshot -Force
try {
    if ((Invoke-Scan @('version')) -ne 0) { throw 'Gitleaks version check failed.' }
    Write-Snapshot
    $initial = Join-Path $work 'initial.json'
    $initialCode = Invoke-SnapshotScan $initial
    $positions = @{
        'evidence/video-session.json' = @(459,512,613)
        'evidence/video-session.md' = @(483,536,637)
    }
    $findings = @(Confirm-Findings $initial $snapshot $positions)
    if ($initialCode -notin @(0,1) -or ($initialCode -eq 1) -ne ($findings.Count -gt 0)) { throw 'Initial scan exit and findings disagree.' }
    foreach ($id in $findings) { Write-Log "Known public digest finding: $id" }
    Write-Log 'Sourcegraph finding absent from staged-contents scan.'
    if ($findings.Count) {
        $text = [IO.File]::ReadAllText($config)
        $old = '(?:acceptance-manifest\.json|rc2-session-a\.(?:json|md))$'
        $new = '(?:acceptance-manifest\.json|rc2-session-a\.(?:json|md)|video-session\.(?:json|md))$'
        if (!$text.Contains($old) -or !$text.Contains('targetRules = ["generic-api-key"]')) { throw 'Unexpected allowlist configuration.' }
        [IO.File]::WriteAllText($config,$text.Replace($old,$new),$utf8)
    }

    $controlReport = Join-Path $work 'control.json'
    $controlRoot = Join-Path $work 'control'
    $controlEvidence = Join-Path $controlRoot 'evidence'
    $null = New-Item -ItemType Directory -Path $controlEvidence -Force
    $controlName = if ($findings.Count) { 'video-session.json' } else { 'rc2-session-a.json' }
    $controlFile = Join-Path $controlEvidence $controlName
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random = New-Object byte[] 32
        do {
            $rng.GetBytes($random)
            $control = [BitConverter]::ToString($random).Replace('-','').ToLowerInvariant()
        } while ([IO.File]::ReadAllText($config).Contains($control))
    } finally { $rng.Dispose() }
    [IO.File]::WriteAllText($controlFile,('{ "keySha256": "' + $control + '" }'),$utf8)
    $controlCode = Invoke-Scan @('dir',$controlRoot,'--config',$config,'--redact=100','--report-format','json','--report-path',$controlReport)
    $controlPositions = @{}
    $controlPositions["evidence/$controlName"] = @(1)
    $controlFindings = @(Confirm-Findings $controlReport $controlRoot $controlPositions)
    if ($controlCode -ne 1 -or $controlFindings.Count -ne 1) { throw 'Negative control failed.' }
    Remove-Item -LiteralPath $controlFile
    Write-Log 'Negative control detected one generic-api-key in the exempt path and exited 1.'

    if ($findings.Count) {
        & git -c $safe add -- .gitleaks.toml
        if ($LASTEXITCODE -ne 0) { throw 'Failed to stage the authorized config change.' }
    }
    Write-Snapshot
    if ((Invoke-SnapshotScan (Join-Path $work 'final.json')) -ne 0) { throw 'Final staged scan failed.' }
    if ((Invoke-Scan @('git',$root,'--config',$config,'--redact=100','--log-opts=--all','--report-format','json','--report-path',(Join-Path $work 'history.json'))) -ne 0) { throw 'Full-history scan failed.' }
    Write-Log 'Staged and full-history Gitleaks exited 0.'
    Write-Log '> node - (literal scan of staged files against ignored local config)'
    $literalSource = @'
const fs = require('node:fs');
const cp = require('node:child_process');
const { parseEnv } = require('node:util');
const main = 'C:/dev/qorelens';
const closeout = process.cwd().replaceAll(String.fromCharCode(92), '/');
const git = (dir, args) => cp.execFileSync('git', ['-c', 'safe.directory=' + dir, ...args], {
    cwd: dir, maxBuffer: 60 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']
});
try {
    git(main, ['check-ignore', '-q', '--', '.env.local']);
    const values = Object.values(parseEnv(fs.readFileSync(main + '/.env.local', 'utf8')))
        .filter(Boolean).map(value => Buffer.from(value));
    if (!values.length) throw Error();
    const names = git(closeout, ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
        .toString().split(String.fromCharCode(0)).filter(Boolean);
    const hits = names.filter(name => {
        const bytes = git(closeout, ['show', ':' + name]);
        return values.some(value => bytes.includes(value));
    }).length;
    console.log(JSON.stringify({ files: names.length, hits }));
    if (hits) process.exitCode = 2;
} catch {
    console.error('Literal scan could not complete.');
    process.exitCode = 1;
}
'@
    $literalOutput = $literalSource | & node -
    $literalExit = $LASTEXITCODE
    Write-Log ($literalOutput -join [Environment]::NewLine)
    Write-Log "literal exit=$literalExit"
    if ($literalExit -ne 0) { throw 'Literal secret scan failed.' }
} finally {
    Write-Log 'Original export SHA-256 after:'
    $after = @(Hash-Exports)
    $after | ForEach-Object { Write-Log $_ }
    if ((Split-Path -Parent ([IO.Path]::GetFullPath($work))).TrimEnd([IO.Path]::DirectorySeparatorChar) -eq ([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) -and (Split-Path -Leaf $work) -match '^qorelens-s3-[a-f0-9-]+$') {
        Remove-Item -LiteralPath $work -Recurse -Force
    }
    Write-Host "Redacted log: $log"
    if (Compare-Object $before $after) { throw 'Original export hashes changed.' }
}
