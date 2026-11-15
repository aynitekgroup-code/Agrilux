@echo off
rem Crea la tarea que mantiene Agrilux conectado a Zonar en tiempo real:
rem arranca al iniciar sesion en Windows y lee Zonar cada 2 minutos.
rem Requiere: Node.js, "npm install" y "node configurar.mjs" ya hechos.
chcp 65001 >nul 2>&1
setlocal

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js. Instalalo desde https://nodejs.org
  pause
  exit /b 1
)
if not exist "%APPDATA%\agrilux-zonar\config.json" (
  echo [ERROR] Falta la configuracion. Ejecuta primero:  node configurar.mjs
  pause
  exit /b 1
)

set "TAREA=AgroTrack Zonar en vivo"
set "EJECUTOR=%~dp0ejecutar-envivo.bat"

schtasks /Create /F /TN "%TAREA%" /SC ONLOGON /TR "\"%EJECUTOR%\""
if errorlevel 1 (
  echo [ERROR] No se pudo crear la tarea programada.
  pause
  exit /b 1
)
schtasks /Run /TN "%TAREA%" >nul 2>&1

echo.
echo Tarea creada y en marcha: "%TAREA%" (arranca sola al iniciar sesion).
echo   - Lee Zonar cada 2 minutos y el historial de hoy cada 15 minutos.
echo   - Log: logs\envivo.log en esta carpeta.
echo   - La PC debe quedar encendida, con internet y con la sesion iniciada.
echo   - Para quitarla:  quitar-envivo.bat
echo.
pause
