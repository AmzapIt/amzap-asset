@echo off
setlocal
cd /d "D:\Myproject\my-app"
if errorlevel 1 goto failed

powershell.exe -NoProfile -Command "try { $c = [System.Net.Sockets.TcpClient]::new('127.0.0.1', 3000); $c.Dispose(); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo Port 3000 is already in use. No new app was started.
  goto close_window
)

call npm.cmd run build
if errorlevel 1 goto failed

powershell.exe -NoProfile -Command "$node = (Get-Command node.exe).Source; $p = Start-Process -FilePath $node -ArgumentList @('node_modules/next/dist/bin/next', 'start', '-p', '3000') -WorkingDirectory 'D:\Myproject\my-app' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'amzap-asset.stdout.log') -RedirectStandardError (Join-Path $env:TEMP 'amzap-asset.stderr.log') -PassThru; Start-Sleep -Seconds 2; $p.Refresh(); if ($p.HasExited) { Write-Error 'The app stopped during startup. Check amzap-asset.stderr.log in TEMP.'; exit 1 }; Write-Output ('App running at http://localhost:3000 (PID ' + $p.Id + ')')"
if errorlevel 1 goto failed

:done
echo The app will keep running after this window closes.
:close_window
echo This window will close in 10 seconds.
timeout /t 10 /nobreak >nul
exit /b 0

:failed
echo.
echo Could not build or start the app. Review the error above.
echo Press any key to close this window.
pause >nul
exit /b 1
