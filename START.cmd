@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Laser C-UAS

echo.
echo  Laser C-UAS launcher
echo  Folder:
echo  %CD%
echo.

echo %CD% | find /I "\Temp\" >nul
if not errorlevel 1 goto :FROMZIP
echo %CD% | find /I ".zip" >nul
if not errorlevel 1 goto :FROMZIP
echo %CD% | find /I ".dbl" >nul
if not errorlevel 1 goto :FROMZIP

if not exist "%~dp0start.mjs" goto :MISSING
if not exist "%~dp0sidecar\server.mjs" goto :MISSING
if not exist "%~dp0dist\index.html" goto :MISSING

set "NODEEXE="
if exist "%ProgramFiles%\nodejs\node.exe" set "NODEEXE=%ProgramFiles%\nodejs\node.exe"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODEEXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODEEXE set "NODEEXE=%%i"
if not defined NODEEXE goto :NONODE

echo Node: %NODEEXE%
echo Log:  %CD%\start.log
echo.
"%NODEEXE%" "%~dp0start.mjs"
echo.
echo Exit code %ERRORLEVEL%
echo Log file: start.log
pause
exit /b %ERRORLEVEL%

:FROMZIP
echo.
echo  ========================================
echo  DO NOT RUN FROM INSIDE THE ZIP FILE.
echo  ========================================
echo.
echo  Windows opened the archive in Temp.
echo  Node cannot start from there.
echo.
echo  Do this:
echo    1. Close this window
echo    2. Right-click  Laser_CUAS_HMI_v1.8.1_RealRecord.zip
echo    3. Extract All...   to  Desktop
echo    4. Open the extracted FOLDER
echo    5. Double-click START.cmd  inside that folder
echo.
echo  Path now:
echo  %CD%
echo.
pause
exit /b 1

:MISSING
echo.
echo  ERROR: archive is incomplete in this folder.
echo  Need:  start.mjs   sidecar\server.mjs   dist\index.html
echo.
echo  Extract the FULL zip to Desktop, then run START.cmd there.
echo.
dir /b
echo.
pause
exit /b 1

:NONODE
echo.
echo  ERROR: Node.js not found.
echo  Install LTS from https://nodejs.org
echo  Check "Add to PATH", reboot, run START.cmd again.
echo.
pause
exit /b 1
