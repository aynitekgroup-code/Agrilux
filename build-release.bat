@echo off
REM ========================================
REM Agrilux - Build Release AAB for Play Store
REM ========================================

echo [1/4] Building web assets...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Web build failed
    exit /b 1
)

echo [2/4] Syncing Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Capacitor sync failed
    exit /b 1
)

echo [3/4] Building release AAB...
cd android
call gradlew.bat bundleRelease
if %errorlevel% neq 0 (
    echo ERROR: Gradle build failed
    cd ..
    exit /b 1
)
cd ..

echo [4/4] Done!
echo.
echo Release AAB location:
echo   android\app\build\outputs\bundle\release\app-release.aab
echo.
echo Upload this file to Google Play Console:
echo   https://play.google.com/console
echo.
pause
