@echo off
cd /d "%~dp0sidecar"
title Laser C-UAS sidecar
if not exist node_modules (
  echo npm install...
  call npm install --omit=dev --no-audit --no-fund
)
if exist "%CD%\node_modules\ffmpeg-static\ffmpeg.exe" set "FFMPEG_PATH=%CD%\node_modules\ffmpeg-static\ffmpeg.exe"
echo mediaRoot=%CD%\media
echo FFMPEG_PATH=%FFMPEG_PATH%
node server.mjs
pause
