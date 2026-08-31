@echo off
cd /d "%~dp0"
title Laser C-UAS
color 0A
echo.
echo  Laser C-UAS — one window launcher
echo.

set "NODEEXE="
if exist "%ProgramFiles%\nodejs\node.exe" set "NODEEXE=%ProgramFiles%\nodejs\node.exe"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODEEXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODEEXE set "NODEEXE=%%i"

if not defined NODEEXE (
  echo [ERROR] Node.js не найден в PATH.
  echo Скачайте LTS:  https://nodejs.org
  echo Поставьте галочку "Add to PATH", затем закройте ВСЕ окна и запустите START.cmd снова.
  echo.
  pause
  exit /b 1
)

echo Node: %NODEEXE%
echo Log:  %CD%\start.log
echo.
"%NODEEXE%" "%~dp0start.mjs"
echo.
echo Процесс завершился, код %ERRORLEVEL%
echo Лог: start.log
pause
