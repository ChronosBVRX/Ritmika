# Rítmika Desktop — Despliegue e Instalación

> **PC anfitriona** — WebView2 + TV local + lógica completa + SQLite local + assets + audio + selección + reproducción. El relay solo es pasarela.

## Requisitos

- Windows 10/11 (64-bit)
- Microsoft Edge WebView2 Runtime (incluido en Windows 11, descargable para Win10)
- No requiere Node.js externo, npm, ni terminal (incluido en instalador)

## Instalador autocontenido

### Construir

```bat
:: En Windows con .NET 4.x y Node 22 LTS
build.bat
```

Pasos que ejecuta:

1. Verifica `libs/webview2` (descarga SDK si falta)
2. Descarga `runtime/node/node.exe` (Node 22.18.0 LTS) si no existe — `scripts/download_node_runtime.ps1`
3. `npm ci --production` + verifica `better-sqlite3` para ese Node (rebuild si hace falta)
4. Genera `ritmika.ico` desde `tio_axolo_body.webp`
5. Compila `src/Launcher.cs` + `src/GameWindow.cs` → `Ritmika.exe` + copia `WebView2Loader.dll` etc.
6. Si `iscc` (Inno Setup 6) está en PATH, compila `installer.iss` → `installer/output/Ritmika-Setup-x64-1.0.1.exe`

**Comando exacto:**

```bat
iscc installer.iss
:: Artefacto: installer\output\Ritmika-Setup-x64-1.0.1.exe
```

Tamaño esperado: ~120-180 MB (Node 22 ~30 MB + node_modules ~80 MB + public/assets ~40 MB + exe/dlls).

### Contenido del instalador

```
{app}\
  Ritmika.exe
  WebView2Loader.dll, Microsoft.Web.WebView2.*.dll
  ritmika.ico
  runtime\node\node.exe (+ npm)
  node_modules\ (producción)
  server\ (index.js, local/, shared/, views/, songs.db)
  public\ (tv.html, mobile.html, js/, assets/, libs/)
  package.json
```

**No incluye:** `.git`, `.env` del desarrollador, `R2_SECRET`, `GITHUB_TOKEN`, `ELEVENLABS_API_KEY`, `server.log`, `*.db-shm`.

Datos modificables en `%LOCALAPPDATA%\Ritmika\`:

- `logs/server.log` (stdout/stderr del server local)
- `cache/videos/` (LRU 2048 MB, configurable `VIDEO_CACHE_MAX_MB`)

### Instalación

1. Ejecutar `Ritmika-Setup-x64-1.0.1.exe` como administrador (instala en `{autopf}\Ritmika`)
2. Si falta WebView2, el instalador avisa y ofrece abrir `https://go.microsoft.com/fwlink/p/?LinkId=2124703`
3. Lanzar desde menú Inicio o escritorio → `Ritmika.exe`
4. La ventana WebView2 abre `http://127.0.0.1:3000` (polling 500 ms hasta que Node esté listo) con flags GPU: `--enable-gpu-rasterization --enable-zero-copy --enable-accelerated-video-decode --disable-software-rasterizer --autoplay-policy=no-user-gesture-required`

### Configuración

El Desktop lee `%LOCALAPPDATA%\Ritmika\.env` si existe, o `Ritmika\.env` junto al exe, o variables de entorno.

- `PORT=3000` (local)
- `RELAY_URL=https://<relay>.onrender.com` (para modo online, QR público)
- `CONNECTION_MODE=online|lan` (auto si hay RELAY_URL)
- `VIDEO_CACHE_DIR` / `VIDEO_CACHE_MAX_MB`

Para modo LAN sin Internet, dejar `RELAY_URL` vacío. Para modo online, configurar `RELAY_URL` con la URL pública del relay (ver `DEPLOY_RELAY.md`).

### Logs y diagnóstico

- `Ctrl+Shift+D` en TV muestra panel debug + estado: `Local: 3845 canciones` (verde) / `Relay: conectado` (verde) / `Reconectando...` (amarillo/rojo)
- Logs: `%LOCALAPPDATA%\Ritmika\logs\server.log`
- DevTools deshabilitados en producción (`AreDevToolsEnabled=false` en GameWindow)

## Linux

Mantiene `Ritmika.sh` + `build.sh` (multiplataforma). Core local/relay es multiplataforma (Node). Distribución Linux autocontenida (AppImage) preparada pero no bloqueante para Windows.

```bash
./build.sh          # npm install, crea .env
./Ritmika.sh        # inicia server, abre xdg-open http://localhost:3000, maneja RELAY_URL de .env
./Ritmika.sh --port 3002 --no-browser
```

No rompe el trabajo reciente de `Ritmika.sh`/`build.sh`.

## Video

- Directo `R2 → PC` (`https://media.pixelhub.party/...`), no pasa por relay.
- Si `R2` es público, TV usa `song.url` directo (evita presign). Si requiere firma, `GET /api/video-url?id=` genera presigned 30 min (fallback a público).
- Cache progresiva: primer uso descarga a `%LOCALAPPDATA%\Ritmika\cache\videos/<id>.mp4` vía `POST /api/video-cache/:id/download`, siguientes lecturas desde disco. No descarga 3845 canciones al instalar.

## Seguridad

Ejecutar `node scripts/audit_secrets.js` antes de empaquetar. No distribuir `.env` con `R2_SECRET`, `GITHUB_TOKEN`, `ELEVENLABS_API_KEY`, `ADMIN_TOKEN` real.
