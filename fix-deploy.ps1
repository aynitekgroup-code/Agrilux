Remove-Item -Path "C:\Users\LENOVO\Documents\Trabajos UNI\agrilux\api\senamhi-scraper.js" -Force
Remove-Item -Path "C:\Users\LENOVO\Documents\Trabajos UNI\agrilux\api\recomendaciones-cana.js" -Force
Remove-Item -Path "C:\Users\LENOVO\Documents\Trabajos UNI\agrilux\api\voice-sales.js" -Force
Remove-Item -Path "C:\Users\LENOVO\Documents\Trabajos UNI\agrilux\api\plant-disease.js" -Force
Write-Host "Archivos eliminados. Ahora ejecuta:" -ForegroundColor Green
Write-Host 'cd "C:\Users\LENOVO\Documents\Trabajos UNI\agrilux"' -ForegroundColor Yellow
Write-Host "git add -A" -ForegroundColor Yellow
Write-Host 'git commit -m "Consolidate API to 12 functions for Vercel Hobby"' -ForegroundColor Yellow
Write-Host "git push" -ForegroundColor Yellow
