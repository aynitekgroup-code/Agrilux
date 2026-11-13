@echo off
rem Corrida diaria del agente (la llama la tarea programada a las 05:30).
rem Toda la salida queda en logs\tarea.log dentro de esta carpeta.
chcp 65001 >nul 2>&1
cd /d "%~dp0"
if not exist logs mkdir logs
node agente.mjs correr >> "logs\tarea.log" 2>&1
