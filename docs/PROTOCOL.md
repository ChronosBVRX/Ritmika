# Protocolo Socket.IO — Rítmika (congelado f341ac1)

> HEAD: `f341ac1b0396b800eee178b379f9f75e45ed011d` — `feat(linux): agregar ejecutable local Ritmika.sh + build.sh`
> Fecha congelación: 2026-09-18
> Archivo fuente único: `server/index.js` (~942 líneas) — Express + Socket.IO + SQLite. TV en `public/js/tv/socket.js` usa `io()` mismo origen. Mobile en `public/mobile.html` usa `io()` mismo origen.

Este documento congela el protocolo antes de la separación `local-host` / `relay`. **Nombres de eventos se conservan** para reducir regresiones.

---

## 1. Conexión

Al conectar, el servidor emite inmediatamente:

| Evento | Dirección | Payload | Nota |
|---|---|---|---|
| `server_version` | `server → tv, player` | `string` (`package.json.version` = `1.0.1`) | Al `socket` recién conectado |

CORS: `isLocalOrigin()` — permite `localhost`, `127.0.0.1`, `192.168.*`, `10.*`, `172.16-31.*`, `*.local`, `RENDER_EXTERNAL_URL` hostname. Rechaza otros orígenes con `403` en REST y `Error('Origin not allowed by CORS')` en Socket.IO.

---

## 2. TV → Relay (TV es autoridad de sala, pero servidor es relay tonto)

| Evento | Payload | Validación servidor | Efecto |
|---|---|---|---|
| `tv:create_room` | `{ mode?: 'clasico'|'emo' }` | Destruye sala previa de esa TV (`tvSocketId`), genera `roomCode` 4 chars `A-Z2-9` sin `O0I1`, `mode` sanitizado a `clasico` default | `rooms.set(code,{tvSocketId, players:Map, hostPlayerSocketId:null, mode})`, `socket.join(code)`, emite `tv:room_created` a TV |
| `tv:close_room` | `{}` | Busca sala por `tvSocketId` | Emite `game:tv_disconnected` a sala, `rooms.delete(code)` |
| `tv:broadcast` | `{ roomCode, event:string, data:object }` | Verifica `room.tvSocketId === socket.id` | `socket.to(roomCode).emit('game:update',{event,data})` a todos los jugadores |
| `tv:send_to_player` | `{ targetSocketId, event:string, data:object }` | Verifica TV dueña de sala y `players.has(targetSocketId)` | `io.to(targetSocketId).emit('game:private',{event,data})` |
| `tv:add_bot` | `{ roomCode }` | Verifica TV dueña | Crea `bot_<rand>` con nombre de lista 6, avatar random 0-7, emite `tv:player_joined`, luego `tv:player_genres` (500ms) y `tv:player_artists` (1000ms) |
| `tv:start_game` | `{ roomCode }` | Verifica TV dueña | `socket.to(roomCode).emit('game:started',{message})` |

---

## 3. Jugador → Relay

| Evento | Payload | Cooldown | Validación | Relay → TV |
|---|---|---|---|---|
| `player:join` | `{ roomCode, name, avatarId }` | — | `room` existe, `name` trim ≤15 sanitizado `<>` fallback `Jugador N`, `avatarId` clamp 0-7 | `player:join_ack` a jugador `{success, roomCode, mode, players}` + `tv:player_joined` a TV `{player, players}`; asigna `hostPlayerSocketId` al primero |
| `player:select_genres` | `{ roomCode, genres:string[] }` | — | `players.has(socket.id)` | `tv:player_genres {socketId, genres}` |
| `player:select_artists` | `{ roomCode, artists:string[] }` | — | igual | `tv:player_artists {socketId, artists}` |
| `player:tomatazo` | `{ roomCode, targetName }` | 2000ms (`canAct`) | `players.has` | `tv:tomatazo {attackerName, attackerSocketId, targetName}` (coste descontado en TV) |
| `player:emoji` | `{ roomCode, emoji }` | 500ms | `players.has` | `tv:emoji {senderName, emoji}` |
| `player:sabotage_audio` | `{ roomCode }` | 3000ms | `players.has` | `tv:sabotage_audio {socketId}` |
| `player:vote` | `{ roomCode, score, performerSocketId }` | — | `players.has`, `score` clamp `[10,30,60,100]` default 10, `performerSocketId` existe en sala | `tv:vote {voterName, voterSocketId, performerSocketId, score}` |
| `player:assign_song` | `{ roomCode, targetSocketId, songId }` | — | `players.has(socket.id)` + `players.has(targetSocketId)` + `songId` string ≤100 + existe en `songs.db` si DB ready | `tv:song_assigned {attackerName, attackerSocketId, targetSocketId, songId}` |
| `player:start_game` | `{ roomCode }` | — | `hostPlayerSocketId === socket.id` | `tv:start_game_trigger` a TV |
| `player:start_song` | `{ roomCode }` | — | host only | `tv:start_song_trigger` |
| `player:next_turn` | `{ roomCode }` | — | host only | `tv:next_turn_trigger` |
| `player:new_game` | `{ roomCode }` | — | host only | `tv:new_game_trigger` |

---

## 4. Relay → TV

| Evento | Payload | Origen |
|---|---|---|
| `tv:room_created` | `{ roomCode, mode, localIP, hotspotSSID, hotspotPassword }` | `tv:create_room` |
| `tv:player_joined` | `{ player:{name,avatarId,socketId}, players:[{name,avatarId,socketId}] }` | `player:join` / `tv:add_bot` |
| `tv:player_left` | `{ socketId, name, players }` | `disconnect` jugador |
| `tv:player_genres` | `{ socketId, genres }` | `player:select_genres` |
| `tv:player_artists` | `{ socketId, artists }` | `player:select_artists` |
| `tv:tomatazo` | `{ attackerName, attackerSocketId, targetName }` | `player:tomatazo` |
| `tv:emoji` | `{ senderName, emoji }` | `player:emoji` |
| `tv:sabotage_audio` | `{ socketId }` | `player:sabotage_audio` |
| `tv:vote` | `{ voterName, voterSocketId, performerSocketId, score }` | `player:vote` |
| `tv:song_assigned` | `{ attackerName, attackerSocketId, targetSocketId, songId }` | `player:assign_song` |
| `tv:start_game_trigger` | `{}` | `player:start_game` (host) |
| `tv:start_song_trigger` | `{}` | `player:start_song` (host) |
| `tv:next_turn_trigger` | `{}` | `player:next_turn` (host) |
| `tv:new_game_trigger` | `{}` | `player:new_game` (host) |

---

## 5. Relay → Jugador

| Evento | Payload | Origen |
|---|---|---|
| `player:join_ack` | `{ success:boolean, roomCode?, mode?, players?, error? }` | `player:join` (éxito o `Sala no encontrada`) |
| `game:started` | `{ message }` | `tv:start_game` (broadcast a sala) |
| `game:update` | `{ event:string, data:object }` | `tv:broadcast` (re-emitido a jugadores) |
| `game:private` | `{ event:string, data:object }` | `tv:send_to_player` (sub-eventos abajo) |
| `game:tv_disconnected` | `{ message }` | `tv:close_room` o `disconnect` TV (`socket.to(code).emit`) |

### 5a. Sub-eventos `game:update` (TV → jugadores vía `tv:broadcast`)

Emitidos por `public/js/tv/game.js` y `socket.js`. Manejados en `public/mobile.html:handleGameEvent`:

```
NEW_SINGER, ROULETTE_START, SINGER_SELECTED, VOTE_PHASE_START, KARAOKE_START,
SHOW_SCOREBOARD, ROUND_2_ASSIGN, GAME_OVER, PLAYER_JOINED, PLAYER_LEFT,
ROUND_INFO, VOTE_COUNT, SONG_TIMER, SCORE_UPDATE
```

Detalle:
- `PLAYER_JOINED {players}` / `PLAYER_LEFT {players}` — sync lista espera
- `ROUND_INFO {round}` — etiqueta ronda
- `SCORE_UPDATE {players:[{socketId,score,name}]}` — tras tomatazo
- `VOTE_COUNT {count, total}` — votos recibidos
- `SONG_TIMER {active, elapsed, duration}` — barra progreso karaoke
- `ROULETTE_START {}`, `SINGER_SELECTED {socketId,name,song}`, `KARAOKE_START {socketId,name,song}`, `VOTE_PHASE_START {performerSocketId}`, `SHOW_SCOREBOARD {performerName}`, `ROUND_2_ASSIGN {players,songs}`, `GAME_OVER {players}`, `NEW_SINGER {socketId,name}`

### 5b. Sub-eventos `game:private` (TV → jugador específico)

Manejados en `public/mobile.html:handlePrivateEvent` y `socket.js:syncReconnectedPlayer`:

```
HOST_ASSIGNED {isHost:true}, YOUR_TURN {}, TOMATAZO_REJECTED {reason,cost},
GAME_OVER {players}, ROUND_2_ASSIGN {players,songs}, ROULETTE_START {},
SINGER_SELECTED {socketId,name,song}, VOTE_PHASE_START {performerSocketId},
KARAOKE_START {socketId,name,song}
```

---

## 6. Desconexión

- **TV desconecta**: `rooms.delete(code)`, `socket.to(code).emit('game:tv_disconnected')`. Salas en memoria — se pierden al reiniciar server.
- **Jugador desconecta**: `players.delete(socketId)`, reasigna `hostPlayerSocketId` al siguiente `!bot_` → emite `game:private HOST_ASSIGNED` al nuevo host, emite `tv:player_left` a TV. `lastEventTime` cleanup.
- TV mantiene `state.players` con flag `disconnected` para reconexión por nombre (frágil, usa `socketId` como identidad).

---

## 7. Rate limiting y validación (congelado)

- `canAct(socket.id, ms)` con `lastEventTime` Map: tomatazo 2000, emoji 500, sabotage 3000. Silenciosamente ignorado si cool-down.
- `GET /api/video-url` — 30 req/IP/min (`urlReqCount` Map), `429` si excede.
- Sanitización: `name` ≤15 `<>` strip, `avatarId` 0-7, `score` ∈[10,30,60,100], `targetName` ≤15 strip, `roomCode` uppercase trim, `songId` ≤100 y existe en DB.
- Sin auth, sin token host — `roomCode` es única credencial (a mejorar en fase 7).

---

## 8. REST relevante para protocolo

- `GET /api/room/:code` → `{mode}` o 404. Usado por mobile antes de `player:join` para `fetchAndBuildCatalog`.
- `GET /api/artist-map?mode=` → usado por mobile para poblar `ARTISTS_BY_GENRE`.
- `GET /api/health` → bootloader TV step 3-4.
- `GET /api/video-url?id=` → TV obtiene URL R2, no usado por mobile.

---

## 9. Garantías a conservar tras refactorización

- Nombres de eventos idénticos.
- Payload shapes idénticos (añadir campos opcionales `playerId`, `hostToken` de forma aditiva, no romper).
- TV sigue siendo autoridad (relay no calcula scores/rondas).
- `socket.id` sigue existiendo como transporte, pero se añade `playerId` estable.
- Tests de protocolo deben pasar antes y después.

---

## 10. Tests asociados

`tests/protocol.test.js` — cubre creación, join válido/inválido, aislamiento, broadcast, private, host triggers, disconnect, rate limiting (ver `tests/README.md`).
