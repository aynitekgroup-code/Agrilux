@echo off
rem Crea la tarea programada que corre el agente todos los dias a las 05:30.
rem Requiere: Node.js instalado y la configuracion ya hecha (configurar.mjs).
chcp 65001 >nul 2>&1
setlocal

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js.
  echo         Instalalo desde https://nodejs.org y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist "%~dp0config.json" (
  echo [ERROR] Falta la configuracion. Ejecuta primero:  node configurar.mjs
  pause
  exit /b 1
)

set "TAREA=AgroTrack Zonar diario"
set "EJECUTOR=%~dp0ejecutar-tarea.bat"

schtasks /Create /F /TN "%TAREA%" /SC DAILY /ST 05:30 /TR "\"%EJECUTOR%\""
if errorlevel 1 (
  echo [ERROR] No se pudo crear la tarea programada.
  pause
  exit /b 1
)

echo.
echo Tarea creada correctamente: "%TAREA%" (todos los dias, 05:30).
echo.
echo Notas:
echo   - La PC debe estar encendida y con la sesion de Windows iniciada.
echo   - El agente corre en ESTA maquina, por lo que a Zonar sale con tu IP.
echo   - Revisa la tarea con:  schtasks /Query /TN "%TAREA%" /V /FO LIST
echo   - Para quitarla ejecuta:  quitar-tarea.bat
echo.
pause
