param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot '.local'),(Join-Path $taskRoot '.local/logs') | Out-Null
& node tools/configure.cjs init
& node tools/configure.cjs check
if ($LASTEXITCODE -ne 0) { throw 'Fill in .env before starting the services. No sample accounts are created.' }
$server = & node -e "const e=require('./tools/configure.cjs').environment(); console.log(JSON.stringify({port:Number(e.PORT || 4000),host:e.HOST || '127.0.0.1'}))" | ConvertFrom-Json
if ($server.port -lt 1 -or $server.port -gt 65535) { throw 'PORT must be between 1 and 65535.' }
$apiHost = if ($server.host -in @('0.0.0.0','::')) { '127.0.0.1' } else { $server.host }
if ($apiHost.Contains(':')) { $apiHost = "[$apiHost]" }
$apiOrigin = "http://${apiHost}:$($server.port)"
if (-not $SkipBuild) {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Platform build failed.' }
  & (Join-Path $taskRoot 'tools/build-mobile.ps1') -App resident -Target preview

}
$node = (Get-Command node).Source
$processes = @()
if (Test-Path -LiteralPath '.local/processes.json') { $processes = @(Get-Content -LiteralPath '.local/processes.json' -Raw | ConvertFrom-Json) }
function Start-LocalService($Name,$Port,$Folder,$Arguments) {
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { Write-Host "$Name already listens on port $Port."; return }
  $process = Start-Process -FilePath $node -ArgumentList $Arguments -WorkingDirectory $Folder -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot ".local/logs/$Name.out.log") -RedirectStandardError (Join-Path $taskRoot ".local/logs/$Name.err.log") -PassThru
  $script:processes += @{ name=$Name; pid=$process.Id; executable=$node; started=$process.StartTime.ToUniversalTime().ToString('o') }
}
Start-LocalService 'api' $server.port (Join-Path $taskRoot 'apps/api') @('dist/src/main.js')
Start-LocalService 'admin' 3000 $taskRoot @('tools/dev/serve-admin.cjs')
if (Test-Path -LiteralPath 'apps/mobile/dist/index.html') {
  Start-LocalService 'mobile' 8080 $taskRoot @('tools/dev/serve-mobile.cjs')
}
$processes | ConvertTo-Json -AsArray | Set-Content -LiteralPath '.local/processes.json'
foreach ($service in @(@{name='API';url="$apiOrigin/v1/health"},@{name='Admin';url='http://127.0.0.1:3000'})) {
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try { $response = Invoke-WebRequest -Uri $service.url -TimeoutSec 2; $ready = $response.StatusCode -eq 200 } catch { }
    if ($ready) { break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "$($service.name) did not become ready. Check .local/logs." }
}
Write-Host 'Admin: http://127.0.0.1:3000'
if (Test-Path -LiteralPath 'apps/mobile/dist/index.html') { Write-Host 'Resident app: http://127.0.0.1:8080' }
Write-Host "API documentation: $apiOrigin/docs"
Write-Host 'Logs are in .local/logs. Use tools/stop-local.ps1 to stop services started by this script.'
