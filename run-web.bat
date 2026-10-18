@echo off
setlocal enabledelayedexpansion
title SCENE - Web Game Launcher
color 0B

:: Ensure script runs in pixel-perfect project root
cd /d "%~dp0"
if not exist "package.json" (
    if exist "pixel-perfect\package.json" (
        cd /d "%~dp0pixel-perfect"
    ) else (
        echo [ERROR] package.json not found!
        echo Please ensure this bat file is in the project directory.
        pause
        exit /b 1
    )
)

:: Check for direct CLI arguments
if /i "%~1"=="dev" goto :run_dev
if /i "%~1"=="hot" goto :run_dev
if /i "%~1"=="run" goto :run_dev
if /i "%~1"=="build" goto :run_build
if /i "%~1"=="preview" goto :run_preview
if /i "%~1"=="build-run" goto :run_build_run
if /i "%~1"=="test" goto :run_test

:menu
cls
echo =====================================================================
echo               SCENE: Tactical Card Battler - Web Launcher           
echo =====================================================================
echo.
echo   [1] HOT RELOAD DEV SERVER (npm run dev - Port 8080)  [Default in 5s]
echo   [2] BUILD WEB APP (Production bundle)
echo   [3] BUILD & PREVIEW (Build prod bundle and launch preview server)
echo   [4] RUN UNIT TESTS (vitest)
echo   [5] EXIT
echo.
echo =====================================================================

choice /c 12345 /t 5 /d 1 /n /m "Select option (1-5, defaults to 1 in 5s): "
set opt=!errorlevel!

if "!opt!"=="1" goto :run_dev
if "!opt!"=="2" goto :run_build
if "!opt!"=="3" goto :run_build_run
if "!opt!"=="4" goto :run_test
if "!opt!"=="5" exit /b 0

:run_dev
cls
echo =====================================================================
echo  [HOT RELOAD] Starting Vite Dev Server with HMR...
echo  Local:   http://localhost:8080/
echo  Network: http://0.0.0.0:8080/
echo =====================================================================
echo.
:: Launch default web browser after short delay in background
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:8080"
npm run dev -- --host 0.0.0.0 --port 8080
goto :end

:run_build
cls
echo =====================================================================
echo  [BUILD] Compiling production web bundle (Vite + Nitro)...
echo =====================================================================
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed with exit code %errorlevel%!
    pause
    goto :menu
)
echo.
echo [SUCCESS] Build completed successfully into .output/public/
pause
goto :menu

:run_build_run
cls
echo =====================================================================
echo  [BUILD & PREVIEW] Building and running production server...
echo =====================================================================
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed with exit code %errorlevel%!
    pause
    goto :menu
)
echo.
echo Starting preview server...
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:4173"
call npm run preview -- --host 0.0.0.0 --port 4173
goto :end

:run_test
cls
echo =====================================================================
echo  [TEST] Running Vitest test suite...
echo =====================================================================
echo.
call npm run test
pause
goto :menu

:end
echo.
echo Launcher closed.
exit /b 0
