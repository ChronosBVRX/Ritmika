@echo off
title Ritmika - Build Launcher + Instalador
cd /d "%~dp0"
setlocal EnableDelayedExpansion

echo.
echo   ============================================
echo      RITMIKA - BUILD DESKTOP AUTOCONTENIDO
echo   ============================================
echo.

echo   [1/6] Verificando WebView2 SDK...
if not exist "libs\webview2\Microsoft.Web.WebView2.Core.dll" (
    echo   [+] Descargando WebView2 SDK...
    powershell -ExecutionPolicy Bypass -NoProfile -File "scripts\download_deps.ps1"
    if errorlevel 1 echo   [WARN] Fallo descarga WebView2 SDK
)
echo.

echo   [2/6] Runtime Node autocontenido (22 LTS)...
if not exist "runtime\node\node.exe" (
    echo   [+] Descargando Node 22 LTS...
    powershell -ExecutionPolicy Bypass -NoProfile -File "scripts\download_node_runtime.ps1" -NodeVersion 22.18.0
    if errorlevel 1 (
        echo   [ERROR] No se pudo descargar Node runtime. Verifica internet.
        pause
        exit /b 1
    )
) else (
    echo   [OK] runtime\node\node.exe ya existe
    runtime\node\node.exe --version
)
echo.

echo   [3/6] Dependencias Node (produccion) + better-sqlite3...
if not exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
    echo   [+] npm ci --production
    call npm ci --production --no-audit --no-fund
    if errorlevel 1 call npm install --production
)
echo   Verificando better-sqlite3 para Node !NODE_VERSION! ...
runtime\node\node.exe -e "require('better-sqlite3'); console.log('better-sqlite3 OK')" 2>&1
if errorlevel 1 (
    echo   [WARN] better-sqlite3 no coincide con runtime Node, rebuildeando...
    runtime\node\node.exe "%~dp0runtime\node\npm" rebuild better-sqlite3 2>&1 | more
    call runtime\node\node.exe -e "require('better-sqlite3'); console.log('better-sqlite3 OK')" 2>&1
    if errorlevel 1 (
        echo   [ERROR] better-sqlite3 sigue fallando. Ejecuta: npm rebuild better-sqlite3
        pause
        exit /b 1
    )
) else echo   [OK] better-sqlite3 compatible
echo.

echo   [4/6] Generando icono...
powershell -ExecutionPolicy Bypass -NoProfile -File "scripts\generate_icon.ps1"
if not exist "ritmika.ico" echo   [WARN] No se pudo generar el icono
echo.

echo   [5/6] Compilando Ritmika.exe...
set CSC=
if exist "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe" set "CSC=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if "%CSC%"=="" (
    echo   [ERROR] No se encontro .NET 4.x. Asegurate de tener .NET Framework 4.6+.
    pause
    exit /b 1
)
echo   Compilador: %CSC%
set WV2=libs\webview2
"%CSC%" /nologo /target:winexe /win32icon:ritmika.ico ^
    /reference:System.Windows.Forms.dll ^
    /reference:System.Drawing.dll ^
    /reference:"%WV2%\Microsoft.Web.WebView2.Core.dll" ^
    /reference:"%WV2%\Microsoft.Web.WebView2.WinForms.dll" ^
    /out:Ritmika.exe src\Launcher.cs src\GameWindow.cs
if errorlevel 1 (
    echo   [ERROR] Compilacion fallida
    pause
    exit /b 1
)
echo   [OK] Ritmika.exe creado! 
for %%f in (Ritmika.exe) do echo   Tamano: %%~zf bytes
copy /y "%WV2%\Microsoft.Web.WebView2.Core.dll" "." >nul 2>&1
copy /y "%WV2%\Microsoft.Web.WebView2.WinForms.dll" "." >nul 2>&1
copy /y "%WV2%\WebView2Loader.dll" "." >nul 2>&1
echo   [OK] DLLs copiadas
echo.

echo   [6/6] Instalador Inno Setup...
where iscc >nul 2>&1
if %errorlevel%==0 (
    echo   [+] Compilando instalador con ISCC...
    iscc installer.iss
    if errorlevel 1 (
        echo   [WARN] ISCC fallo
    ) else (
        echo   [OK] Instalador generado en installer\output\
        dir /b installer\output\*.exe
    )
) else (
    echo   [INFO] Inno Setup (iscc) no encontrado. Para generar Ritmika-Setup-x64.exe:
    echo         1. Instala Inno Setup 6: https://jrsoftware.org/isinfo.php
    echo         2. Asegurate de que iscc este en PATH
    echo         3. Ejecuta: iscc installer.iss
    echo         O usa: build.bat (este paso es opcional para desarrollo)
)
echo.
echo   ============================================
echo   BUILD COMPLETO
echo   - Ritmika.exe (autocontenido, usa runtime\node\node.exe)
echo   - Ejecuta Ritmika.exe para probar local
echo   - Instalador: installer\output\Ritmika-Setup-x64-1.0.1.exe (si iscc disponible)
echo   ============================================
echo.
