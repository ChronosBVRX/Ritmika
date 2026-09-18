param(
  [string]$NodeVersion = "22.18.0",
  [string]$Dest = "$PSScriptRoot/../runtime/node"
)
$ErrorActionPreference = "Stop"
$zipName = "node-v$NodeVersion-win-x64.zip"
$url = "https://nodejs.org/dist/v$NodeVersion/$zipName"
$tmpZip = "$env:TEMP/$zipName"
$tmpDir = "$env:TEMP/node-v$NodeVersion-win-x64"

Write-Host "Descargando Node.js $NodeVersion ..."
if (!(Test-Path $Dest)) { New-Item -ItemType Directory -Force -Path $Dest | Out-Null }

if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force }
# Usar TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing

Write-Host "Extrayendo a $Dest ..."
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
Expand-Archive -Path $tmpZip -DestinationPath $env:TEMP -Force
$src = Join-Path $tmpDir "node.exe"
if (!(Test-Path $src)) { $src = Get-ChildItem $tmpDir -Recurse -Filter "node.exe" | Select-Object -First 1 -ExpandProperty FullName }
Copy-Item $src -Destination (Join-Path $Dest "node.exe") -Force
# También copiar npm y npx si existen
foreach ($f in @("npm","npx","npm.cmd","npx.cmd")) {
  $s = Join-Path $tmpDir $f
  if (Test-Path $s) { Copy-Item $s -Destination $Dest -Force -Recurse -ErrorAction SilentlyContinue }
}
# Copiar node_modules/npm si existe para npm local
$npmSrc = Join-Path $tmpDir "node_modules"
if (Test-Path $npmSrc) { Copy-Item $npmSrc -Destination (Join-Path $Dest "node_modules") -Force -Recurse -ErrorAction SilentlyContinue }

Write-Host "Node runtime listo en $Dest :"
& (Join-Path $Dest "node.exe") --version
Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "OK"
