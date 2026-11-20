@echo off
rem Modo EN VIVO del agente (Zonar -> Agrilux cada 10 minutos).
rem Lo arranca la tarea "AgroTrack Zonar en vivo" al iniciar sesion en Windows.
rem Si el proceso se cae, vuelve a arrancar a los 60 segundos.
chcp 65001 >nul 2>&1
cd /d "%~dp0"
if not exist logs mkdir logs
:bucle
node agente.mjs envivo >> "logs\envivo.log" 2>&1
timeout /t 60 /nobreak >nul
goto bucle
