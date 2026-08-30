@echo off
cd /d "%~dp0"
where docker >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is not installed or not in PATH.
  echo https://docs.docker.com/desktop/setup/install/windows-install/
  pause
  exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo Start Docker Desktop and wait until it is running, then run this file again.
  pause
  exit /b 1
)
if not exist sidecar\media mkdir sidecar\media
echo HMI     http://127.0.0.1:5173
echo sidecar http://127.0.0.1:8787/status
echo files   %CD%\sidecar\media
docker compose up --build
