@echo off
title Bind All 3 USB Cameras to WSL (for OpenDartboard Live Scorer)
echo ========================================================
echo   Binding All 3 USB Cameras for WSL / OpenDartboard
echo ========================================================
echo.
"C:\Program Files\usbipd-win\usbipd.exe" bind --busid 1-7 --force
"C:\Program Files\usbipd-win\usbipd.exe" bind --busid 1-9 --force
"C:\Program Files\usbipd-win\usbipd.exe" bind --busid 3-3 --force
echo.
echo Current device status:
"C:\Program Files\usbipd-win\usbipd.exe" list
echo.
echo If you see an "Access denied" error above, right-click this .bat
echo and choose "Run as administrator".
echo ========================================================
pause
