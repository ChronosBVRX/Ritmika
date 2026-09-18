# Rítmika Relay — Despliegue

> **Pasarela ligera en Internet** — solo salas, presencia y relay. Cero lógica de juego.

## Qué hace

- `GET /` → `{relay:true, version, join:'/join'}`
- `GET /join` → `public/mobile.html` (control móvil)
- `GET /api/relay-health` → `{relay:true, rooms, uptime, version}`
- `GET /api/health` → `{relay:true, server:true}` (compat bootloader)
- `GET /api/room/:code` → `{mode}` o 404
- `GET /api/artist-map` → metadata ligera (`server/shared/artist-metadata.json`, 8 géneros, ~626 artistas, no DB completa)
- `GET /public/*` → assets ligeros para móvil (libs, avatares)
- **Socket.IO** (CORS: abierto si no hay allowlist; con `CORS_ALLOWED_ORIGINS` solo lista + `localhost`/`127.0.0.1`/`::1`): `tv:create_room`, `player:join`, `tv:broadcast`, `tv:send_to_player`, `player:*`, `tv:reconnect_host`, `player:reconnect` etc. (ver `docs/PROTOCOL.md` §11)

**No hace:** no calcula puntuaciones/rondas, no rinde, no procesa vídeo, no sirve `songs.db`, no guarda estado completo, no anima.

## Variables

| Variable | Default | Uso |
|---|---|---|
| `PORT` / `RELAY_PORT` | `3000` | Puerto HTTP |
| `RELAY_PUBLIC_URL` / `RELAY_URL` | `http://localhost:3000` | URL pública para QR y `tv:room_created.relayUrl` |
| `ROOM_TTL` / `ROOM_TTL_MS` | `7200s` / `2h` | TTL salas huérfanas |
| `MAX_PLAYERS_PER_ROOM` | `8` | Límite por sala |
| `PLAYER_RECONNECT_GRACE_MS` | `300000` (5 min) | Ventana real de reconexión de jugador; al expirar se borra de `room.disconnected` y `playerIdToSocket` |
| `CORS_ALLOWED_ORIGINS` | `` (abierto) | Lista coma-sep. de hostnames/orígenes permitidos. Si está configurada, solo se aceptan esos + `localhost`/`127.0.0.1`/`::1`; cualquier otro origen se deniega (sin fallback permisivo). Sin configurar, relay público para móviles |

No usar `RENDER_EXTERNAL_URL` como concepto central; relay es agnóstico (Render/Fly.io/Railway/VPS).

## Despliegue

### Local (prueba)

```bash
RELAY_PORT=3001 node server/relay/index.js
curl http://localhost:3001/api/relay-health
```

### Render (ejemplo)

- Build: `npm ci --production` (no necesita `better-sqlite3`, `@aws-sdk` no usado en relay)
- Start: `node server/relay/index.js`
- Env: `RELAY_PUBLIC_URL=https://<app>.onrender.com`, `ROOM_TTL=7200`, `MAX_PLAYERS_PER_ROOM=8`
- Health check: `GET /api/relay-health`

### Fly247Railway/VPS

Igual, con `RELAY_PUBLIC_URL` apuntando al dominio público. No incluir `R2_*`, `ADMIN_TOKEN` real en cliente. Relay no necesita `songs.db`.

## Flujo online

1. Desktop inicia → `fetch('/api/config')` (local) obtiene `RELAY_URL` → `io(RELAY_URL)` (saliente, sin port forward)
2. Desktop `tv:create_room` → relay crea `roomCode` (4 chars) + `hostToken` (48 hex, solo TV) → `tv:room_created`
3. Desktop muestra QR: `https://<relay>/join?code=ABCD` (no `192.168.x.x`)
4. Teléfono escanea (datos móviles) → `GET https://<relay>/join` → `io()` al relay (mismo origen)
5. Teléfono `player:join {roomCode, name, avatarId, playerId}` → relay `tv:player_joined` → TV
6. TV es autoridad: `tv:broadcast` / `tv:send_to_player` con `hostToken` → relay valida y reenvía `game:update` / `game:private`

PC y teléfonos no necesitan misma red.

## Tolerancia

- TV `disconnect` no borra sala inmediato: marca `tvSocketId=null`, espera 2 min (`game:tv_disconnected {reconnectable:true}`), luego borra si sigue huérfana.
- `tv:reconnect_host {roomCode, hostToken}` recupera sala (timingSafeEqual). Móvil reconecta con mismo `playerId` (localStorage `ritmika_player_id`) → `reconnected:true`, TV reconoce por `playerId` aunque cambie `socketId` (WiFi→4G).
- `localStorage` en TV guarda `ritmika_host_token` + `ritmika_room_code`.

## Escalado y aislamiento

- Salas en `Map` en memoria (sin DB). `GET /api/room/:code` solo para pre-check.
- Rate limiting: `player:tomatazo` 2s, `emoji` 500ms, `sabotage` 3s; `IpRateLimiter` 60/min por IP.
- Validación: `roomCode` upper trim, `name` ≤15 strip `<>`, `avatarId` 0-7, `score` ∈[10,30,60,100], `songId` ≤100, payload JSON ≤20KB, `MAX_PLAYERS`.

## No proxy de vídeo

Vídeo va `R2 → PC` directo (`media.pixelhub.party`). Relay nunca ve `GET /api/video-url` ni streams. TV usa `song.url` directo si es público, con cache local opcional `POST /api/video-cache/:id/download` → `%LOCALAPPDATA%\Ritmika\cache\videos`.
