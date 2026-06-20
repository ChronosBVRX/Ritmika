# API Reference

Referencia completa de endpoints REST y eventos Socket.io del servidor Rítmika.

> Servidor: `server/index.js` — Express + Socket.io, puerto 3000.

---

## REST Endpoints

### `GET /`

Sirve la pantalla de TV (`public/tv.html`). La ruta principal del juego.

### `GET /join`

Sirve el controlador móvil (`public/mobile.html`). Los jugadores acceden escaneando el QR.

### `GET /qr-game`

Genera un PNG de código QR (400×400px) con la URL de conexión a la sala.

- **Response**: `image/png`
- **Cache-Control**: `no-cache`

### `GET /qr-wifi`

Genera un PNG de código QR con las credenciales WiFi en formato estándar `WIFI:`.

- **Response**: `image/png`
- **Formato**: `WIFI:T:WPA;S:<SSID>;P:<PASSWORD>;;`
- **Variables**: Usa `HOTSPOT_SSID` y `HOTSPOT_PASSWORD` del `.env`

### `GET /api/network-config`

Devuelve la configuración de red local para que los clientes se conecten.

```json
{
  "ip": "192.168.1.100",
  "port": 3000,
  "joinUrl": "http://192.168.1.100:3000/join"
}
```

### `GET /api/songs`

Devuelve la base de datos completa de canciones de karaoke.

- **Response**: Array de objetos song
- **CORS**: Solo orígenes locales (`isLocalOrigin()`)
- **Fuente**: `server/r2_db.json` (cargado en memoria al inicio)

```json
[
  {
    "id": "abc123",
    "title": "Canción de ejemplo",
    "artist": "Artista",
    "genre": "reggaeton",
    "url": "https://...",
    "duration": 180
  }
]
```

### `GET /api/audio-files`

Lista todos los archivos `.mp3` en `public/assets/audio/` (ordenados alfabéticamente). Usado por el preloader de la TV.

```json
["idle_0.mp3", "lobby_join_0.mp3", "..."]
```

### `GET /api/health`

Verifica que el servidor esté operativo.

```json
{
  "server": true,
  "catalog": true,
  "catalogCount": 2820,
  "videoSource": "cloudflare-r2"
}
```

### `GET /api/video-url?id=<songId>`

Genera una URL presignada de Cloudflare R2 (expira en 30 minutos) para reproducir el video de una canción.

- **Parámetros**: `id` (string, requerido) — ID de la canción
- **Response**:

```json
{
  "url": "https://r2.cloudflarestorage.com/...",
  "expires": 1800,
  "song": { "id": "...", "title": "...", "artist": "..." }
}
```

- **Rate limit**: 30 requests por IP por minuto (HTTP 429 si se excede)
- **Errores**: `400` (id faltante), `404` (canción no encontrada)

---

## Socket.io Events

### Conexión

Al conectarse, el servidor envía automáticamente:

| Evento | Target | Payload | Descripción |
|--------|--------|---------|-------------|
| `server_version` | Socket | `"1.0.1"` | Versión del servidor |

### TV → Server

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `tv:create_room` | `{}` | Crea una sala. Genera código de 4 caracteres. Destruye sala previa si existe. |
| `tv:close_room` | `{}` | Cierra la sala manualmente. Notifica a todos los jugadores. |
| `tv:broadcast` | `{ roomCode, event, data }` | Emite un evento genérico a todos los clientes de la sala. |
| `tv:send_to_player` | `{ targetSocketId, event, data }` | Envía un evento privado a un jugador específico. |
| `tv:add_bot` | `{ roomCode }` | Agrega un bot de prueba con nombre y avatar aleatorios. |
| `tv:start_game` | `{ roomCode }` | Inicia el juego. Solo aceptado si el socket es el dueño de la sala. |

### Player → Server

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `player:join` | `{ roomCode, name, avatarId }` | Se une a una sala existente. Nombre: máx 15 chars, sin HTML. Avatar: 0-7. |
| `player:select_genres` | `{ roomCode, genres: string[] }` | Envía preferencias de género al TV. |
| `player:select_artists` | `{ roomCode, artists: string[] }` | Envía preferencias de artista al TV. |
| `player:tomatazo` | `{ roomCode, targetName }` | Lanza un tomate a un jugador. Cooldown: 2s. |
| `player:emoji` | `{ roomCode, emoji }` | Envía un emoji de reacción. Cooldown: 500ms. |
| `player:sabotage_audio` | `{ roomCode }` | Activa sabotaje de audio. Cooldown: 3s. |
| `player:vote` | `{ roomCode, score, performerSocketId }` | Vota por un cantante. Score: 10, 30, 60 o 100. |
| `player:assign_song` | `{ roomCode, targetSocketId, songId }` | Asigna una canción a otro jugador (Ronda 2). |
| `player:start_game` | `{ roomCode }` | Trigger para iniciar el juego (reenviado al TV). |
| `player:start_song` | `{ roomCode }` | Trigger para iniciar la canción (reenviado al TV). |
| `player:next_turn` | `{ roomCode }` | Trigger para avanzar al siguiente turno (reenviado al TV). |
| `player:new_game` | `{ roomCode }` | Trigger para nueva partida (reenviado al TV). |

### Server → TV

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `tv:room_created` | `{ roomCode, localIP, hotspotSSID, hotspotPassword }` | Confirmación de sala creada con datos de conexión. |
| `tv:player_joined` | `{ player, players }` | Nuevo jugador se unió. Lista actualizada. |
| `tv:player_left` | `{ socketId, name, players }` | Jugador se desconectó. Lista actualizada. |
| `tv:player_genres` | `{ socketId, genres }` | Preferencias de género recibidas. |
| `tv:player_artists` | `{ socketId, artists }` | Preferencias de artista recibidas. |
| `tv:tomatazo` | `{ attackerName, attackerSocketId, targetName }` | Evento de tomate para animación en TV. |
| `tv:emoji` | `{ senderName, emoji }` | Emoji de reacción para mostrar en TV. |
| `tv:sabotage_audio` | `{ socketId }` | Evento de sabotaje de audio. |
| `tv:vote` | `{ voterName, voterSocketId, performerSocketId, score }` | Voto registrado. |
| `tv:song_assigned` | `{ attackerName, attackerSocketId, targetSocketId, songId }` | Canción asignada en Ronda 2. |
| `tv:start_game_trigger` | forwarded | Trigger de inicio de juego desde móvil. |
| `tv:start_song_trigger` | forwarded | Trigger de inicio de canción desde móvil. |
| `tv:next_turn_trigger` | forwarded | Trigger de siguiente turno desde móvil. |
| `tv:new_game_trigger` | forwarded | Trigger de nueva partida desde móvil. |

### Server → Player

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `player:join_ack` | `{ success, roomCode?, players?, error? }` | Ack de unión a sala. |
| `game:started` | `{ message }` | El juego ha comenzado. |
| `game:update` | `{ event, data }` | Actualización genérica de estado del juego. |
| `game:private` | `{ event, data }` | Mensaje privado para un jugador específico. |
| `game:tv_disconnected` | `{ message }` | La TV se desconectó / sala cerrada. |

---

## Estructura de datos

### PlayerInfo

```json
{
  "name": "Axel",
  "avatarId": 3,
  "socketId": "abc123def"
}
```

### Room (interno, no expuesto)

```
rooms: Map<roomCode, {
  tvSocketId: string,
  players: Map<socketId, {
    name: string,       // máx 15 chars, sanitizado
    avatarId: number,   // 0-7
    socketId: string
  }>
}>
```

### Generación de código de sala

- 4 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Excluye O/0/I/1 para legibilidad
- Unicidad verificada con `do...while`

---

## Rate Limiting

### Socket.io

| Evento | Cooldown | Acción si excede |
|--------|----------|-----------------|
| `player:tomatazo` | 2000ms | Evento ignorado silenciosamente |
| `player:emoji` | 500ms | Evento ignorado silenciosamente |
| `player:sabotage_audio` | 3000ms | Evento ignorado silenciosamente |

### REST

| Endpoint | Límite | Acción si excede |
|----------|--------|-----------------|
| `/api/video-url` | 30 req/IP/min | HTTP 429 `{ "error": "Too many requests. Slow down." }` |

---

## Sanitización de entrada

| Campo | Regla |
|-------|-------|
| `name` | Trim, máx 15 chars, tags HTML eliminados, fallback a "Jugador N" |
| `avatarId` | Clamp a entero 0-7, default 0 |
| `score` | Clamp a `[10, 30, 60, 100]`, inválido → 10 |
| `targetName` | Trim, máx 15 chars, tags HTML eliminados |
| `roomCode` | Uppercase + trim antes de buscar |

---

## Variables de entorno

| Variable | Default | Uso |
|----------|---------|-----|
| `PORT` | `3000` | Puerto del servidor |
| `RENDER_EXTERNAL_URL` | — | Override de URL para QR (deploy en Render) |
| `PUBLIC_URL` | — | Override de URL base |
| `R2_ACCESS_KEY_ID` | — | Cloudflare R2 (presigned URLs) |
| `R2_SECRET_ACCESS_KEY` | — | Cloudflare R2 |
| `R2_ENDPOINT` | `https://...r2.cloudflarestorage.com` | Endpoint R2 |
| `HOTSPOT_SSID` | `Ritmika` | SSID del hotspot WiFi |
| `HOTSPOT_PASSWORD` | `Ritmika2026` | Contraseña del hotspot |
