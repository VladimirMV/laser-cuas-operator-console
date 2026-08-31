@echo off
title Laser C-UAS
cd /d "%~dp0"

echo.
echo  Laser C-UAS — starting sidecar + HMI
echo  Sidecar  http://127.0.0.1:8787
echo  HMI      http://127.0.0.1:5173
echo.

if not exist sidecar\node_modules (
  echo Installing sidecar deps...
  pushd sidecar
  call npm install --omit=dev
  call npm install ffmpeg-static --no-save
  popd
)

if not exist sidecar\node_modules\ffmpeg-static\ffmpeg.exe if not exist sidecar\node_modules\ffmpeg-static\ffmpeg (
  echo Installing ffmpeg-static for recording...
  pushd sidecar
  call npm install ffmpeg-static --no-save
  popd
)

set "FFMPEG_PATH="
if exist sidecar\node_modules\ffmpeg-static\ffmpeg.exe set "FFMPEG_PATH=%CD%\sidecar\node_modules\ffmpeg-static\ffmpeg.exe"
if exist sidecar\node_modules\ffmpeg-static\ffmpeg set "FFMPEG_PATH=%CD%\sidecar\node_modules\ffmpeg-static\ffmpeg"
for /f "delims=" %%i in ('where ffmpeg 2^>nul') do if not defined FFMPEG_PATH set "FFMPEG_PATH=%%i"
if defined FFMPEG_PATH (
  echo Using ffmpeg: %FFMPEG_PATH%
) else (
  echo WARNING: ffmpeg not on PATH. Recording needs:  winget install Gyan.FFmpeg
)

if not exist dist\index.html (
  echo dist\ missing — cannot start HMI.
  pause
  exit /b 1
)

start "Laser C-UAS sidecar" cmd /k "cd /d "%~dp0sidecar" && set FFMPEG_PATH=%FFMPEG_PATH% && node server.mjs"

echo Waiting for sidecar...
powershell -NoProfile -Command "for($i=0;$i -lt 40;$i++){ try { Invoke-WebRequest http://127.0.0.1:8787/health -UseBasicParsing | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 (
  echo Sidecar did not become ready. Check the sidecar window for errors.
  pause
  exit /b 1
)

echo Sidecar OK. Starting HMI...
start "" http://127.0.0.1:5173
node serve-dist.mjs
pause
