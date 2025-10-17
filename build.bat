@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: Moment-TabManager 构建脚本 (Windows)
:: 用于生成Chrome Web Store发布包

echo.
echo 🚀 开始构建 Moment-TabManager 扩展包...
echo.

:: 设置变量
set "SOURCE_DIR=%~dp0"
set "BUILD_DIR=%SOURCE_DIR%dist"
set "TEMP_DIR=%SOURCE_DIR%temp_build"

:: 检查PowerShell是否可用
powershell -Command "Get-Host" >nul 2>&1
if errorlevel 1 (
    echo ❌ 需要PowerShell支持，请确保PowerShell已安装
    pause
    exit /b 1
)

:: 1. 预构建检查
echo 🔍 执行预构建检查...

:: 检查必需文件
set "required_files=manifest.json background.js sidepanel.html"
for %%f in (%required_files%) do (
    if not exist "%%f" (
        echo ❌ 缺少必需文件: %%f
        pause
        exit /b 1
    )
)

:: 检查manifest.json并获取版本号
for /f "tokens=2 delims=:, " %%a in ('findstr /r "\"version\"" manifest.json') do (
    set "version=%%a"
    set "version=!version:"=!"
)

if "!version!"=="" (
    echo ❌ 无法从manifest.json读取版本号
    pause
    exit /b 1
)

echo    ✅ 扩展版本: !version!
echo    ✅ 预构建检查通过
echo.

:: 2. 清理构建目录
echo 🧹 清理构建目录...
if exist "%BUILD_DIR%" (
    rmdir /s /q "%BUILD_DIR%" 2>nul
)
mkdir "%BUILD_DIR%" 2>nul
echo    ✅ 构建目录已清理
echo.

:: 3. 复制文件
echo 📁 复制源文件...

:: 创建临时目录用于过滤
if exist "%TEMP_DIR%" (
    rmdir /s /q "%TEMP_DIR%" 2>nul
)
mkdir "%TEMP_DIR%" 2>nul

:: 复制所有文件到临时目录
xcopy /s /e /q "%SOURCE_DIR%*" "%TEMP_DIR%\" >nul 2>&1

:: 删除不需要的文件和目录
pushd "%TEMP_DIR%"

:: 删除开发文件
if exist "build.js" del /q "build.js" 2>nul
if exist "build.bat" del /q "build.bat" 2>nul
if exist "build.sh" del /q "build.sh" 2>nul
if exist "*.md" del /q "*.md" 2>nul
if exist "test-*.html" del /q "test-*.html" 2>nul
if exist "*.log" del /q "*.log" 2>nul
if exist "*.tmp" del /q "*.tmp" 2>nul
if exist "*.bak" del /q "*.bak" 2>nul

:: 删除目录
if exist "dist" rmdir /s /q "dist" 2>nul
if exist "temp_build" rmdir /s /q "temp_build" 2>nul
if exist "node_modules" rmdir /s /q "node_modules" 2>nul
if exist ".git" rmdir /s /q ".git" 2>nul

popd

:: 移动清理后的文件到构建目录
move "%TEMP_DIR%\*" "%BUILD_DIR%\" >nul 2>&1
rmdir "%TEMP_DIR%" 2>nul

echo    ✅ 源文件复制完成
echo.

:: 4. 验证构建结果
echo 🔍 验证构建结果...

:: 检查必需文件
pushd "%BUILD_DIR%"
for %%f in (%required_files%) do (
    if not exist "%%f" (
        echo ❌ 构建后缺少文件: %%f
        popd
        pause
        exit /b 1
    )
)
popd

:: 计算构建包大小
for /f "tokens=3" %%a in ('dir "%BUILD_DIR%" /s /-c ^| findstr /r "个文件"') do (
    set "build_size=%%a"
)

echo    ✅ 构建结果验证通过
echo    ✅ 构建包大小: !build_size! 字节
echo.

:: 5. 创建ZIP包
echo 📦 创建发布包...

set "ZIP_NAME=momenttabmanager-v!version!.zip"
set "ZIP_PATH=%SOURCE_DIR%!ZIP_NAME!"

:: 删除旧的ZIP文件
if exist "!ZIP_PATH!" del /q "!ZIP_PATH!" 2>nul

:: 使用PowerShell创建ZIP包
powershell -Command "Compress-Archive -Path '%BUILD_DIR%\*' -DestinationPath '!ZIP_PATH!' -Force" 2>nul

if not exist "!ZIP_PATH!" (
    echo ❌ 创建ZIP包失败
    pause
    exit /b 1
)

:: 获取ZIP文件大小
for %%a in ("!ZIP_PATH!") do set "zip_size=%%~za"

echo    ✅ 发布包已创建: !ZIP_NAME!
echo    ✅ 包大小: !zip_size! 字节
echo.

:: 6. 构建完成
echo 🎉 构建完成!
echo.
echo 📋 下一步操作:
echo    1. 测试扩展包功能
echo    2. 上传到Chrome Web Store  
echo    3. 发布新版本
echo.
echo 📦 发布包位置: !ZIP_NAME!
echo 📁 构建目录: dist\
echo.

:: 询问是否打开文件夹
set /p "open_folder=是否打开包含发布包的文件夹? (y/N): "
if /i "!open_folder!"=="y" (
    explorer "%SOURCE_DIR%"
)

:: 询问是否清理构建目录
set /p "clean_build=是否清理构建目录? (y/N): "
if /i "!clean_build!"=="y" (
    if exist "%BUILD_DIR%" (
        rmdir /s /q "%BUILD_DIR%" 2>nul
        echo    ✅ 构建目录已清理
    )
)

echo.
echo ✨ 构建脚本执行完成!
pause
