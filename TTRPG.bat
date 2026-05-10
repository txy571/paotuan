@echo off
chcp 65001 >nul
title 🎲 跑团助手 TTRPG Companion

cd /d "%~dp0"

:: Try Node.js server first (primary)
node server.js
if %errorlevel% equ 0 goto :end

:: Fallback: Python server
echo.
echo   Node.js not found — trying Python...
python server.py
if %errorlevel% equ 0 goto :end

:: Fallback: Neither available, open directly
echo.
echo   No server available — opening directly in browser...
echo   (For full functionality including AI KP, please install Node.js or Python 3.7+)
echo.
start "" "index.html"

:end
