param([switch]$RemediateTestTools, [string]$TargetedFrom)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$root = (Get-Location).Path
$base = Join-Path $root 'artifacts/product/phase-4-5'
$run = Join-Path $base ('host-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $run -Force | Out-Null
$cutoff = [DateTime]::UtcNow.AddDays(-14).ToString('o')
$checks = [System.Collections.Generic.List[object]]::new()
$started = [DateTime]::UtcNow
Remove-Item Env:QORELENS_ALLOW_LOCAL_FONT_FALLBACK -ErrorAction SilentlyContinue
Remove-Item Env:QORELENS_REPLAY_NODE_MODULES -ErrorAction SilentlyContinue

function Record {
    param($Name, $Status, $ExitCode, $Log, $Note)
    $checks.Add([ordered]@{ name=$Name; status=$Status; exitCode=$ExitCode; log=$Log; note=$Note })
    Write-Host "$Status $Name"
}

function Check {
    param([string]$Name, [scriptblock]$Command)
    $log = Join-Path $run ($Name + '.log')
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $global:LASTEXITCODE = 0
    try {
        & $Command 2>&1 | Out-File -LiteralPath $log -Encoding utf8
        $code = $LASTEXITCODE
    } catch {
        $_ | Out-File -LiteralPath $log -Encoding utf8 -Append
        $code = 1
    } finally {
        $ErrorActionPreference = $oldPreference
    }
    $status = 'PASS'
    if (Select-String -LiteralPath $log -Quiet -Pattern 'ApplicationFailedException|Program .+ failed to run') {
        $code = $null
        $status = 'BLOCKED'
    } elseif ($code -ne 0) {
        $status = 'FAIL'
        if ($Name -like 'age-registry-*' -or (Select-String -LiteralPath $log -Quiet -Pattern 'EACCES|EPERM|ENETUNREACH|ENOTFOUND|ETIMEDOUT|audit endpoint returned an error|not recognized as the name')) { $status = 'BLOCKED' }
    }
    Record $Name $status $code $log $null
    return ($status -eq 'PASS')
}

function Block {
    param([string]$Name, [string]$Reason)
    Record $Name 'BLOCKED' $null $null $Reason
}

$lockReady = $false
$installed = $false
$built = $false
try {
    if ($TargetedFrom) {
        if ($RemediateTestTools) { throw 'Targeted reruns do not change the dependency lock.' }
        $previous = (Resolve-Path -LiteralPath $TargetedFrom).Path
        $validatePrior = @'
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
const prior = process.argv[2];
const load = path => JSON.parse(readFileSync(path,"utf8").replace(/^\uFEFF/,""));
const run = load(join(prior,"phase5-results.json"));
for(const name of ["strict-npm-ci","strict-build","vitest","fingerprint-schema-and-provenance","foundry","npm-audit","chromium-install"]) {
  assert.ok(run.checks.some(x=>x.name===name&&x.status==="PASS"&&x.exitCode===0), "Prior check missing: "+name);
}
const lock = readFileSync("package-lock.json");
assert.ok(lock.equals(readFileSync(join(prior,"lock-candidate/package-lock.json"))),"Dependency lock changed");
const fingerprint = load(join(prior,"fingerprint.json"));
assert.deepEqual(load("dist/fingerprint.json"),fingerprint);
for(const [file,digest] of Object.entries(fingerprint.files)) {
  assert.match(file,/^[\w.-]+$/);
  assert.equal(createHash("sha256").update(readFileSync("dist/"+file)).digest("hex"),digest,"Build asset changed: "+file);
}
for(const [name,version] of Object.entries(fingerprint.dependencyVersions)) assert.equal(load("node_modules/"+name+"/package.json").version,version);
console.log(JSON.stringify({ lockUnchanged:true, buildFingerprint:fingerprint.fingerprint, prior }));
'@
        $installed = Check 'targeted-inputs-unchanged' { $validatePrior | node --input-type=module - $previous }
        $lockReady = $installed
        $built = $installed
    } else {
    $candidate = Join-Path $run 'lock-candidate'
    New-Item -ItemType Directory -Path $candidate -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'package.json') -Destination $candidate
    Copy-Item -LiteralPath (Join-Path $root 'package-lock.json') -Destination $candidate
    if ($RemediateTestTools) {
        $preparePatch = @'
import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
const manifest = JSON.parse(readFileSync(path, "utf8"));
manifest.devDependencies.vitest = "4.1.12";
manifest.devDependencies["@playwright/test"] = "1.55.1";
writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ vitest: "4.1.12", "@playwright/test": "1.55.1" }));
'@
        if (-not (Check 'prepare-test-tool-pins' { $preparePatch | node --input-type=module - (Join-Path $candidate 'package.json') })) {
            throw 'Could not prepare targeted test-tool manifest.'
        }
    }
    Push-Location -LiteralPath $candidate
    try {
        $resolved = Check 'resolve-approved-lock' {
            npm.cmd install --package-lock-only --ignore-scripts --no-audit --no-fund "--before=$cutoff" --fetch-retries=0 --fetch-timeout=15000
        }
    } finally {
        Pop-Location
    }

    if ($resolved) {
        $lockCheck = @'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const read = p => JSON.parse(readFileSync(p, "utf8"));
const approved = {
  "@fontsource/ibm-plex-sans": "5.2.5",
  "@fontsource/ibm-plex-mono": "5.2.5",
  "axe-core": "4.10.3",
};
const original = read("package.json");
const patched = process.argv[3] === "patch";
const manifest = read(join(process.argv[2], "package.json"));
assert.deepEqual(manifest.dependencies, original.dependencies);
const targets = { vitest:"4.1.12", "@playwright/test":"1.55.1" };
const expectedDev = patched ? {...original.devDependencies,...targets} : original.devDependencies;
assert.deepEqual(manifest.devDependencies,expectedDev);
const old = read("package-lock.json").packages;
const next = read(join(process.argv[2], "package-lock.json")).packages;
const direct = { ...manifest.dependencies, ...manifest.devDependencies };
assert.deepEqual(next[""].dependencies, manifest.dependencies);
assert.deepEqual(next[""].devDependencies, manifest.devDependencies);
for (const [name, version] of Object.entries(direct)) {
  assert.match(version, /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/, name + " is not pinned exactly");
  assert.equal(next["node_modules/" + name]?.version, version, name + " pin mismatch");
}
for (const [name, version] of Object.entries(approved)) assert.equal(direct[name], version);
function testToolTree(packages) {
  const seen = new Set();
  function visit(path) {
    if (seen.has(path) || !packages[path]) return;
    seen.add(path);
    const item = packages[path];
    for (const name of Object.keys({...item.dependencies,...item.optionalDependencies,...item.peerDependencies})) {
      let parent = path;
      while (parent) {
        const nested = parent + "/node_modules/" + name;
        if (packages[nested]) { visit(nested); break; }
        const end = parent.lastIndexOf("/node_modules/");
        parent = end < 0 ? "" : parent.slice(0,end);
      }
      if (!parent) visit("node_modules/" + name);
    }
  }
  for (const name of Object.keys(targets)) visit("node_modules/" + name);
  return seen;
}
const beforeTree = patched ? testToolTree(old) : new Set();
const afterTree = patched ? testToolTree(next) : new Set();
const changed = [];
for (const path of new Set([...Object.keys(old),...Object.keys(next)])) {
  if (!path) continue;
  const before = old[path], after = next[path];
  if (before && after && ["version","resolved","integrity"].every(k=>before[k]===after[k])) continue;
  const name = path.split("node_modules/").at(-1);
  const approvedAddition = !before && Object.hasOwn(approved,name);
  const testToolChange = patched && (beforeTree.has(path) || afterTree.has(path))
    && (!before || before.dev === true) && (!after || after.dev === true);
  assert.ok(approvedAddition || testToolChange, "Unrelated or runtime lock change: " + path);
  changed.push({path,before:before?.version??null,after:after?.version??null});
}
if (patched) {
  for (const [path,item] of Object.entries(next)) {
    const name=path.split("node_modules/").at(-1);
    if (name==="tinypool") assert.equal(item.version,"2.1.2", "Unexpected vulnerable or unreviewed tinypool pin");
    if (name==="@vitest/mocker") assert.equal(item.version,"4.1.12");
    if (name==="playwright" || name==="playwright-core") assert.equal(item.version,"1.55.1");
  }
}
console.log(JSON.stringify({changed, approved, targets:patched?targets:null},null,2));
'@
        $mode = if ($RemediateTestTools) { 'patch' } else { 'unchanged' }
        $lockReady = Check 'lock-diff-and-exact-pins' { $lockCheck | node --input-type=module - $candidate $mode }
        if ($lockReady) {
            if ($RemediateTestTools) { Copy-Item -LiteralPath (Join-Path $candidate 'package.json') -Destination (Join-Path $root 'package.json') -Force }
            Copy-Item -LiteralPath (Join-Path $candidate 'package-lock.json') -Destination (Join-Path $root 'package-lock.json') -Force
            $installed = Check 'strict-npm-ci' {
                npm.cmd ci --ignore-scripts --no-audit --no-fund "--before=$cutoff" --fetch-retries=0 --fetch-timeout=15000
            }
        }
    }

    }

    if ($installed) {
        if ($TargetedFrom) { $chromium = $true } else {
        $built = Check 'strict-build' { npm.cmd run build }
        [void](Check 'lint' { npm.cmd run lint })
        [void](Check 'formatting' { npm.cmd run format:check })
        $chromium = Check 'chromium-install' { npx.cmd --no-install playwright install chromium }
        if ($built) { [void](Check 'vitest' { npm.cmd test }) }
        else { Block 'vitest' 'Strict build failed; fingerprint and report tests require its output.' }
        }
        if ($built -and $chromium) {
            $browserStart = [DateTime]::UtcNow
            if ($TargetedFrom) {
                [void](Check 'chromium-playwright' { npm.cmd run test:browser -- --workers=1 --reporter=list 'test/browser/phase-4-5.spec.mjs' })
            } else {
                [void](Check 'chromium-playwright' { npm.cmd run test:browser -- --workers=1 --reporter=list })
            }
            $axePath = Join-Path $base 'axe.json'
            if ((Test-Path -LiteralPath $axePath) -and (Get-Item -LiteralPath $axePath).LastWriteTimeUtc -ge $browserStart) {
                Copy-Item -LiteralPath $axePath -Destination $run
                $axe = @( (ConvertFrom-Json (Get-Content -Raw -LiteralPath $axePath)) | ForEach-Object { $_ } )
                $widths = @($axe | ForEach-Object width | Sort-Object)
                $violations = @($axe | ForEach-Object { $_.violations } | Where-Object { $null -ne $_ })
                if (($widths -join ',') -eq '360,768,1280' -and $violations.Count -eq 0 -and @($axe | Where-Object { $_.passes -lt 1 }).Count -eq 0) {
                    Record 'axe-360-768-1280' 'PASS' 0 (Join-Path $run 'axe.json') 'Fresh report; zero violations.'
                } else {
                    Record 'axe-360-768-1280' 'FAIL' 1 (Join-Path $run 'axe.json') 'Missing widths, missing checks, or violations.'
                }
            } else { Block 'axe-360-768-1280' 'No fresh axe result was produced. See chromium-playwright.log.' }
            foreach ($name in @('qorelens-360.png','qorelens-768.png','qorelens-1280.png','browser-audit.json')) {
                $file = Join-Path $base $name
                if ((Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file).LastWriteTimeUtc -ge $browserStart) {
                    Copy-Item -LiteralPath $file -Destination $run
                }
            }

            if (Test-Path -LiteralPath (Join-Path $run 'browser-audit.json')) {
                $cspCheck = @'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync("dist/index.html", "utf8");
const policy = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
assert.ok(policy, "Build contains no CSP");
const directives = Object.fromEntries(policy.split(";").map(x => x.trim()).filter(Boolean).map(x => {
  const [name, ...values] = x.split(/\s+/);
  return [name, values];
}));
assert.deepEqual(directives["default-src"], ["'none'"]);
for (const name of ["script-src", "style-src", "font-src"]) assert.deepEqual(directives[name], ["'self'"]);
assert.deepEqual(directives["connect-src"], ["'self'", "https://evm-testnet.qore.host"]);
for (const name of ["object-src", "base-uri", "form-action"]) assert.deepEqual(directives[name], ["'none'"]);
const log = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.ok(log.requests.length > 0);
for (const url of log.requests) {
  const u = new URL(url);
  assert.ok((u.protocol === "http:" && u.hostname === "127.0.0.1") ||
    u.origin === "https://evm-testnet.qore.host", "Unexpected browser request: " + url);
}
assert.equal(log.walletRequests, 0);
assert.deepEqual(log.pageErrors, []);
assert.equal(log.forbiddenProbe.observed, true);
assert.equal(log.forbiddenProbe.fetchResult.rejected, true);
assert.deepEqual(log.unexpectedRequests, []);
assert.ok(log.violations.some(x => x.directive === "connect-src" && new URL(x.blocked).hostname === "example.invalid"));
console.log(JSON.stringify({ directives, requestCount:log.requests.length, keyboard:log.keyboard,
  liveQorexCompatibility:"NOT VERIFIED", walletRequests:0 }, null, 2));
'@
                [void](Check 'csp-and-network' { $cspCheck | node --input-type=module - (Join-Path $run 'browser-audit.json') })
            } else { Block 'csp-and-network' 'No fresh Chromium browser-audit.json was produced.' }
        } else {
            Block 'chromium-playwright' 'Strict build or Chromium installation failed.'
            Block 'axe-360-768-1280' 'Chromium tests could not run.'
            Block 'csp-and-network' 'Chromium tests could not run.'
        }
        if ($TargetedFrom) {
            # The prior fingerprint check is reused only after byte comparison.
        } elseif ($built) {
            $fingerprintCheck = @'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonical, sha256 } from "./src/report/integrity.mjs";
const read = p => JSON.parse(readFileSync(p, "utf8"));
const manifest = read("dist/fingerprint.json");
const { fingerprint, ...body } = manifest;
assert.equal(body.schema, "qorelens-build-v2");
assert.match(body.commit, /^[a-f0-9]{40}$/i);
assert.equal(typeof body.dirty, "boolean");
assert.ok(Object.hasOwn(body, "ciRunId"));
assert.ok(body.ciRunId === null || /^\d+$/.test(body.ciRunId));
if (process.env.GITHUB_ACTIONS) assert.equal(body.ciRunId, process.env.GITHUB_RUN_ID);
assert.ok(Number.isFinite(Date.parse(body.buildTimestamp)), "Missing or invalid build timestamp");
assert.equal(body.bundledFonts, true);
const required = ["index.html","app.js","app.css","verifier.js","public-vectors.json","plex-sans.woff2","plex-sans-semibold.woff2","plex-mono.woff2"];
for (const name of required) assert.ok(Object.hasOwn(body.files, name), "Missing build asset: " + name);
for (const [name, hash] of Object.entries(body.files)) {
  assert.ok(required.includes(name), "Unexpected asset: " + name);
  assert.equal(await sha256(readFileSync("dist/" + name)), hash, name);
}
assert.equal(body.bundleSha256, body.files["app.js"]);
assert.equal(body.verifierSha256, body.files["verifier.js"]);
const p = read("package.json");
assert.deepEqual(body.dependencyVersions, { ...p.dependencies, ...p.devDependencies });
assert.equal(await sha256(canonical(body)), fingerprint);
assert.deepEqual(read("dist/build.json"), manifest);
console.log(JSON.stringify(manifest, null, 2));
'@
            if (Check 'fingerprint-schema-and-provenance' { $fingerprintCheck | node --input-type=module - }) {
                Copy-Item -LiteralPath (Join-Path $root 'dist/fingerprint.json') -Destination $run
            }
        } else { Block 'fingerprint-schema-and-provenance' 'Strict build failed.' }
    } else {
        foreach ($name in @('strict-build','lint','formatting','chromium-install','vitest','chromium-playwright','axe-360-768-1280','csp-and-network','fingerprint-schema-and-provenance')) {
            Block $name 'Approved lock resolution or strict install failed.'
        }
    }

    if (-not $TargetedFrom) { [void](Check 'foundry' { forge test --offline }) }
    if ($lockReady) {
        if (-not $TargetedFrom) { [void](Check 'npm-audit' { npm.cmd audit --json --fetch-retries=0 --fetch-timeout=15000 }) }
        $lockedInventory = @'
import {readFileSync} from "node:fs";
const {packages}=JSON.parse(readFileSync("package-lock.json","utf8"));
const records=Object.entries(packages).filter(([path])=>path).map(([path,item])=>({
  name:path.split("node_modules/").at(-1),version:item.version
}));
console.log(JSON.stringify(records));
'@
        $packages = @{}
        if (Check 'dependency-age-lock-inventory' { $lockedInventory | node --input-type=module - }) {
            $records = Get-Content -Raw -LiteralPath (Join-Path $run 'dependency-age-lock-inventory.log') | ConvertFrom-Json
            foreach ($entry in $records) {
                if (-not $packages.ContainsKey($entry.name)) { $packages[$entry.name] = @{} }
                $packages[$entry.name][$entry.version] = $true
            }
        }
        $age = @()
        $i = 0
        $metadataDeadline = [DateTime]::UtcNow.AddMinutes(5)
        foreach ($packageName in ($packages.Keys | Sort-Object)) {
            $i++
            $logName = 'age-registry-' + $i.ToString('000')
            $ok = $false
            $lookupError = $null
            if ([DateTime]::UtcNow -lt $metadataDeadline) {
                $ok = Check $logName { npm.cmd view $packageName time --json --fetch-retries=0 --fetch-timeout=4000 }
                if (-not $ok) { $lookupError = 'Registry lookup failed; see command log.' }
            } else { $lookupError = 'Five-minute registry lookup budget exhausted.' }
            $dates = $null
            if ($ok) {
                try { $dates = Get-Content -Raw -LiteralPath (Join-Path $run ($logName + '.log')) | ConvertFrom-Json }
                catch { $dates = $null }
            }
            foreach ($version in ($packages[$packageName].Keys | Sort-Object)) {
                $entry = if ($dates) { $dates.PSObject.Properties[$version] } else { $null }
                $published = $null
                $status = 'BLOCKED'
                if ($entry) {
                    try {
                        $published = [DateTimeOffset]::Parse($entry.Value)
                        if ($published -le [DateTimeOffset]::Parse($cutoff)) { $status = 'PASS' }
                        else { $status = 'FAIL' }
                    } catch { $status = 'BLOCKED' }
                }
                $age += [ordered]@{name=$packageName;version=$version;published=$published;status=$status;error=$(if ($status -eq 'BLOCKED' -and -not $lookupError) { 'Missing or invalid release timestamp.' } else { $lookupError });log=($logName+'.log')}
            }
        }
        $agePath = Join-Path $run 'dependency-age.json'
        [ordered]@{ cutoff=$cutoff; packages=$age } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $agePath -Encoding utf8
        if (@($age | Where-Object status -eq 'FAIL').Count) {
            Record 'dependency-age' 'FAIL' 1 $agePath 'One or more lockfile versions are younger than 14 days.'
        } elseif (-not $age.Count -or @($age | Where-Object status -ne 'PASS').Count) {
            Block 'dependency-age' ('Release-date evidence incomplete; see ' + $agePath)
        } else {
            Record 'dependency-age' 'PASS' 0 $agePath 'Every installed lockfile version is at least 14 days old.'
        }
    } else {
        Block 'npm-audit' 'Final approved lockfile unavailable.'
        Block 'dependency-age' 'Final approved lockfile unavailable.'
    }
    [void](Check 'literal-secret-scan' { node feasibility/scan-literal-secrets.mjs })
    [void](Check 'gitleaks-staged' { gitleaks git --staged --redact=100 . })
    [void](Check 'gitleaks-full-history' { gitleaks git --log-opts='--all --reflog' --redact=100 . })
    foreach ($dir in @('src','scripts','site','test','.github/workflows')) {
        $name = 'gitleaks-working-' + ($dir -replace '[^a-zA-Z0-9-]', '-')
        [void](Check $name { gitleaks dir --redact=100 $dir })
    }
} catch {
    $_ | Out-File -LiteralPath (Join-Path $run 'unexpected-error.log') -Encoding utf8
    Record 'unexpected-error' 'FAIL' 1 (Join-Path $run 'unexpected-error.log') $null
} finally {
    $missing = @($checks | Where-Object { $_.status -ne 'PASS' })
    $overall = if (@($missing | Where-Object status -eq 'FAIL').Count) { 'FAIL' } elseif ($missing.Count) { 'BLOCKED' } else { 'PASS' }
    [ordered]@{
        status=$overall
        startedUtc=$started.ToString('o')
        endedUtc=[DateTime]::UtcNow.ToString('o')
        folder=$run
        baselineAcceptanceReport='Historical baseline with incomplete provenance; unchanged.'
        hostedCiProvenance='Local fingerprint schema checked. No CI run ID is fabricated for a local build.'
        liveQorexCspCompatibility='NOT VERIFIED'
        walletSigningOrTransactions='NOT EXERCISED'
        publication='NOT EXERCISED'
        phase6='NOT STARTED'
        reusedHostRun=$TargetedFrom
        checks=$checks.ToArray()
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $run 'phase5-results.json') -Encoding utf8
    Write-Host "$overall Phase 5 checks. Results: $run"
}
if ($overall -ne 'PASS') { exit 1 }
