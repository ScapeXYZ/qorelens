$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$base = 'https://scapexyz.github.io/qorelens/'
$expected = [ordered]@{
    commit = '613335b03e1c95b587a67fada29031ed415e17de'
    fingerprint = 'c0384c3b74aa4495e8d221058d85a68db23f2c250e3664c362a7385be28e4fb4'
    bundleSha256 = '014ea592456d5a74a989f3f9da0158afb6609defebc7e7c950fc1f61544daa60'
    verifierSha256 = 'd0cc5b65b102fca63b8c8853d256cd3a49cc4a023d7ee869ef1a3c6a1e6031f1'
}
$files = [ordered]@{
    'index.html' = '8550ee7d9445573b2482ffb3e95f0b46b162035e68bc8c21feaf43e518cb2eee'
    'app.js' = $expected.bundleSha256
    'app.css' = '93d010d7663eb7ceacdf2dbff5a5fbfa5f5589eaaf70066dab128acff31596ea'
    'verifier.js' = $expected.verifierSha256
    'public-vectors.json' = '8444b1c39b5f4b2419055d704288656989193c80ac5e104adfb109242d15674e'
    'plex-sans.woff2' = '3b646991d30055a93a4ecc499713d4347953a74a947ecab435ab72070cbdab0e'
    'plex-sans-semibold.woff2' = '8960851d691c054ed38e259bdcf1a6190d157b4203ed5bb32c632a863fb8ec2f'
    'plex-mono.woff2' = '3c5a451f9ec27a354b0c2bcca636c6ec17a651281aabf29f8427e210a1d31e85'
}
$utc = [DateTime]::UtcNow
$path = Join-Path (Get-Location).Path ('evidence/live-integrity-' + $utc.ToString('yyyyMMdd-HHmmss-fff') + '.json')
$record = [ordered]@{
    utc = $utc.ToString('o')
    baseUrl = $base
    status = 'BLOCKED'
    expected = $expected
    assets = [System.Collections.Generic.List[object]]::new()
}
$handler = $null
$client = $null
try {
    Add-Type -AssemblyName System.Net.Http
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseCookies = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(15)
    $client.DefaultRequestHeaders.CacheControl = [System.Net.Http.Headers.CacheControlHeaderValue]::new()
    $client.DefaultRequestHeaders.CacheControl.NoCache = $true
    function Read-Asset([string]$Name) {
        $uri = [Uri]::new([Uri]$base, $Name)
        $response = $client.GetAsync($uri).GetAwaiter().GetResult()
        try {
            if ([int]$response.StatusCode -ne 200) { throw "GET $uri returned HTTP $([int]$response.StatusCode)" }
            $data = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
            return ,$data
        } finally { $response.Dispose() }
    }
    function Get-BytesSha256([byte[]]$Data) {
        $hasher = [System.Security.Cryptography.SHA256]::Create()
        try { [BitConverter]::ToString($hasher.ComputeHash($Data)).Replace('-', '').ToLowerInvariant() }
        finally { $hasher.Dispose() }
    }

    $bytes = Read-Asset 'fingerprint.json'
    $record.manifestSha256 = Get-BytesSha256 $bytes
    $manifest = [System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
    $record.manifest = $manifest
    foreach ($name in $expected.Keys) {
        if ($manifest.$name -cne $expected[$name]) {
            $record.status = 'FAIL'
            throw "S2: live $name differs from frozen v1.0.0"
        }
    }
    if ($manifest.schema -cne 'qorelens-build-v2' -or $manifest.ciRunId -cne '45053626379' -or $manifest.dirty -ne $false) {
        $record.status = 'FAIL'
        throw 'Live build provenance differs from the frozen manifest'
    }
    $manifestPaths = @($manifest.files.PSObject.Properties | ForEach-Object { $_.Name })
    if ($manifestPaths.Count -ne $files.Count -or @($manifestPaths | Where-Object { $_ -cnotin $files.Keys }).Count) {
        $record.status = 'FAIL'
        throw 'Live asset list differs from the frozen manifest'
    }
    foreach ($name in $files.Keys) {
        $declared = $manifest.files.PSObject.Properties[$name].Value
        $body = Read-Asset $name
        $hash = Get-BytesSha256 $body
        $matches = $hash -ceq $declared -and $hash -ceq $files[$name]
        $record.assets.Add([ordered]@{
            path = $name
            bytes = $body.Length
            sha256 = $hash
            manifestSha256 = $declared
            frozenSha256 = $files[$name]
            matches = $matches
        })
        if (-not $matches) {
            $record.status = 'FAIL'
            throw "S2: $name does not match the manifest and frozen asset hash"
        }
    }
    $record.status = 'PASS'
} catch {
    $record.error = $_.Exception.Message
    $failure = $_
} finally {
    if ($null -ne $client) { $client.Dispose() }
    elseif ($null -ne $handler) { $handler.Dispose() }
    if (Test-Path -LiteralPath $path) { throw "Evidence file already exists: $path" }
    $record | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $path -Encoding utf8
    Write-Host "Saved $path"
}
if ($failure) { throw $failure }
