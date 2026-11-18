param(
  [ValidateSet('resident','guard')][string]$App = 'resident',
  [ValidateSet('android','ios','preview')][string]$Target = 'android',
  [switch]$Release,
  [switch]$Demo,
  [switch]$AllowUnconfigured
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$previousLocation = Get-Location
$previousVariant = $env:APP_VARIANT
$previousMode = $env:APP_MODE
try {
  Set-Location -LiteralPath $taskRoot
  $env:APP_VARIANT = $App
  $env:APP_MODE = if ($Demo) { 'demo' } else { 'live' }
  $platform = if ($Target -eq 'preview') { 'android' } else { $Target }
  $options = @('tools/configure.cjs','mobile',$App,$platform)
  if ($AllowUnconfigured) { $options += '--allow-unconfigured' }
  if (-not $Demo) {
    & node @options
    if ($LASTEXITCODE -ne 0) { throw 'Complete the public mobile settings in .env, or add -Demo for sample data.' }
  }
  Set-Location -LiteralPath (Join-Path $taskRoot 'apps/mobile')
  if ($Target -eq 'preview') {
    & npx.cmd expo export --platform web
  } elseif ($Release) {
    $profile = if ($Demo) { "$App-demo" } else { "$App-production" }
    & npx.cmd eas-cli build --platform $Target --profile $profile
  } else {
    & npx.cmd expo prebuild --platform $Target --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Native project generation failed.' }
    & npx.cmd expo "run:$Target"
  }
  if ($LASTEXITCODE -ne 0) { throw 'Mobile build failed.' }
} finally {
  $env:APP_VARIANT = $previousVariant
  $env:APP_MODE = $previousMode
  Set-Location -LiteralPath $previousLocation
}
