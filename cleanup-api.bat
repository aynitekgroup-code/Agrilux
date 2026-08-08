@echo off
echo ========================================
echo Eliminando endpoints redundantes para Vercel Hobby (12 max)
echo ========================================
echo.

cd /d "%~dp0"

if exist "api\senamhi-scraper.js" (
    del "api\senamhi-scraper.js"
    echo [OK] Eliminado api\senamhi-scraper.js
) else (
    echo [SKIP] api\senamhi-scraper.js ya no existe
)

if exist "api\recomendaciones-cana.js" (
    del "api\recomendaciones-cana.js"
    echo [OK] Eliminado api\recomendaciones-cana.js
) else (
    echo [SKIP] api\recomendaciones-cana.js ya no existe
)

if exist "api\voice-sales.js" (
    del "api\voice-sales.js"
    echo [OK] Eliminado api\voice-sales.js
) else (
    echo [SKIP] api\voice-sales.js ya no existe
)

if exist "api\plant-disease.js" (
    del "api\plant-disease.js"
    echo [OK] Eliminado api\plant-disease.js
) else (
    echo [SKIP] api\plant-disease.js ya no existe
)

echo.
echo Listo! Ahora ejecuta: git add -A ^&^& git commit -m "Consolidate API endpoints for Vercel Hobby" ^&^& git push
pause
