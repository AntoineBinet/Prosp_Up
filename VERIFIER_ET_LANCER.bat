@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
chcp 65001 >nul 2>&1
title ProspUp v24.0 - Verification + Lancement

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   ProspUp v24.0 — Verification du dossier   ║
echo  ╚══════════════════════════════════════════════╝
echo.

set "ERRORS=0"
set "WARNINGS=0"

:: ── 1. Python ──────────────────────────────────────
echo  [1/6] Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        ❌ Python non trouve dans le PATH
    echo        → Installez Python 3.11+ : https://www.python.org/downloads/
    set /a ERRORS+=1
) else (
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do echo        ✅ Python %%v
)

:: ── 2. Fichiers critiques backend ──────────────────
echo  [2/6] Fichiers backend...
set "MISSING_BACKEND=0"
for %%f in (app.py requirements.txt _run_serveur.bat PROSPUP.bat) do (
    if not exist "%%f" (
        echo        ❌ Manquant : %%f
        set /a MISSING_BACKEND+=1
        set /a ERRORS+=1
    )
)
if !MISSING_BACKEND!==0 echo        ✅ app.py, requirements.txt, PROSPUP.bat

:: ── 3. Fichiers frontend (pages HTML) ──────────────
echo  [3/6] Pages HTML...
set "HTML_COUNT=0"
for %%f in (*.html) do set /a HTML_COUNT+=1
if !HTML_COUNT! GEQ 15 (
    echo        ✅ !HTML_COUNT! pages HTML trouvees
) else (
    echo        ⚠️  Seulement !HTML_COUNT! pages HTML (attendu 15+)
    set /a WARNINGS+=1
)

:: ── 4. Static assets (CSS/JS) ──────────────────────
echo  [4/6] Assets statiques...
set "STATIC_OK=1"
if not exist "static\css\style.css" (
    echo        ❌ Manquant : static\css\style.css
    set "STATIC_OK=0"
    set /a ERRORS+=1
)
if not exist "static\js\app.js" (
    echo        ❌ Manquant : static\js\app.js
    set "STATIC_OK=0"
    set /a ERRORS+=1
)
if not exist "static\js\v8-features.js" (
    echo        ❌ Manquant : static\js\v8-features.js
    set "STATIC_OK=0"
    set /a ERRORS+=1
)
if not exist "static\sw.js" (
    echo        ❌ Manquant : static\sw.js
    set "STATIC_OK=0"
    set /a ERRORS+=1
)
if !STATIC_OK!==1 echo        ✅ CSS, JS, Service Worker

:: ── 5. React Native mobile (ProspUpMobile) ─────────
echo  [5/6] App mobile React Native...
set "MOBILE_OK=1"
if not exist "ProspUpMobile\app.json" (
    echo        ❌ Manquant : ProspUpMobile\app.json
    set "MOBILE_OK=0"
    set /a ERRORS+=1
)
if not exist "ProspUpMobile\services\api.ts" (
    echo        ❌ Manquant : ProspUpMobile\services\api.ts
    set "MOBILE_OK=0"
    set /a ERRORS+=1
)
if not exist "ProspUpMobile\app\_layout.tsx" (
    echo        ❌ Manquant : ProspUpMobile\app\_layout.tsx
    set "MOBILE_OK=0"
    set /a ERRORS+=1
)
set "MOBILE_COUNT=0"
if exist "ProspUpMobile" (
    for /r "ProspUpMobile" %%f in (*.ts *.tsx) do set /a MOBILE_COUNT+=1
)
if !MOBILE_OK!==1 echo        ✅ ProspUpMobile — !MOBILE_COUNT! fichiers TypeScript

:: ── 6. Dependances pip ─────────────────────────────
echo  [6/6] Dependances Python...
python -c "import flask; import waitress" >nul 2>&1
if %errorlevel% neq 0 (
    echo        ⚠️  Dependances manquantes, installation...
    pip install -r requirements.txt --quiet 2>nul
    if %errorlevel% neq 0 pip install -r requirements.txt --user --quiet 2>nul
    python -c "import flask; import waitress" >nul 2>&1
    if %errorlevel% neq 0 (
        echo        ❌ Echec installation des dependances
        set /a ERRORS+=1
    ) else (
        echo        ✅ Dependances installees avec succes
    )
) else (
    echo        ✅ Flask, Waitress installes
)

:: ── Bilan ──────────────────────────────────────────
echo.
echo  ──────────────────────────────────────────────
if !ERRORS! GTR 0 (
    echo   RESULTAT : !ERRORS! erreur(s), !WARNINGS! avertissement(s)
    echo   ❌ Corrigez les erreurs avant de lancer l'application.
    echo  ──────────────────────────────────────────────
    echo.
    pause
    exit /b 1
)
if !WARNINGS! GTR 0 (
    echo   RESULTAT : ✅ OK avec !WARNINGS! avertissement(s)
) else (
    echo   RESULTAT : ✅ Tout est bon !
)
echo  ──────────────────────────────────────────────
echo.
echo  Lancement de ProspUp dans 3 secondes...
timeout /t 3 /nobreak >nul

:: ── Lancer PROSPUP.bat ─────────────────────────────
call PROSPUP.bat
