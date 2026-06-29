@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title Local SMTP Relay Server
cd /d "%~dp0"

echo ================================================
echo   Local SMTP Mail Relay Server
echo ================================================
echo   127.0.0.1:2525
echo   Close this window to stop the server
echo ================================================
echo.

set "NODE_EXE="

:: 1. 优先使用系统 PATH 中的 node
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('where node') do (
        set "NODE_EXE=%%i"
        goto :found
    )
)

:: 2. 回退到常见安装目录
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
    goto :found
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
    goto :found
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    goto :found
)
if exist "%APPDATA%\nodejs\node.exe" (
    set "NODE_EXE=%APPDATA%\nodejs\node.exe"
    goto :found
)
if exist "C:\nodejs\node.exe" (
    set "NODE_EXE=C:\nodejs\node.exe"
    goto :found
)
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    goto :found
)
if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
    goto :found
)

:found
if not defined NODE_EXE set "NODE_EXE=node"

echo   Using: %NODE_EXE%
echo.

"%NODE_EXE%" server.js

if errorlevel 1 (
    echo.
    echo  [Error] Server failed to start. Code: %errorlevel%
    if "%NODE_EXE%"=="node" (
        echo  Please make sure Node.js is installed and available in PATH.
        echo  Download Node.js from https://nodejs.org/
    ) else (
        echo  Common causes: port 2525 is already in use, or server.js has an error.
        echo  Check the error message above for details.
    )
    pause
)

endlocal
