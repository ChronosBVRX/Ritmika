Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent (Split-Path $MyInvocation.MyCommand.Path -Parent)
$logoPng = Join-Path $root "public\assets\logo_ritmika.png"
$fallbackPng = Join-Path $root "public\assets\tio_axolo_body.png"
$png = if (Test-Path $logoPng) { $logoPng } else { $fallbackPng }
$ico = Join-Path $root "ritmika.ico"
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
