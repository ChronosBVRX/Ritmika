# API Reference

Referencia completa de endpoints REST y eventos Socket.io del servidor Rítmika.

> Servidor: `server/index.js` (~600 líneas) — Express + Socket.io + compression, puerto 3000.

---

## REST Endpoints

### `GET /`

Sirve la pantalla de TV (`public/tv.html`).

### `GET /join`

Sirve el controlador móvil (`public/mobile.html`).

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

Devuelve la configuración de red local para que los clientes se conecten. Usa `internal-ip` para detectar la IP automáticamente.

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
- **Fuente**: `server/r2_db.json` (cargado en memoria al inicio), fallback a `karaoke_db.json`

```json
[
  {
    "id": "r2_d28183bb3f65",
    "title": "3BallMTY & America Sierra Porque el amor manda",
    "artist": "3Ball MTY",
    "genre": "reggaeton",
    "url": "https://media.pixelhub.party/...",
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

Verifica que el servidor esté operativo. Usado por el bootloader de la TV.

```json
{
  "server": true,
  "catalog": true,
  "catalogCount": 3845,
  "videoSource": "cloudflare-r2"
}
```

### `GET /api/video-url?id=<songId>`

Genera una URL presignada de Cloudflare R2 (expira en 30 minutos) para reproducir el video de una canción.

- **Parámetros**: `id` (string, requerido) — ID de la canción
- **Response**:

```json
{
  "url": "https://ritmika.3bb6544fbc15f95620470c922b1a0dfe.r2.cloudflarestorage.com/...",
  "expires": 1800,
  "song": { "id": "r2_...", "title": "...", "artist": "..." }
}
```

- **Rate limit**: 30 requests por IP por minuto (HTTP 429 si se excede)
- **Fallback**: Si R2 no está configurado, devuelve la URL pública del bucket
- **Errores**: `400` (id faltante), `404` (canción no encontrada)

---

## Socket.io Events

### Conexión

Al conectarse, el servidor envía automáticamente:

| Evento | Target | Payload | Descripción |
|--------|--------|---------|-------------|
| `server_version` | Socket | `"1.0.1"` | Versión del servidor (de package.json) |

### TV → Server

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `tv:create_room` | `{}` | Crea una sala. Genera código de 4 caracteres. Destruye sala previa si existe. |
| `tv:close_room` | `{}` | Cierra la sala manualmente. Notifica a todos los jugadores. |
| `tv:broadcast` | `{ roomCode, event, data }` | Emite un evento genérico a todos los clientes de la sala. |
| `tv:send_to_player` | `{ targetSocketId, event, data }` | Envía un evento privado a un jugador específico. |
| `tv:add_bot` | `{ roomCode }` | Agrega un bot de prueba. 6 nombres predefinidos, avatar y géneros aleatorios. |
| `tv:start_game` | `{ roomCode }` | Inicia el juego. Solo aceptado si el socket es el dueño de la sala. |

### Player → Server

| Evento | Payload | Cooldown | Descripción |
|--------|---------|----------|-------------|
| `player:join` | `{ roomCode, name, avatarId }` | — | Se une a una sala existente. Nombre: máx 15 chars, sin HTML. Avatar: 0-7. |
| `player:select_genres` | `{ roomCode, genres: string[] }` | — | Envía preferencias de género al TV. |
| `player:select_artists` | `{ roomCode, artists: string[] }` | — | Envía preferencias de artista al TV. |
| `player:tomatazo` | `{ roomCode, targetName }` | 2s | Lanza un tomate a un jugador. |
| `player:emoji` | `{ roomCode, emoji }` | 500ms | Envía un emoji de reacción. |
| `player:sabotage_audio` | `{ roomCode }` | 3s | Activa sabotaje de audio. |
| `player:vote` | `{ roomCode, score, performerSocketId }` | — | Vota por un cantante. Score: 10, 30, 60 o 100. |
| `player:assign_song` | `{ roomCode, targetSocketId, songId }` | — | Asigna una canción a otro jugador (Ronda 2). |
| `player:start_game` | `{ roomCode }` | — | Trigger para iniciar el juego (reenviado al TV como `tv:start_game_trigger`). |
| `player:start_song` | `{ roomCode }` | — | Trigger para iniciar la canción (reenviado al TV como `tv:start_song_trigger`). |
| `player:next_turn` | `{ roomCode }` | — | Trigger para avanzar al siguiente turno (reenviado al TV como `tv:next_turn_trigger`). |
| `player:new_game` | `{ roomCode }` | — | Trigger para nueva partida (reenviado al TV como `tv:new_game_trigger`). |

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

## Bot System

Cuando la TV llama a `tv:add_bot`, el servidor:

1. Genera un socket ID con prefijo `bot_`
2. Selecciona nombre de 6 predefinidos (cicla por `room.players.size % 6`):
   - Axolote Veloz, Catarina Rockera, Tlacuache Punk, Mariachi Loco, Llama Popstar, Chiba DJ
3. Agrega `(Bot)` al nombre
4. Asigna avatar aleatorio (0-7)
5. Después de 500ms: auto-selecciona 2 géneros aleatorios de la DB
6. Después de 1000ms: auto-selecciona 2 artistas aleatorios de la DB

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
| `ELEVENLABS_API_KEY` | — | Solo para scripts de generación de audio |
| `ELEVENLABS_VOICE_ID` | — | Solo para scripts de generación de audio |
