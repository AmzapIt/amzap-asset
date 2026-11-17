# Register the app to start after this Windows account signs in.
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$runner = Join-Path $projectDirectory 'start-app-auto.ps1'
$taskName = 'AMZAP Asset App'
$userName = [Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $runner)) {
  throw "Cannot find $runner"
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $runner) `
  -WorkingDirectory $projectDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userName
$principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Build and start AMZAP Asset after Windows sign-in.' `
  -Force | Out-Null

Write-Output "Installed scheduled task: $taskName"
Write-Output "Project: $projectDirectory"
Write-Output "Log: $(Join-Path $env:TEMP 'amzap-asset-autostart.log')"
