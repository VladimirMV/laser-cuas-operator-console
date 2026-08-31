@echo off
cd /d "%~dp0"
title Laser C-UAS HMI
if not exist dist\index.html (
  echo dist\index.html missing
  pause
  exit /b 1
)
echo Open http://127.0.0.1:5173
start "" http://127.0.0.1:5173
node serve-dist.mjs
pause
