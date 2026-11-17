# Runs in the foreground so Task Scheduler can monitor and restart the app.
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$logPath = Join-Path $env:TEMP 'amzap-asset-autostart.log'

function Write-StartupLog([string] $message) {
  Add-Content -LiteralPath $logPath -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message)
}

try {
  if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory 'package.json'))) {
    throw "Cannot find package.json in $projectDirectory"
  }

  Set-Location -LiteralPath $projectDirectory

  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 3000 is already in use. Check the running app before starting another one.'
  }

  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $next = Join-Path $projectDirectory 'node_modules\next\dist\bin\next'
  if (-not (Test-Path -LiteralPath $next)) {
    throw 'Next.js is not installed. Run npm install in the project folder first.'
  }

  Write-StartupLog 'Building application.'
  & $npm run build *>> $logPath
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed with exit code $LASTEXITCODE. See $logPath"
  }

  Write-StartupLog 'Starting application on port 3000.'
  & $node $next start -p 3000 *>> $logPath
  throw "Application stopped with exit code $LASTEXITCODE. See $logPath"
} catch {
  Write-StartupLog $_.Exception.Message
  exit 1
}
