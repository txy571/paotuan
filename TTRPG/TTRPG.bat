@echo off
chcp 65001 >nul
title 🎲 跑团助手 TTRPG Companion

cd /d "%~dp0"

:: Try Python launcher (it handles port cleanup internally)
python launcher.py
if %errorlevel% equ 0 goto :end

:: Fallback: Python not available, try opening directly
echo.
echo   Python not found — opening directly in browser...
echo   (For full functionality including AI KP, please install Python 3.7+)
echo.
start "" "index.html"

:end
