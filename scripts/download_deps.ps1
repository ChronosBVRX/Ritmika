param([string]$Version = "1.0.2957.106")

$url = "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$Version"
$outDir = Join-Path $PSScriptRoot "..\libs\webview2"
$nupkg = Join-Path $env:TEMP "webview2.nupkg"

New-Item $outDir -ItemType Directory -Force | Out-Null

Write-Host "[...] Descargando WebView2 SDK $Version ..."
try {
    Invoke-WebRequest $url -OutFile $nupkg -UseBasicParsing
} catch {
    Write-Host "[FAIL] No se pudo descargar (sin internet?)."
    exit 1
}

Write-Host "[...] Extrayendo DLLs..."
Rename-Item $nupkg "$nupkg.zip" -Force
$extractDir = "$env:TEMP\webview2_extracted"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
Expand-Archive "$nupkg.zip" -DestinationPath $extractDir -Force

$files = @(
    "lib\net462\Microsoft.Web.WebView2.Core.dll",
    "lib\net462\Microsoft.Web.WebView2.WinForms.dll",
    "runtimes\win-x64\native\WebView2Loader.dll"
)

foreach ($f in $files) {
    $src = Join-Path $extractDir $f
    $name = Split-Path $f -Leaf
    $dst = Join-Path $outDir $name
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "[OK] $name"
    } else {
        Write-Host "[WARN] No encontrado: $f"
    }
}

# Clean up
Remove-Item "$nupkg.zip" -Force
Remove-Item $extractDir -Recurse -Force

Write-Host ""
Write-Host "[OK] WebView2 DLLs en: $outDir"
