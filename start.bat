@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Smart Darts MVP (Windows 10 PC - Calibration ^& Tester)
echo ========================================================
echo   Backend API ^& Socket.IO : http://localhost:3001
echo   OpenDartboard Target    : ws://localhost:13520
echo   TV Browser Display URL  : http://localhost:5173
echo ========================================================
echo.
echo ^>^>^> Open http://localhost:5173 on your Windows 10 TV browser ^<^<^<
echo.

start "Smart Darts Backend" cmd /c "cd /d "%~dp0backend" && npm start"
cd /d "%~dp0frontend"
call npm run dev
