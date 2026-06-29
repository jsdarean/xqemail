@echo off
echo ============================================
echo   需求催办系统 + 邮件插件 一键启动
echo ============================================
echo.
cd /d "%~dp0"

echo [1/5] 检查环境...

if not exist "email-manager\.env" (
    echo [错误] 未找到 email-manager\.env 文件！
    echo 请复制 email-manager\.env.example 为 email-manager\.env，并填入真实配置。
    pause
    exit /b 1
)

if not exist "email-manager\node_modules" (
    echo [错误] 未找到 email-manager\node_modules，请先运行：
    echo   cd email-manager ^&^& npm install
    pause
    exit /b 1
)

if not exist "requirement-email-extractor\local-smtp-server\node_modules" (
    echo [错误] 未找到 requirement-email-extractor\local-smtp-server\node_modules，请先运行：
    echo   cd requirement-email-extractor\local-smtp-server ^&^& npm install
    pause
    exit /b 1
)

echo [2/5] 停止已有的 Node 进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [3/5] 启动需求催办 Web 服务...
start "需求催办系统" /D "%~dp0email-manager" cmd /c "node server.js"
timeout /t 2 /nobreak >nul

echo [4/5] 启动本地 SMTP 中继服务...
start "本地SMTP中继" /D "%~dp0requirement-email-extractor\local-smtp-server" cmd /c "node server.js"
timeout /t 2 /nobreak >nul

echo [5/5] 服务启动完成！
echo.
echo ============================================
echo   Web 管理后台：http://localhost:3000
echo   插件/发件服务：http://localhost:2525
echo.
echo   * 关闭"需求催办系统"窗口 - 停止 3000 端口
echo   * 关闭"本地SMTP中继"窗口 - 停止 2525 端口
echo ============================================
echo.
echo 提示：Chrome 插件需要 2525 端口服务才能发邮件和刷新收件人。
echo.
pause
