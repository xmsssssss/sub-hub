@echo off
chcp 65001 >nul
title SUB - 机场订阅聚合与节点管理系统

echo ========================================================
echo        SUB - 机场订阅聚合与节点管理系统 (Mihomo Core)
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境，请先安装 Node.js (推荐 v18 或更高版本): https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖组件...
    call npm install
    echo [提示] 依赖安装完成！
    echo.
)

if not exist "mihomo.exe" (
    echo [提示] 未检测到 mihomo.exe 内核，正在自动下载 Windows amd64 版本...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://github.com/MetaCubeX/mihomo/releases/download/v1.19.0/mihomo-windows-amd64-v1.19.0.zip' -OutFile 'mihomo.zip'; Expand-Archive -Path 'mihomo.zip' -DestinationPath '.'; Rename-Item -Path 'mihomo-windows-amd64.exe' -NewName 'mihomo.exe' -ErrorAction SilentlyContinue; Remove-Item 'mihomo.zip' -ErrorAction SilentlyContinue; echo '[提示] mihomo.exe 下载就绪' } catch { echo '[警告] 自动下载内核失败，可手动将 mihomo.exe 放置于项目根目录下' }"
    echo.
)

if not exist "dist" (
    echo [提示] 正在构建前端界面...
    call npm run build
    echo [提示] 前端构建完成！
    echo.
)

echo [提示] 正在启动 SUB 服务...
echo 访问地址: http://127.0.0.1:3580
echo 默认账号: admin
echo 默认密码: admin123456
echo ========================================================
echo.

node backend/server.js
pause
