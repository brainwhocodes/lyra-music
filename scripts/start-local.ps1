param([ValidateRange(1024,65535)][int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $repository
$localWorker = $null
try {
  if (-not (Test-Path -LiteralPath '.output/server/index.mjs')) { throw 'Build the app first with pnpm build.' }
  if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { throw "Port $Port is already in use. Choose another -Port or stop that server first." }
  $modelEnvironment = Join-Path $repository '.tools/models/runtime-env.ps1'
  if (Test-Path -LiteralPath $modelEnvironment) { . $modelEnvironment }
  & node scripts/migrate.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Database migration failed; the app was not started.' }
  $logDirectory = Join-Path $repository '.test-data/local-runtime'
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $run = [guid]::NewGuid().ToString('N')
  $localWorker = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('--import','tsx','scripts/worker.mjs') -WorkingDirectory $repository -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory "worker-$run.stdout.log") -RedirectStandardError (Join-Path $logDirectory "worker-$run.stderr.log")
  $env:HOST = '127.0.0.1'
  $env:PORT = "$Port"
  Write-Host "Lyra: http://127.0.0.1:$Port - daily recommendation worker is running. Press Ctrl+C to stop this session."
  & node --import dotenv/config .output/server/index.mjs
} finally {
  if ($null -ne $localWorker -and -not $localWorker.HasExited) { $localWorker.Kill(); $localWorker.WaitForExit() }
  Pop-Location
}
