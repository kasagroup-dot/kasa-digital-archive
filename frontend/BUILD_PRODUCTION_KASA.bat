@echo off
setlocal
title KASA Digital Archive - Production Build

echo ============================================================
echo   KASA DIGITAL ARCHIVE - PRODUCTION BUILD
echo ============================================================
echo.

cd /d "%~dp0"

if not exist "package.json" (
    echo [ERROR] package.json tidak ditemukan.
    echo Simpan file BAT ini di folder frontend.
    pause
    exit /b 1
)

echo [1/4] Hapus build lama...
if exist "dist" rmdir /s /q "dist"

echo [2/4] Pakai konfigurasi production...
set "VITE_API_URL=https://kasa-digital-archive-production.up.railway.app/api/v1"
set "VITE_APP_VERSION=FULLSTACK-0.14.1"

echo [3/4] Build production...
call npm run build
if errorlevel 1 (
    echo.
    echo [GAGAL] npm run build gagal. Jangan upload dist.
    pause
    exit /b 1
)

echo [4/4] Validasi hasil build...
findstr /S /I /M /C:"localhost:4000" "dist\*.js" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo [GAGAL] localhost:4000 masih ada di dist. Jangan upload.
    pause
    exit /b 1
)

findstr /S /I /M /C:"kasa-digital-archive-production.up.railway.app" "dist\*.js" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [GAGAL] URL Railway production tidak ditemukan di dist.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo [SUKSES] BUILD PRODUCTION AMAN
echo localhost:4000         = TIDAK ADA
echo Railway production URL = ADA
echo ============================================================
echo.
echo Folder siap upload:
echo %CD%\dist
start "" explorer "%CD%\dist"
pause
endlocal
