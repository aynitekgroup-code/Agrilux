@echo off
REM ========================================
REM Agrilux - Build APK directo (sideload)
REM Sin necesidad de Google Play
REM ========================================

echo [1/4] Building web assets...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Web build fallido
    exit /b 1
)

echo [2/4] Syncing Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Capacitor sync fallido
    exit /b 1
)

echo [3/4] Building APK release (sideload)...
cd android
call gradlew.bat assembleRelease
if %errorlevel% neq 0 (
    echo ERROR: Gradle build fallido
    cd ..
    exit /b 1
)
cd ..

echo [4/4] Copiando APK a public para descarga directa...
if not exist "public" mkdir public
copy /Y "android\app\build\outputs\apk\release\app-release.apk" "public\agrilux.apk" >nul
if %errorlevel% neq 0 (
    echo WARNING: No se pudo copiar a public\agrilux.apk
)

echo.
echo ========================================
echo  APK generado correctamente!
echo ========================================
echo.
echo  Ubicacion Gradle:
echo    android\app\build\outputs\apk\release\app-release.apk
echo.
echo  Ubicacion para Vercel (descarga directa):
echo    public\agrilux.apk -^> https://tu-dominio.vercel.app/agrilux.apk
echo.
echo  Comparte este APK por:
echo    - WhatsApp / Telegram
echo    - Google Drive
echo    - QR hacia tu dominio /agrilux.apk
echo    - Pagina /descargar (ver Descargar.jsx)
echo.
echo  El usuario debe activar "Instalar apps desconocidas"
echo.
pause
