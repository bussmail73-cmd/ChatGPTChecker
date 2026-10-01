@echo off
title GPT Service Lite Launcher
cd /d "%~dp0"

set "PYTHON_BIN=%~dp0python\python.exe"
set "PORT=8099"
set "NO_OPEN_BROWSER=1"

:: Start the background backend server
start /b "" "%~dp0bin\node.exe" "%~dp0server.js"

:: Give the server a moment to initialize
timeout /t 2 /nobreak >nul

:: Launch Desktop App Window (Edge / Chrome App Mode for pure native software feel)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:8099"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:8099"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="http://localhost:8099"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="http://localhost:8099"
) else (
    start "" "http://localhost:8099"
)

exit
