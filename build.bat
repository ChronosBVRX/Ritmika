@echo off
title Ritmika - Build Launcher
cd /d "%~dp0"

echo.
echo   ============================================
echo      RITMIKA - COMPILAR LAUNCHER
echo   ============================================
echo.

echo   [1/4] Verificando dependencias...
if not exist "libs\webview2\Microsoft.Web.WebView2.Core.dll" (
    echo   [+] Descargando WebView2 SDK...
    powershell -ExecutionPolicy Bypass -NoProfile -File "scripts\download_deps.ps1"
)
echo.

echo   [2/4] Generando icono...
powershell -ExecutionPolicy Bypass -NoProfile -File "scripts\generate_icon.ps1"
if not exist "ritmika.ico" echo   [WARN] No se pudo generar el icono
echo.

echo   [3/4] Buscando compilador...
set CSC=
if exist "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe" set "CSC=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if "%CSC%"=="" (
    echo   [ERROR] No se encontro .NET 4.x. Asegurate de tener .NET Framework 4.6+.
    echo.
    pause
    exit /b 1
)
echo   Compilador: %CSC%
echo.

echo   [4/4] Compilando Ritmika.exe...
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

echo.
echo   [OK] Ritmika.exe creado!
for %%f in (Ritmika.exe) do echo   Tamano: %%~zf bytes
echo.
echo   Copiando WebView2Loader.dll junto al .exe...
echo   Copiando DLLs de WebView2 junto al .exe...
copy /y "%WV2%\Microsoft.Web.WebView2.Core.dll" "." >nul 2>&1
copy /y "%WV2%\Microsoft.Web.WebView2.WinForms.dll" "." >nul 2>&1
copy /y "%WV2%\WebView2Loader.dll" "." >nul 2>&1
echo.
echo   Doble clic en Ritmika.exe para jugar.
echo.
