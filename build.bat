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
echo   Node runtime: 
runtime\node\node.exe --version
if errorlevel 1 (
    echo   [ERROR] runtime\node\node.exe no ejecuta
    pause
    exit /b 1
)
echo   Verificando ABI y better-sqlite3 con runtime empaquetado...
runtime\node\node.exe -e "console.log('Node',process.version,'ABI',process.versions.modules); require('better-sqlite3'); console.log('better-sqlite3 OK:'+require('better-sqlite3')('server/songs.db').prepare('SELECT COUNT(*) as c FROM songs').get().c+' canciones')" 2>&1
if errorlevel 1 (
    echo   [+] Instalando dependencias con npm del runtime empaquetado...
    if exist "runtime\node\node_modules\npm\bin\npm-cli.js" (
        runtime\node\node.exe runtime\node\node_modules\npm\bin\npm-cli.js ci --omit=dev --no-audit --no-fund
    ) else (
        runtime\node\node.exe runtime\node\npm ci --omit=dev --no-audit --no-fund 2>nul
        if errorlevel 1 call npm ci --omit=dev
    )
    if errorlevel 1 (
        echo   [WARN] npm ci fallo, intentando npm install con runtime...
        if exist "runtime\node\node_modules\npm\bin\npm-cli.js" (
            runtime\node\node.exe runtime\node\node_modules\npm\bin\npm-cli.js install --omit=dev --no-audit --no-fund
        ) else call npm install --omit=dev
    )
    echo   Re-verificando better-sqlite3...
    runtime\node\node.exe -e "console.log('Node',process.version,'ABI',process.versions.modules); require('better-sqlite3'); console.log('better-sqlite3 OK:'+require('better-sqlite3')('server/songs.db').prepare('SELECT COUNT(*) as c FROM songs').get().c+' canciones')" 2>&1
    if errorlevel 1 (
        echo   [ERROR] better-sqlite3 sigue fallando tras install. Verifica Node 22.18.0 y que el binario coincida.
        pause
        exit /b 1
    )
) else echo   [OK] better-sqlite3 compatible con runtime
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

echo   [5.5/6] Staging limpio dist/desktop...
if exist "dist\desktop" rmdir /s /q "dist\desktop"
mkdir "dist\desktop"
mkdir "dist\desktop\runtime\node"
mkdir "dist\desktop\server\local"
mkdir "dist\desktop\server\shared"
mkdir "dist\desktop\server\views"
mkdir "dist\desktop\public"
echo   Copiando ejecutable y DLLs...
copy /y "Ritmika.exe" "dist\desktop\" >nul
copy /y "ritmika.ico" "dist\desktop\" >nul 2>&1
copy /y "WebView2Loader.dll" "dist\desktop\" >nul 2>&1
copy /y "Microsoft.Web.WebView2.Core.dll" "dist\desktop\" >nul 2>&1
copy /y "Microsoft.Web.WebView2.WinForms.dll" "dist\desktop\" >nul 2>&1
echo   Copiando runtime Node...
xcopy /y /e /q "runtime\node\*" "dist\desktop\runtime\node\" >nul
echo   Copiando node_modules (produccion)...
xcopy /y /e /q "node_modules\*" "dist\desktop\node_modules\" >nul
echo   Copiando server y public (sin relay/tests/docs)...
copy /y "server\index.js" "dist\desktop\server\" >nul
copy /y "server\songs.db" "dist\desktop\server\" >nul
xcopy /y /e /q "server\local\*" "dist\desktop\server\local\" >nul
xcopy /y /e /q "server\shared\*" "dist\desktop\server\shared\" >nul
copy /y "server\views\admin_modes.html" "dist\desktop\server\views\" >nul 2>&1
xcopy /y /e /q "public\*" "dist\desktop\public\" >nul
copy /y "package.json" "dist\desktop\" >nul
echo   [OK] Staging dist/desktop listo
for /f %%f in ('dir /s /b "dist\desktop" ^| find /c /v ""') do echo   Archivos: %%f
echo   Descargando WebView2 Bootstrapper (Evergreen)...
if not exist "dist\desktop\MicrosoftEdgeWebview2Setup.exe" (
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile 'dist\desktop\MicrosoftEdgeWebview2Setup.exe' -UseBasicParsing" 2>nul
    if exist "dist\desktop\MicrosoftEdgeWebview2Setup.exe" echo   [OK] Bootstrapper listo
    if not exist "dist\desktop\MicrosoftEdgeWebview2Setup.exe" echo   [WARN] No se pudo descargar bootstrapper (continuando sin él)
) else echo   [OK] Bootstrapper ya existe
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
