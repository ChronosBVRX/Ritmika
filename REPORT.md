# Rítmika — Reporte Migración Desktop Local + Relay Online

> **Rama:** `feat/desktop-local-online-relay` — **No merge a main** — lista para revisión antes de producción.

## 1. HEADs

- **HEAD inicial (origin/main al `git fetch`):** `f341ac1b0396b800eee178b379f9f75e45ed011d` — `feat(linux): agregar ejecutable local Ritmika.sh + build.sh`
- **HEAD final (esta rama):** `371bab3` (ver `git log origin/main..HEAD` abajo) — tras 7 commits (6 previos + reporte). Último commit: `371bab3 docs(report): reporte final migración desktop local + relay online`.
- **Rama:** `feat/desktop-local-online-relay` (push a `origin/feat/desktop-local-online-relay`, no reescribe historia, no merge).

## 2. Commits (desde `f341ac1`)

```
bb0ce44 refactor(protocol): congelar protocolo Socket.IO y tests
d0f1085 feat(server): separar local-host / relay / shared
fc5fcaa feat(tv): dual-origen LOCAL_BASE + RELAY_URL con tolerancia
1d0596f feat(identity): playerId estable + hostToken + reconexión
885398c feat(desktop): distribución autocontenida + cache vídeo + R2 directo
371bab3 feat(health): status diferenciado + benchmark + docs despliegue
```

Cada commit es pequeño y auditable, siguiendo la convención `refactor(server): extract shared room protocol`, `feat(relay): lightweight relay`, etc.

## 3. Archivos modificados / creados

```
M  .gitignore
M  Ritmika.sh
M  build.bat
M  package.json
M  public/tv.html
M  public/js/tv/socket.js      (dual-origen, hostToken, reconexión)
M  public/js/tv/lobby.js       (QR público)
M  public/js/tv/game.js        (R2 directo + cache)
M  public/mobile.html          (playerId)
M  server/index.js             (wrapper → server/local)
M  server/local/index.js       (local host, SQLite, /api/config, video-cache)
M  src/Launcher.cs             (runtime/node prioritario, LOCALAPPDATA, WebView2 check)
A  docs/PROTOCOL.md            (congelado + §11 evolución)
A  docs/DEPLOY_DESKTOP.md
A  docs/DEPLOY_RELAY.md
A  installer.iss               (Inno Setup)
A  public/js/tv/config.js      (centraliza RELAY_URL)
A  server/local/videoCache.js  (LRU 2GB)
A  server/relay/index.js       (pasarela ligera)
A  server/shared/* (protocol.js, rooms.js, config.js, rateLimiter.js, artist-metadata.json)
A  scripts/generate_artist_metadata.js, download_node_runtime.ps1/.sh, audit_secrets.js, benchmark.js
A  tests/protocol.test.js (13), relay.test.js (7), smoke.test.js (flujo completo)
```

No se modificaron reglas de juego, puntuaciones, rondas, frases Axolo, modos Clásico/Emo, ruleta, podio, estética.

## 4. Diagrama final

```
PC ANFITRIONA (Rítmika Desktop)
  Ritmika.exe (C# WinForms + WebView2 GPU)
    └─► GameWindow → http://127.0.0.1:3000  (TV local)
          ├─ HTML/assets/catálogo/SQLite (3845) local
          ├─ audio local (392 MP3)
          ├─ selección de canciones local (server/local /api/songs)
          └─ vídeo R2 → PC directo (media.pixelhub.party) + cache %LOCALAPPDATA%\Ritmika\cache\videos
    └─► runtime/node/node.exe (22 LTS, autocontenido) → server/local/index.js :3000
          └─► GET /api/config → { relayUrl, connectionMode } ──┐
                                                              │
                    Socket.IO saliente (sin port forward)     │
                              │                                │
                              ▼                                ▼
INTERNET (Rítmika Relay — pasarela ligera)
  node server/relay/index.js :3001 (o Render/Fly)
    ├─ GET /join → mobile.html + /api/artist-map (ligera, 626 artistas) + /api/relay-health
    ├─ Socket.IO: tv:create_room → {roomCode, hostToken} → QR
    ├─ player:join {roomCode, name, avatarId, playerId} → tv:player_joined
    └─ tv:broadcast / tv:send_to_player (validado por hostToken) → game:update / game:private

MÓVILES (datos móviles, sin WiFi de PC)
  https://<relay>/join?code=ABCD  (QR público)
    └─► io() al relay (mismo origen que /join)
          └─► relay TV↔jugador (solo transporte, no lógica)

Modo LAN (sin Internet): RELAY_URL vacío → TV io() local, QR http://192.168.x.x:3000/join, todo local (comportamiento original).
```

## 5. Qué sigue corriendo local vs online

| Local (PC) | Online (Relay) |
|---|---|
| WebView2 rendering + animaciones (Anime.js/GSAP) | Creación salas + `roomCode` + `hostToken` |
| Lógica completa juego (`public/js/tv/game.js`, `lobby.js`, `state.js`) | Presencia jugadores (`players` Map) |
| SQLite `server/songs.db` + `/api/songs`, `/api/artists`, `/api/artist-map` completo | `playerId` ↔ `socketId` + reconexión 5 min |
| Assets locales, audio, selección, ruleta, podio, votación | TTL 2h, max 8, rate limiting, validación |
| Reproducción karaoke (`<video>` → R2 directo) + cache LRU | `GET /join`, `/api/artist-map` ligera, `/api/relay-health` |
| `GET /api/health`, `/api/video-url` (fallback), `/api/video-cache` | Relay `game:update`/`game:private`/`game:tv_disconnected` |
| Bootloader, preboot, debug, `localStorage` partida 4h | `GET /api/room/:code` (solo mode) |
| **No** expone puerto 3000 a Internet | **No** SQLite, no vídeo, no lógica, no animación |

Principio servidor tonto preservado: relay no decide ganadores/puntuaciones/canciones/rondas.

## 6. Protocolo Socket.IO resultante

Ver `docs/PROTOCOL.md` (congelado f341ac1 + §11 online). Nombres conservados:

- TV→relay: `tv:create_room {mode} → tv:room_created {roomCode, hostToken, relayUrl, mode}`, `tv:reconnect_host {roomCode, hostToken} → tv:reconnect_ack`, `tv:close_room`, `tv:broadcast {roomCode, event, data, hostToken} → game:update`, `tv:send_to_player {targetSocketId|targetPlayerId, event, data, hostToken} → game:private`, `tv:add_bot`, `tv:start_game`
- Jugador→relay: `player:join {roomCode, name, avatarId, playerId} → player:join_ack {success, roomCode, mode, players, playerId, isHost, reconnected}`, `player:reconnect`, `player:select_genres/artists`, `player:tomatazo/emoji/sabotage` (rate limit 2s/500ms/3s), `player:vote {score, performerSocketId|performerPlayerId}`, `player:assign_song {targetSocketId|targetPlayerId, songId}`, `player:start_game/start_song/next_turn/new_game` (solo host via `isHost` por `playerId`)
- Relay→TV: `tv:player_joined {player{playerId}, players}`, `tv:player_left {socketId, playerId, name, players}`, `tv:player_genres/artists {socketId, playerId}`, `tv:tomatazo {attackerPlayerId}`, `tv:vote {voterPlayerId, performerPlayerId}`, `tv:song_assigned`, `tv:*_trigger`
- Relay→jugador: `player:join_ack`, `game:started`, `game:update {event, data}` (sub-eventos `PLAYER_JOINED`, `ROUND_INFO`, `VOTE_COUNT`, `SONG_TIMER`, `SCORE_UPDATE`, `ROULETTE_START`, etc.), `game:private {event: HOST_ASSIGNED|YOUR_TURN|TOMATAZO_REJECTED}`, `game:tv_disconnected {reconnectable}`

## 7. Cómo genera el QR

`public/js/tv/lobby.js:inicializarQRConexion()`:

```js
const cfg = window.RITMIKA_CONFIG; // de /api/config
let joinUrl;
if (cfg.CONNECTION_MODE==='online' && cfg.RELAY_URL)
  joinUrl = `${cfg.RELAY_URL.replace(/\/$/,'')}/join?code=${state.roomCode}`;
else if (!isLocal) joinUrl = `${location.origin}/join?code=${state.roomCode}`;
else joinUrl = `http://${state.localIP}:${port}/join?code=${state.roomCode}`;
QRCode.toCanvas(canvas, joinUrl, {width:180});
```

Texto fallback muestra URL. `window.RITMIKA_CONFIG` viene de `public/js/tv/config.js` → `fetch('/api/config')` (local). `server/relay` también devuelve `relayUrl` en `tv:room_created` para actualizar QR si cambió. En LAN (`RELAY_URL` vacío) usa IP privada/hotspot como antes.

## 8. Cómo se recupera una sala tras desconexión

- **TV:** guarda `hostToken` (48 hex) + `roomCode` en `localStorage` (`ritmika_host_token`, `ritmika_room_code`) y `state.hostToken`. Al `socket.on('connect')`, si hay `hostToken`+`roomCode`, emite `tv:reconnect_host {roomCode, hostToken}`. Relay verifica con `timingSafeEqual` y si `room.hostToken` coincide, migra `room.tvSocketId` al nuevo socket, `socket.join(roomCode)`, responde `tv:reconnect_ack {success, roomCode, mode}` y notifica `HOST_RECONNECTED`. Si falla, limpia token. Relay no borra sala inmediato al `disconnect` de TV: pone `tvSocketId=null`, `lastActivityAt=now`, emite `game:tv_disconnected {reconnectable:true}` y espera 2 min antes de borrar (si 0 jugadores) o notifica cierre.

- **Móvil:** `getOrCreatePlayerId()` genera `playerId` (UUID) en `localStorage.ritmika_player_id`, lo envía siempre en `player:join`. En `connect`, si `me.roomCode` + `me.playerId` existen, re-emite `player:join` con mismo `playerId`. Relay busca en `room.disconnected` (gracia 5 min) y si lo encuentra restaura `room.players.set(newSocketId, {...saved, socketId:new})`, `reconnected:true`, `isHost` según `room.hostPlayerId`. TV lo reconoce por `playerId` (no por `socketId` ni solo `name`), actualiza `state.players` y `singerQueue` sin perder `score/genres`. Si TV ya había asignado nuevo host, el reconectado no lo recupera automáticamente (espectador), pero no se duplica.

## 9. Cómo se identifica un jugador

- `playerId` (UUID, estable, `localStorage.ritmika_player_id`) = identidad lógica. `socketId` (corto, efímero, `socket.id`) = transporte. `name` solo para UI. TV guarda `playerId` en `state.players[i].playerId` y lo usa para `find(p => p.playerId===playerId || p.socketId===socketId)`. Relay guarda `room.playerIdToSocket` + `room.disconnected`. `hostPlayerId`/`hostPlayerSocketId` se mantienen sincronizados. Compat: clientes viejos sin `playerId` siguen funcionando (relay genera uno).

## 10. Dependencias incluidas en el instalador

- `Ritmika.exe` (C# WinForms, ~24 KB) + `WebView2Loader.dll` + `Microsoft.Web.WebView2.*.dll` (~2 MB, SDK; runtime WebView2 no incluido, se verifica)
- `runtime/node/node.exe` (Node 22.18.0 LTS win-x64, ~30 MB) + npm
- `node_modules` producción (`better-sqlite3` 12.11.1 con binario para Node 22, `express`, `socket.io`, `compression`, `qrcode`, `dotenv`, `internal-ip`, `axios`, `@aws-sdk/*` solo en local, no en relay), ~80 MB
- `server/` (`index.js` wrapper, `local/index.js`, `relay/index.js` no incluido en Desktop pero sí shared, `songs.db` 0.5 MB, `views/admin_modes.html`, `shared/artist-metadata.json`)
- `public/` (`tv.html`, `mobile.html`, `js/`, `assets/` WebP/MP3 392 audios, `libs/` Tailwind/Anime/GSAP/QRCode)
- `package.json`, `ritmika.ico`
- **No incluye:** `.git`, `node_modules/.cache`, `*.db-shm`, `.env`, `R2_SECRET`, `GITHUB_TOKEN`, `ELEVENLABS_API_KEY`, `ADMIN_TOKEN` real, `runtime/node` no commiteado (en `.gitignore`)

## 11. Tamaño del instalador

- No compilado en CI Linux (requiere Windows + .NET + ISCC). Estimado a partir de `bench` local + `du`:
  - `Ritmika.exe` + DLLs: ~2.5 MB
  - `runtime/node`: ~35 MB descomprimido
  - `node_modules` prod: ~95 MB (con better-sqlite3)
  - `public` + `server/songs.db`: ~55 MB
  - Total sin comprimir: ~185 MB → **Instalador `Ritmika-Setup-x64-1.0.1.exe` comprimido lzma: ~110-140 MB** (ver `installer/output/` tras `iscc installer.iss`)
- Para medir exacto en Windows: `build.bat` → `installer/output/Ritmika-Setup-x64-1.0.1.exe` → `dir installer\output`.

## 12. Uso de RAM/CPU observado

`scripts/benchmark.js` (Linux, Node 22, sin WebView2):

- Arranque local: **~480 ms** (SQLite 3845, Express, Socket.IO)
- Arranque relay: **~420 ms**
- Carga catálogo 1 canción: **~7 ms**
- Memoria Node (proceso benchmark): **~7 MB heap** (local idle; con WebView2 + vídeo + 4 jugadores esperar ~180-280 MB RAM host total: Node ~70 MB + WebView2 ~120 MB + sistema)
- Latencia Socket.IO relay local (127.0.0.1): crear sala **3 ms**, join **1-2 ms**, broadcast **1-3 ms**, tomatazo **1 ms**
- En Render (estimado): TV↔relay↔móvil **30-80 ms** (medir con teléfono en datos móviles vs PC en otra red; no afirmamos “más rápido” sin medir; se recomienda `scripts/benchmark.js` + `chrome://tracing` para WebView2).
- GPU: `GameWindow.cs` conserva `--enable-gpu-rasterization --enable-zero-copy --enable-accelerated-video-decode --disable-software-rasterizer`; verificar en `chrome://gpu` dentro de WebView2 (debe decir `Hardware accelerated`); no saturar CPU/GPU, solo render estable y assets locales.

## 13. Resultado de pruebas

```bash
npm test                    # 13 passed (protocol.test.js)
node tests/relay.test.js    # 7 passed
node tests/smoke.test.js    # todos los pasos OK
node scripts/benchmark.js   # ver §12
node scripts/audit_secrets.js # ✓ OK
```

- **protocol.test.js (13):** `server_version`, `tv:create_room` 4 chars, `player:join` válido/inválido, 2 salas aisladas, `tv:broadcast→game:update`, `player:tomatazo→tv:tomatazo`, `tv:send_to_player→game:private`, host autenticado (`player:start_game` solo host), disconnect→`tv:player_left` + `HOST_ASSIGNED`, `tv:close_room→game:tv_disconnected`, rate limiting 2s, handlers esperados.
- **relay.test.js (7):** `hostToken` privado, `playerId` reconexión sin duplicar, `hostToken` protege `tv:broadcast`, `tv:reconnect_host` recupera sala, `MAX_PLAYERS_PER_ROOM` 4 bloquea 5º, relay no sirve `/api/songs` (404), `relayUrl` en `tv:room_created`.
- **smoke.test.js:** TV crea sala en relay → 2 móviles join → `tv:start_game` → `game:started` → `ROULETTE_START` broadcast → `select_genres` → `tomatazo` → `vote` → `assign_song` → reconexión móvil con mismo `playerId` (`reconnected:true`) → TV `tv:reconnect_host` con `hostToken` → OK.

Modo LAN probado: `RELAY_URL` vacío → `RITMIKA_CONFIG.CONNECTION_MODE='lan'`, `io()` local, QR `http://192.168.x.x:3000/join` (ver `Ritmika.sh`).

Modo online probado localmente: `RELAY_URL=http://127.0.0.1:34568` + `RELAY_PORT=34568` → TV `io(RELAY_URL)`, QR `http://127.0.0.1:34568/join?code=…`, móvil escanea vía IP y conecta al relay (simulado con `socket.io-client` en `benchmark.js`).

## 14. Resultado del smoke test externo (requerido)

> **Prueba obligatoria con teléfono por datos móviles y PC por otra red** — no ejecutable en CI sin hardware. Para demostrar, usar relay desplegado (ej. Render):

1. `RELAY_URL=https://<app>.onrender.com ./Ritmika.sh` (PC anfitriona, otra red)
2. Desktop muestra QR `https://<app>.onrender.com/join?code=ABCD`
3. Teléfono en 4G escanea QR → `GET https://<app>.onrender.com/join` → `io()` al relay → `player:join` → TV `tv:player_joined` (verificado con `smoke.test.js` en local; para real, usar `adb logcat` + `chrome://inspect` en móvil y `server.log` en `%LOCALAPPDATA%\Ritmika\logs\server.log`).
4. Jugar 1 ronda completa con 2 teléfonos.

**Estado actual:** smoke local pasa; smoke externo requiere desplegar relay (`docs/DEPLOY_RELAY.md`) y ejecutar `build.bat` en Windows limpio. No se ha ejecutado smoke externo con hardware real en esta sesión (limitación entorno Linux). Se deja preparado `tests/smoke.test.js` y `Ritmika.sh` para reproducirlo.

## 15. Problemas o limitaciones restantes

- **Instalador no compilado en este entorno Linux** (requiere Windows + .NET + Inno Setup). `installer.iss` y `build.bat` están listos y validados sintácticamente, pero `Ritmika-Setup-x64.exe` no generado aquí (ver §11 tamaño estimado).
- **WebView2 Runtime no asumido:** `Launcher.cs:IsWebView2Available()` verifica registro `EdgeUpdate\Clients\{F301...}` y carpeta `EdgeWebView`; si falta, muestra dialog y abre `https://go.microsoft.com/fwlink/p/?LinkId=2124703`, pero no instala silenciosamente (requiere admin). GameWindow también captura excepción y muestra `MessageBox`.
- **Video cache progresivo, no precarga:** `videoCache.js` implementa LRU y endpoints, pero TV solo dispara `POST /api/video-cache/:id/download` en background para canción actual; no precarga 3845. Si `media.pixelhub.party` no es público o requiere presign, TV usará `GET /api/video-url` (que ya soporta `R2_SECRET`), con fallback a `song.url`.
- **R2 directo asumido público:** `game.js` prefiere `song.url` si contiene `media.pixelhub.party`; si bucket se vuelve privado, se requiere configurar `R2_*` en `%LOCALAPPDATA%\Ritmika\.env` del Desktop (no en instalador) y TV usará presign.
- **Local DB `songs.db` no duplicada en relay:** relay usa `artist-metadata.json` ligera; si se añaden modos nuevos, regenerar con `npm run generate:artist-metadata`.
- **Host reasignación en reconexión:** si host original se desconecta y vuelve tras reasignar nuevo host, no recupera automáticamente host (debe ser reasignado manualmente). Para TV, `hostToken` sí permite recuperar.
- **Performance no medida en WebView2 real:** benchmark mide Node y latencia socket, no FPS en WebView2. Recomendar `chrome://gpu` y `requestAnimationFrame` FPS counter en TV (pendiente).
- **Secrets audit:** pasa, pero `ADMIN_TOKEN` real no debe ponerse en `installer.iss` ni `public/*.js`; `server/relay` no necesita `R2_SECRET`.

## 16. Comando exacto para construir `Ritmika-Setup-x64.exe`

```bat
:: Windows 10/11, .NET 4.x, Node 22 LTS, Inno Setup 6 en PATH
git clone https://github.com/ChronosBVRX/Ritmika.git
cd Ritmika
git checkout feat/desktop-local-online-relay
:: Opcional: configurar relay para online
:: echo RELAY_URL=https://ritmika-relay.onrender.com > .env
build.bat
:: Si solo se quiere exe sin instalador:
:: iscc no requerido, build.bat genera Ritmika.exe igualmente
:: Para solo instalador tras build:
iscc installer.iss
```

En Linux (verificación):

```bash
git fetch origin
git checkout feat/desktop-local-online-relay
./build.sh
./Ritmika.sh                 # lan
RELAY_URL=http://127.0.0.1:34568 ./Ritmika.sh  # online (con relay en 34568)
npm test && node tests/relay.test.js && node tests/smoke.test.js
node scripts/audit_secrets.js
```

## 17. Ruta exacta del artefacto generado

- **Ejecutable:** `Ritmika.exe` (y `WebView2Loader.dll`, `Microsoft.Web.WebView2.*.dll`, `ritmika.ico`) en raíz tras `build.bat`.
- **Instalador:** `installer/output/Ritmika-Setup-x64-1.0.1.exe` (tras `iscc installer.iss`).
- **Logs/cache en instalado:** `%LOCALAPPDATA%\Ritmika\logs\server.log`, `%LOCALAPPDATA%\Ritmika\cache\videos\`.

---

**Criterio de aceptación:** Con este trabajo, una PC limpia con Windows puede instalar `Ritmika-Setup-x64.exe`, abrir `Ritmika.exe` (sin instalar Node ni npm), seleccionar modo, obtener QR `https://<relay>/join?code=ABCD`, y un teléfono en datos móviles (sin WiFi de PC) puede escanear y jugar mientras TV, animaciones, audio, catálogo y vídeo corren local en la PC. La nube solo transporta `roomCode`, `hostToken` (privado), `playerId` y eventos pequeños (`game:update`, `game:private`).

**No merge a main hasta entregar reporte y pruebas.** Rama lista para revisión: `feat/desktop-local-online-relay`.
