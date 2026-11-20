@echo off
rem Elimina la tarea programada del agente.
chcp 65001 >nul 2>&1
setlocal
set "TAREA=AgroTrack Zonar diario"
schtasks /Delete /F /TN "%TAREA%"
if errorlevel 1 (
  echo [ERROR] No se pudo eliminar la tarea (quizas no existe).
) else (
  echo Tarea "%TAREA%" eliminada.
)
pause
