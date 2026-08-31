@echo off
setlocal EnableExtensions
title Laser C-UAS
cd /d "%~dp0"

echo.
echo  Laser C-UAS
echo  Sidecar  http://127.0.0.1:8787
echo  HMI      http://127.0.0.1:5173
echo.

if not exist dist\index.html (
  echo ERROR: dist\index.html missing. Unzip the full archive.
  pause
  exit /b 1
)

if not exist sidecar\server.mjs (
  echo ERROR: sidecar\server.mjs missing.
  pause
  exit /b 1
)

if not exist sidecar\node_modules (
  echo First run: npm install in sidecar...
  pushd sidecar
  call npm install --omit=dev --no-audit --no-fund
  popd
)

REM Child window inherits this env. Do not nest quotes in start.
set "FFMPEG_PATH="
if exist "%CD%\sidecar\node_modules\ffmpeg-static\ffmpeg.exe" set "FFMPEG_PATH=%CD%\sidecar\node_modules\ffmpeg-static\ffmpeg.exe"
if not defined FFMPEG_PATH if exist "%CD%\sidecar\node_modules\ffmpeg-static\ffmpeg" set "FFMPEG_PATH=%CD%\sidecar\node_modules\ffmpeg-static\ffmpeg"
if not defined FFMPEG_PATH (
  for /f "delims=" %%i in ('where ffmpeg 2^>nul') do (
    if not defined FFMPEG_PATH set "FFMPEG_PATH=%%i"
  )
)
if defined FFMPEG_PATH (
  echo ffmpeg: %FFMPEG_PATH%
) else (
  echo ffmpeg: not found yet — sidecar will search WinGet / PATH
)

echo Starting sidecar...
start "Laser C-UAS sidecar" /D "%CD%\sidecar" cmd /k node server.mjs

echo Waiting for http://127.0.0.1:8787 ...
set SIDECAR_OK=0
powershell -NoProfile -Command "for($i=0;$i -lt 20;$i++){ try { Invoke-WebRequest http://127.0.0.1:8787/health -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { Start-Sleep -Milliseconds 500 } }; exit 1"
if not errorlevel 1 set SIDECAR_OK=1
if "%SIDECAR_OK%"=="1" (
  echo Sidecar OK
) else (
  echo Sidecar not ready yet — HMI will still open. Look at the sidecar window.
)

echo Starting HMI...
start "" http://127.0.0.1:5173
node serve-dist.mjs
echo.
echo HMI stopped.
pause
