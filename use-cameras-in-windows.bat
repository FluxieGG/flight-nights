@echo off
title Restore All 3 USB Cameras to Windows (for Browser Calibration)
echo ========================================================
echo   Restoring All 3 USB Cameras to Windows Native Drivers
echo ========================================================
echo.
"C:\Program Files\usbipd-win\usbipd.exe" unbind --all
echo.
echo Current device status:
"C:\Program Files\usbipd-win\usbipd.exe" list
echo.
echo If you see an "Access denied" error above, right-click this .bat
echo and choose "Run as administrator".
echo ========================================================
pause
