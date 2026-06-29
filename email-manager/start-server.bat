@echo off
echo ============================================
echo   需求催办系统 - 一键启动
echo ============================================
echo.
echo [1/3] 检查环境...

if not exist ".env" (
    echo [错误] 未找到 .env 文件！
    echo 请复制 .env.example 为 .env，并填入真实配置。
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [错误] 未找到 node_modules，请先运行：npm install
    pause
    exit /b 1
)

echo [2/3] 停止已有的 Node 进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [3/3] 启动需求催办系统服务器...
echo.
echo ============================================
echo   访问地址：http://localhost:3000
echo   默认账号：admin / changeme
echo   按 Ctrl+C 停止服务
echo ============================================
echo.

node server.js

pause
