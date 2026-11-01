param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot '.local'),(Join-Path $taskRoot 'tmp') | Out-Null
if (-not (Test-Path -LiteralPath 'apps/api/.env')) {
  $template = Get-Content -LiteralPath '.env.example' -Raw
  $random = [byte[]]::new(32)
  [Security.Cryptography.RandomNumberGenerator]::Fill($random)
  $secret = [Convert]::ToHexString($random)
  $template.Replace('replace-with-at-least-32-random-characters',$secret) | Set-Content -LiteralPath 'apps/api/.env'
}
if (-not $SkipBuild) {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Platform build failed.' }
  $flutterCommand = Get-Command flutter -ErrorAction SilentlyContinue
  $flutterPath = if ($flutterCommand) { $flutterCommand.Source } else { Join-Path $env:USERPROFILE 'develop/flutter/bin/flutter.bat' }
  if (-not (Test-Path -LiteralPath $flutterPath)) { throw 'Flutter is required. Add Flutter to PATH, then run this script again.' }
  $previousPubCache = $env:PUB_CACHE
  try {
    $env:PUB_CACHE = Join-Path $taskRoot '.local/pub-cache'
    Set-Location -LiteralPath (Join-Path $taskRoot 'apps/mobile')
    & $flutterPath pub get
    if ($LASTEXITCODE -ne 0) { throw 'Flutter dependency install failed.' }
    & $flutterPath build web --release --no-web-resources-cdn --dart-define=API_BASE_URL=http://127.0.0.1:4000 -t lib/main.dart
    if ($LASTEXITCODE -ne 0) { throw 'Flutter preview build failed.' }
  } finally {
    $env:PUB_CACHE = $previousPubCache
    Set-Location -LiteralPath $taskRoot
  }
}
$node = (Get-Command node).Source
$processes = @()
if (Test-Path -LiteralPath '.local/processes.json') { $processes = @(Get-Content -LiteralPath '.local/processes.json' -Raw | ConvertFrom-Json) }
function Start-LocalService($Name,$Port,$Folder,$Arguments) {
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { Write-Host "$Name already listens on port $Port."; return }
  $process = Start-Process -FilePath $node -ArgumentList $Arguments -WorkingDirectory $Folder -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot "tmp/$Name.out.log") -RedirectStandardError (Join-Path $taskRoot "tmp/$Name.err.log") -PassThru
  $script:processes += @{ name=$Name; pid=$process.Id; executable=$node; started=$process.StartTime.ToUniversalTime().ToString('o') }
}
Start-LocalService 'api' 4000 (Join-Path $taskRoot 'apps/api') @('dist/src/main.js')
Start-LocalService 'admin' 3000 (Join-Path $taskRoot 'apps/admin') @('../../node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000')
if (Test-Path -LiteralPath 'apps/mobile/build/web/index.html') {
  Start-LocalService 'mobile' 8080 $taskRoot @('tools/serve-mobile.cjs')
}
$processes | ConvertTo-Json -AsArray | Set-Content -LiteralPath '.local/processes.json'
Write-Host 'Admin: http://127.0.0.1:3000'
if (Test-Path -LiteralPath 'apps/mobile/build/web/index.html') { Write-Host 'Resident / guard preview: http://127.0.0.1:8080' }
Write-Host 'API documentation: http://127.0.0.1:4000/docs'
Write-Host 'Logs are in tmp. Use tools/stop-local.ps1 to stop services started by this script.'
