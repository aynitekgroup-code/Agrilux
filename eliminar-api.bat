@echo off
echo Eliminando archivos API innecesarios...
cd /d "%~dp0"
del /f /q "api\whatsapp-webhook.js" 2>nul
del /f /q "api\crop-health.js" 2>nul
del /f /q "api\senamhi-scraper.js" 2>nul
del /f /q "api\plant-disease.js" 2>nul
rmdir /s /q "api\scrapers" 2>nul
echo Archivos eliminados.
echo.
echo Archivos API restantes:
dir /b api\*.js
pause
