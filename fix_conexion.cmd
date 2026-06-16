@echo off
echo.
echo  ========================================
echo    RITMIKA — Fix de Conexion WiFi
echo  ========================================
echo.
echo  Agregando regla de firewall para puerto 3000...
netsh advfirewall firewall add rule name="Ritmika Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any description="Ritmika Karaoke Game Server" >nul 2>&1
if %errorlevel% equ 0 (
  echo  [OK] Regla de firewall agregada.
) else (
  echo  [WARN] No se pudo agregar (ejecuta como Administrador).
)
echo.
echo  ========================================
echo.
echo  Prueba conectarte desde el celular a:
echo  http://192.168.1.124:3000/join
echo.
echo  Si aun no funciona, activa el HOTSPOT:
echo  1. Configuracion ^> Red e Internet ^> Mobile Hotspot
echo  2. SSID: Ritmika
echo  3. Clave: Ritmika2026
echo  4. Activalo
echo  5. Conecta el celular a esa red
echo  6. Abre http://192.168.137.1:3000/join
echo.
pause
