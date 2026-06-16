Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗"
Write-Host "  ║   🔧  RITMIKA — Fix de Conexión        ║"
Write-Host "  ╚══════════════════════════════════════════╝"
Write-Host ""

# ── Firewall rule for port 3000 ──
Write-Host "  [1/2] Agregando regla de firewall para puerto 3000..."
netsh advfirewall firewall add rule name="Ritmika Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any description="Ritmika Karaoke Game Server" 2>$null
if ($?) {
  Write-Host "        ✓ Regla agregada correctamente."
} else {
  Write-Host "        ⚠ No se pudo agregar la regla (¿sin permisos?)"
}

# ── Hotspot ──
Write-Host "  [2/2] Activando hotspot WiFi 'Ritmika'..."
$ssid = "Ritmika"
$pass = "Ritmika2026"

try {
  $tetheringCapability = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
  $connectionProfile = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
  $tetheringManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($connectionProfile)

  $currentState = $tetheringManager.TetheringOperationalState

  if ($currentState -eq 1) {
    Write-Host "        ✓ El hotspot ya está activo."
  } else {
    $cfg = New-Object Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration
    $cfg.Ssid = $ssid
    $cfg.Passphrase = $pass
    $tetheringManager.ConfigureAccessPointAsync($cfg) | Out-Null
    $op = $tetheringManager.StartTetheringAsync()
    while ($op.Status -eq 'Started') { Start-Sleep -Milliseconds 100 }
    $result = $op.GetResults()
    if ($tetheringManager.TetheringOperationalState -eq 1) {
      Write-Host "        ✓ Hotspot '$ssid' activado."
    } else {
      Write-Host "        ⚠ No se pudo activar el hotspot automáticamente."
    }
  }
} catch {
  Write-Host "        ⚠ No se pudo controlar el hotspot."
  Write-Host "        → Actívalo manualmente en:"
  Write-Host "          Configuración → Red e Internet → Mobile Hotspot"
  Write-Host "          SSID: $ssid"
  Write-Host "          Clave: $pass"
}

# ── Instrucciones ──
Write-Host ""
Write-Host "  ────────────────────────────────────────"
Write-Host "  📶 Conéctate a la red WiFi '$ssid'"
Write-Host "  🔑 Contraseña: $pass"
Write-Host "  ────────────────────────────────────────"
Write-Host ""
Write-Host "  Luego desde el celular abre:"
Write-Host "  http://192.168.137.1:3000/join"
Write-Host ""
Write-Host "  O escanea el QR que aparece en la pantalla de la TV."
Write-Host ""

Start-Sleep -Seconds 2
