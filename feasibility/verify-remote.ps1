param([switch]$PostCleanup)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$root = (Get-Location).Path
$name = if ($PostCleanup) { 'github-remote-post-cleanup-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '.txt' } else { 'github-remote-verification.txt' }
$log = Join-Path (Join-Path $root 'evidence') $name
if (Test-Path -LiteralPath $log) { throw "Evidence already exists: $log" }
$polish = '5bf46d278d96ec189f6f0cd725e8c3c827c500a7'
$frozen = '613335b03e1c95b587a67fada29031ed415e17de'
$lines = [System.Collections.Generic.List[string]]::new()
function Read-Git([int]$Expected, [string[]]$Argv) {
    $lines.Add('> git ' + ($Argv -join ' '))
    $prior = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git -c "safe.directory=$root" @Argv 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $prior }
    $output | ForEach-Object { $lines.Add([string]$_) }
    $lines.Add("exit=$code; expected=$Expected")
    if ($code -ne $Expected) { throw ('Unexpected exit for git ' + ($Argv -join ' ')) }
    $output
}
try {
    $lines.Add("UTC: $([DateTime]::UtcNow.ToString('o'))")
    $lines.Add("Frozen commit expected: $frozen")
    $lines.Add("Rejected commit checked: $polish")
    $tag = Read-Git 0 @('rev-parse','v1.0.0^{commit}')
    if ("$tag" -ne $frozen) { throw 'Local frozen tag differs' }
    $null = Read-Git 0 @('fetch','origin','--tags')
    $refs = Read-Git 0 @('ls-remote','origin')
    if ($PostCleanup -and ($refs | Where-Object { $_ -match '\srefs/(heads/ui-polish|tags/v1\.1\.0-rc1)(?:\^\{\})?$' })) { throw 'Candidate ref remains on origin' }
    $master = Read-Git 0 @('rev-parse','origin/master')
    if ($refs -notcontains ("$master" + [char]9 + 'refs/heads/master')) { throw 'Remote and tracking master differ' }
    $lines.Add("Remote master checked: $master")
    if ($PostCleanup -and "$master" -ne "ced65d4afb838009626b62c4d5386cedcebd00ae") { throw "Remote master differs from the audited base; review the new tip" }
    if ($PostCleanup -and $refs -notcontains ($frozen + [char]9 + "refs/tags/v1.0.0") -and $refs -notcontains ($frozen + [char]9 + "refs/tags/v1.0.0^{}")) { throw "Remote frozen tag target differs" }
    $null = Read-Git 0 @('merge-base','--is-ancestor','v1.0.0','origin/master')
    $null = Read-Git 1 @('merge-base','--is-ancestor',$polish,'origin/master')
    $null = Read-Git 0 @('diff','--stat','v1.0.0','origin/master')
    $changed = Read-Git 0 @('diff','--name-only','v1.0.0','origin/master')
    $unexpected = @($changed | Where-Object { $_ -notmatch '^(?:(?:README|JUDGE_TEST|AI_USAGE|CONTRIBUTING|SECURITY|THIRD_PARTY_NOTICES)\.md$|docs/|evidence/|assets/|\.gitleaks\.toml$|\.github/workflows/product-pages\.yml$)' })
    if ($unexpected.Count) { throw 'Diff includes paths outside the approved scope' }
    $branches = Read-Git 0 @('for-each-ref','--contains',$polish,'--format=%(objectname) %(refname)','refs/remotes/origin')
    $tags = Read-Git 0 @('tag','--contains',$polish)
    $lines.Add('Candidate branches confirmed against live origin refs:')
    foreach ($branch in $branches) {
        $hash,$name = $branch -split ' ',2
        $live = $name -replace '^refs/remotes/origin/','refs/heads/'
        if ($refs -contains ($hash + [char]9 + $live)) { $lines.Add("$hash $live") }
    }
    $lines.Add('Candidate tags confirmed against live origin refs:')
    foreach ($tagName in $tags) {
        $tagHash = Read-Git 0 @('rev-parse',"$tagName")
        if ($refs -contains ($tagHash + [char]9 + "refs/tags/$tagName")) { $lines.Add("$tagHash refs/tags/$tagName") }
    }
    $localCandidate = Read-Git 0 @('rev-parse','refs/heads/ui-polish')
    $localTag = Read-Git 0 @('rev-parse','refs/tags/v1.1.0-rc1^{commit}')
    if ($PostCleanup -and ("$localCandidate" -ne $polish -or "$localTag" -ne $polish)) { throw 'Local candidate refs differ' }
    $lines.Add('> gh pr view 2 --repo ScapeXYZ/qorelens --json number,title,state,mergedAt,closedAt,headRefName,baseRefName,headRefOid,url')
    $pr = & gh pr view 2 --repo ScapeXYZ/qorelens --json number,title,state,mergedAt,closedAt,headRefName,baseRefName,headRefOid,url 2>&1
    $prExit = $LASTEXITCODE
    $pr | ForEach-Object { $lines.Add([string]$_) }
    $lines.Add("exit=$prExit")
    if ($prExit -ne 0) { throw 'PR lookup failed' }
    $parsed = ($pr -join [Environment]::NewLine) | ConvertFrom-Json
    if ($parsed.state -ne 'CLOSED' -or $null -ne $parsed.mergedAt -or $parsed.headRefOid -ne $polish -or $parsed.baseRefName -ne 'master') { throw 'PR differs from the expected closed, unmerged candidate' }
    $lines.Add('Result: checks passed; review the listed paths and refs.')
} catch {
    $lines.Add("Result: OPEN - $($_.Exception.Message)")
    throw
} finally {
    $lines | Set-Content -LiteralPath $log -Encoding utf8
    Write-Host "Saved $log"
}
