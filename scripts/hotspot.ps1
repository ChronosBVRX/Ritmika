<#
.SYNOPSIS
  Prende el Mobile Hotspot de Windows para que los celulares se conecten al juego.
  Solamente hay que configurarlo UNA VEZ desde Configuración → Red → Mobile Hotspot.
  Este script lo prende automáticamente después de eso.
#>

$ssid = "Ritmika"
$pass = "Ritmika2026"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗"
Write-Host "  ║     📡  RITMIKA  —  HOTSPOT  WiFi       ║"
Write-Host "  ╚══════════════════════════════════════════╝"
Write-Host ""

# Verificar si la funcionalidad existe en Windows
try {
  $tetheringCapability = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
  $connectionProfile = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
  $tetheringManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($connectionProfile)

  $currentState = $tetheringManager.TetheringOperationalState

  if ($currentState -eq 1) {
    Write-Host "  [✓] El hotspot ya está activo."
  } else {
    Write-Host "  [↻] Intentando activar el hotspot..."
    Write-Host "  [↻] Configurando SSID y contraseña..."
    $cfg = New-Object Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration
    $cfg.Ssid = $ssid
    $cfg.Passphrase = $pass
    $tetheringManager.ConfigureAccessPointAsync($cfg) | Out-Null
    Write-Host "  [↻] Iniciando..."
    $op = $tetheringManager.StartTetheringAsync()
    while ($op.Status -eq 'Started') { Start-Sleep -Milliseconds 100 }
    $result = $op.GetResults()
    if ($tetheringManager.TetheringOperationalState -eq 1) {
      Write-Host "  [✓] Hotspot activado correctamente."
    } else {
      Write-Host "  [⚠] No se pudo activar automáticamente."
    }
  }
} catch {
  Write-Host "  [⚠] No se pudo controlar el hotspot automáticamente."
  Write-Host ""
  Write-Host "  Para configurarlo MANUALMENTE (solo la primera vez):"
  Write-Host "  1. Abre: Configuración → Red e Internet → Mobile Hotspot"
  Write-Host "  2. Pon estas credenciales:"
  Write-Host "     - Nombre de red: $ssid"
  Write-Host "     - Contraseña:    $pass"
  Write-Host "  3. Actívalo"
  Write-Host ""
  Write-Host "  Después de eso, este script lo prenderá solo."
}

# Mostrar las credenciales
Write-Host ""
Write-Host "  ────────────────────────────────────────"
Write-Host "  📶 Red WiFi:    $ssid"
Write-Host "  🔑 Contraseña:  $pass"
Write-Host "  ────────────────────────────────────────"
Write-Host ""
Write-Host "  Conecta tu celular a esta red y luego"
Write-Host "  escanea el QR que aparece en la TV."
Write-Host ""
