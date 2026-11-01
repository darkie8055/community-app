$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$record = Join-Path $taskRoot '.local/processes.json'
if (-not (Test-Path -LiteralPath $record)) { return }
foreach ($owned in (Get-Content -LiteralPath $record -Raw | ConvertFrom-Json)) {
  $process = Get-Process -Id $owned.pid -ErrorAction SilentlyContinue
  if ($process -and $process.Path -eq $owned.executable -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$owned.started).ToUniversalTime().Ticks) {
    Stop-Process -Id $process.Id
    Write-Host "Stopped $($owned.name)."
  }
}
Remove-Item -LiteralPath $record
