@echo off
chcp 65001 >nul
title 🎲 跑团助手 TTRPG Companion

cd /d "%~dp0"

echo.
echo   🎲 跑团助手 TTRPG Companion
echo   ─────────────────────────────
echo.
echo   启动方式:
echo   [1] Astro 开发模式 (推荐 — 带 HMR 热更新)
echo   [2] Node.js 本地服务器 + API 代理
echo   [3] 生产构建预览
echo.

set /p choice="请选择 (1/2/3): "

if "%choice%"=="1" goto :astro_dev
if "%choice%"=="2" goto :node_server
if "%choice%"=="3" goto :astro_preview
goto :node_server

:astro_dev
echo.
echo   启动 Astro 开发服务器 (带 HMR 热更新)...
echo   访问 http://localhost:4321
echo.
npx astro dev
goto :end

:node_server
echo.
echo   启动 Node.js 本地服务器 + API 代理...
node server.js
if %errorlevel% equ 0 goto :end

:: Fallback: Python
echo   Node.js not found — trying Python...
python server.py
if %errorlevel% equ 0 goto :end

:: Fallback: open directly
echo   No server available — opening directly...
start "" "index.html"
goto :end

:astro_preview
echo.
echo   构建并预览生产版本...
call npx astro build
npx astro preview
goto :end

:end
