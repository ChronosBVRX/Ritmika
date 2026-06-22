# Deployment

Guía para configurar y desplegar Rítmika en diferentes escenarios.

---

## Modo local (WiFi hotspot)

El caso de uso principal: una PC como servidor + pantalla, celulares conectados por WiFi local.

### 1. Activar hotspot WiFi

**Opción A: Automática (con permisos de admin)**

```powershell
# Ejecutar como administrador
.\scripts\hotspot.ps1
```

Esto activa el hotspot con SSID `Ritmika` y contraseña `Ritmika2026` (configurables en `.env`).

**Opción B: Manual**

1. Configuración → Red → Mobile Hotspot
2. Activar "Compartir conexión de internet"
3. Configurar:
   - SSID: `Ritmika`
   - Contraseña: `Ritmika2026`
4. Guardar

### 2. Configurar firewall

```powershell
# Abrir puerto 3000 (requiere admin)
.\scripts\fix_conexion.ps1
```

O manualmente:
```cmd
netsh advfirewall firewall add rule name="Ritmika" dir=in action=allow protocol=tcp localport=3000
```

### 3. Iniciar el juego

```cmd
Ritmika.exe
```

O directamente con Node.js:
```bash
npm start
```

### 4. Verificar

- La TV muestra el QR en `http://localhost:3000`
- Los celulares pueden acceder a `http://<IP>:3000/join`
- Verificar IP: `GET /api/network-config`

---

## Modo desarrollo

Para desarrollo sin compilar el launcher:

```bash
# Terminal 1: Servidor con auto-reload
npm run dev

# Abrir en navegador
# TV: http://localhost:3000
# Móvil: http://localhost:3000/join
```

### Agregar bots para testing

En la TV, llamar a la función desde la consola del navegador:

```javascript
// Agregar un bot
socket.emit('tv:add_bot', { roomCode: 'ABCD' });
```

O usar el botón de debug si está habilitado.

---

## Despliegue en Render.com

Rítmika puede desplegarse en [Render.com](https://render.com) como servicio web.

### Configuración

1. Conectar el repositorio de GitHub
2. Crear un servicio Web con:
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Environment**: `NODE_ENV=production`

3. Variables de entorno en Render:
   ```
   PORT=3000
   RENDER_EXTERNAL_URL=https://tu-app.onrender.com
   ```

### Limitaciones del modo online

- Sin hotspot WiFi (los jugadores necesitan internet)
- Sin pantalla nativa (la TV se ve desde el navegador)
- Latencia adicional por el servidor en la nube
- El video proxy funciona igual (Cloudflare R2)

---

## Configuración de `.env`

### Campos mínimos

```env
PORT=3000
```

### Configuración completa

```env
# Puerto del servidor
PORT=3000

# Hotspot WiFi (para hotspot.ps1)
HOTSPOT_SSID=Ritmika
HOTSPOT_PASSWORD=Ritmika2026

# Cloudflare R2 (para presigned URLs de video)
R2_ACCESS_KEY_ID=tu_access_key
R2_SECRET_ACCESS_KEY=tu_secret_key
R2_ENDPOINT=https://tu_account_id.r2.cloudflarestorage.com

# URL externa (solo para deploy en la nube)
RENDER_EXTERNAL_URL=https://tu-app.onrender.com

# Admin token (protege /admin y bulk-mode)
ADMIN_TOKEN=una_clave_segura_aqui
```

### Descripción de variables

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `PORT` | No | `3000` | Puerto del servidor |
| `HOTSPOT_SSID` | No | `Ritmika` | Nombre de la red WiFi |
| `HOTSPOT_PASSWORD` | No | `Ritmika2026` | Contraseña de la red WiFi |
| `R2_ACCESS_KEY_ID` | No | — | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | No | — | Cloudflare R2 secret key |
| `R2_ENDPOINT` | No | `https://...r2.cloudflarestorage.com` | Endpoint de R2 |
| `RENDER_EXTERNAL_URL` | No | — | URL pública (para Render) |
| `PUBLIC_URL` | No | — | Override de URL base |
| `ADMIN_TOKEN` | No | — | Token para proteger rutas admin (`/admin`, `PUT /api/songs/bulk-mode`) |

---

## Requisitos de red

### Puerto

- El servidor escucha en `0.0.0.0:<PORT>` (todas las interfaces)
- Puerto por defecto: **3000**
- Asegurarse de que el firewall permite conexiones entrantes en ese puerto

### Ancho de banda

- Cada jugador streaming video consume ~1-3 Mbps
- Para 6 jugadores simultáneos: ~12 Mbps de upload desde la PC
- El video se sirve desde Cloudflare R2 (no desde la PC)

### Latencia

- Local (WiFi hotspot): <10ms
- LAN (misma red): <5ms
- Internet (Render): variable (50-200ms)

---

## Solución de problemas de red

### Los celulares no conectan

1. Verificar que el hotspot está activo
2. Verificar que los celulares tienen IP (DHCP activo)
3. Probar acceder a `http://<IP>:3000` desde un navegador en el celular
4. Verificar firewall: `netsh advfirewall firewall show rule name="Ritmika"`

### Los celulares no obtienen IP

- Puede ser driver del adaptador virtual del hotspot
- Probar con otro adaptador WiFi
- Usar cable Ethernet como alternativa al hotspot

### El video no carga

- Verificar que la URL de R2 es accesible
- Verificar que `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` son correctos
- Las presigned URLs expiran en 30 minutos

### QR no muestra la IP correcta

- Verificar `GET /api/network-config`
- Si hay múltiples interfaces de red, la IP detectada puede no ser la correcta
- Solución: configurar `RENDER_EXTERNAL_URL` o `PUBLIC_URL` manualmente

---

## Seguridad en producción

- **No exponer el servidor a internet sin autenticación**
- El servidor no tiene auth — cualquiera con la URL puede unirse
- Usar solo en redes de confianza o con VPN
- El archivo `.env` contiene secrets — nunca commitearlo
- `.gitignore` ya excluye `.env`

### Admin dashboard

El dashboard de administración (`/admin`) y el endpoint `PUT /api/songs/bulk-mode` están protegidos con `ADMIN_TOKEN`.

**Uso:**
1. Definir `ADMIN_TOKEN=una_clave_segura` en `.env`
2. Acceder vía: `http://localhost:3000/admin?token=una_clave_segura`
3. El token se pasa automáticamente en las peticiones AJAX del dashboard

Sin el token, el servidor devuelve `401 Unauthorized`.
