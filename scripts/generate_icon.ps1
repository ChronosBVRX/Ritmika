Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent (Split-Path $MyInvocation.MyCommand.Path -Parent)
$ico = Join-Path $root "ritmika.ico"

# El icono se versiona en el repo (necesario para el instalador). Si ya existe,
# no se regenera: build.bat puede continuar aunque no haya fuentes .png.
if (Test-Path $ico) {
    Write-Host "[OK] ritmika.ico ya existe, se conserva"
    exit 0
}

# Fuentes raster aceptadas (los assets actuales son .webp; GDI+ no decodifica
# webp de forma nativa, así que si no hay PNG intentamos convertir con ffmpeg).
$pngSources = @(
    (Join-Path $root "public\assets\logo_ritmika.png"),
    (Join-Path $root "public\assets\tio_axolo_body.png")
)
$webpSources = @(
    (Join-Path $root "public\assets\logo_ritmika.webp"),
    (Join-Path $root "public\assets\tio_axolo_body.webp")
)

$png = $pngSources | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $png) {
    $webp = $webpSources | Where-Object { Test-Path $_ } | Select-Object -First 1
    $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($webp -and $ffmpeg) {
        $png = Join-Path $env:TEMP "ritmika_icon_src.png"
        & $ffmpeg.Source -y -i $webp $png 2>$null | Out-Null
        if (-not (Test-Path $png)) { $png = $null }
    }
}

if (-not $png) {
    Write-Host "[WARN] No se encontro fuente de icono (PNG ni ffmpeg+WebP)."
    Write-Host "[WARN] ritmika.ico no generado; el instalador fallara si falta."
    exit 0
}

$bmp = [System.Drawing.Bitmap]::new($png)
$small = $bmp.GetThumbnailImage(256, 256, $null, [IntPtr]::Zero)
$hIcon = $small.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::OpenWrite($ico)
$icon.Save($fs)
$fs.Close()
$small.Dispose()
$bmp.Dispose()
$icon.Dispose()
Write-Host "[OK] Icono generado desde: $png"
Write-Host "[OK] Icono guardado en: $ico"
