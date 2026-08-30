@echo off
cd /d "%~dp0sidecar"
if not exist node_modules (
  echo Installing sidecar dependencies...
  call npm install
)
echo mediaRoot will be %CD%\media
echo Need FFmpeg in PATH:  winget install Gyan.FFmpeg
call npm start
pause
