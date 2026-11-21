@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Smart Darts MVP (Windows 10 PC) - Dependency Setup
echo ========================================================

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [setup] Created .env from .env.example
  )
)

echo.
echo [setup] Installing backend dependencies (/backend)...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 exit /b 1

echo.
echo [setup] Installing frontend dependencies (/frontend)...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 exit /b 1

if exist "node_modules\esbuild\install.js" (
  node node_modules\esbuild\install.js
)

cd /d "%~dp0"
echo.
echo ========================================================
echo   Setup complete! Run start.bat to launch the app.
echo ========================================================
