@echo off
rem Detiene y elimina la tarea del modo en vivo.
chcp 65001 >nul 2>&1
setlocal
set "TAREA=AgroTrack Zonar en vivo"
schtasks /End /TN "%TAREA%" >nul 2>&1
schtasks /Delete /F /TN "%TAREA%"
if errorlevel 1 (
  echo [ERROR] No se pudo eliminar la tarea (quizas no existe).
) else (
  echo Tarea "%TAREA%" eliminada.
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*agente.mjs envivo*' -or $_.CommandLine -like '*ejecutar-envivo.bat*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
pause
