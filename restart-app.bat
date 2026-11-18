@echo off
rem Restart the AMZAP Asset app: build new code, stop the app on port 3000, start it again.
rem Build runs first so a failed build leaves the running app untouched.
setlocal
cd /d "D:\Myproject\my-app"
if errorlevel 1 goto failed

echo [1/3] Building the app...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo Build failed. The running app was NOT stopped.
  goto failed
)

echo [2/3] Stopping the app on port 3000...
powershell.exe -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -ne 'node') { Write-Error ('Port 3000 is used by ' + $p.ProcessName + ', not node. Not stopping it.'); exit 1 }; Stop-Process -Id $c.OwningProcess -Force; Start-Sleep -Seconds 2; Write-Output ('Stopped PID ' + $c.OwningProcess) } else { Write-Output 'App was not running.' }"
if errorlevel 1 goto failed

echo [3/3] Starting the app...
powershell.exe -NoProfile -Command "$node = (Get-Command node.exe).Source; $p = Start-Process -FilePath $node -ArgumentList @('node_modules/next/dist/bin/next', 'start', '-p', '3000') -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'amzap-asset.stdout.log') -RedirectStandardError (Join-Path $env:TEMP 'amzap-asset.stderr.log') -PassThru; Start-Sleep -Seconds 4; $p.Refresh(); if ($p.HasExited) { Write-Error 'The app stopped during startup. Check amzap-asset.stderr.log in TEMP.'; exit 1 }; Write-Output ('App running at http://localhost:3000 (PID ' + $p.Id + ')')"
if errorlevel 1 goto failed

echo.
echo Restart complete. The app keeps running after this window closes.
echo This window will close in 10 seconds.
timeout /t 10 /nobreak >nul
exit /b 0

:failed
echo.
echo Could not restart the app. Review the error above.
echo Press any key to close this window.
pause >nul
exit /b 1
