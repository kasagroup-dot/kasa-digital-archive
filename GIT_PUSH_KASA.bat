@echo off
setlocal
title KASA Digital Archive - Git Push

echo ============================================================
echo   KASA DIGITAL ARCHIVE - GIT PUSH
echo ============================================================
echo.

cd /d "%~dp0"

if not exist ".git" (
    echo [ERROR] Folder .git tidak ditemukan.
    echo Simpan file BAT ini di root kasa-digital-archive.
    pause
    exit /b 1
)

git status
echo.
set /p MSG=Masukkan commit message: 
if "%MSG%"=="" set "MSG=Update KASA Digital Archive"

git add -A
git commit -m "%MSG%"

echo.
echo Push ke origin main...
git push origin main
if errorlevel 1 (
    echo [GAGAL] git push gagal. Cek pesan di atas.
    pause
    exit /b 1
)

echo.
echo [SUKSES] Git push selesai.
git log -1 --oneline
pause
endlocal
