# Architecture

Descripción de la arquitectura del sistema Rítmika, componentes y flujo de datos.

---

## Visión general

Rítmika usa una arquitectura **dual-display** con un servidor central de relay:

```
┌─────────────────────────────────────┐
│            PC (Anfitrión)           │
│                                     │
│  ┌───────────┐  ┌───────────────┐  │
│  │ Node.js   │  │ Ritmika.exe   │  │
│  │ :3000     │◄─┤ (WebView2)    │  │
│  │           │  │ TV Screen     │  │
│  └─────┬─────┘  └───────────────┘  │
│        │                            │
│  ┌─────▼─────┐                     │
│  │ Hotspot   │                     │
│  │ WiFi      │                     │
│  └─────┬─────┘                     │
└────────┼───────────────────────────┘
         │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ 📱 Cel 1 │    │ 📱 Cel 2 │    │ 📱 Cel N │
    │ /join    │    │ /join    │    │ /join    │
    └─────────┘    └─────────┘    └─────────┘
```

### Principio clave: Servidor "pasoarela pura"

El servidor **no tiene lógica de juego**. Solo enruta eventos JSON entre la TV y los celulares. Todo el estado del juego (rondas, puntajes, turno actual) vive exclusivamente en `tv.html`.

**Por qué**: Simplifica el servidor, facilita depuración, y permite que el frontend evolucione sin tocar el backend.

---

## Componentes

### 1. Servidor (`server/index.js`)

**Stack**: Node.js + Express + Socket.io + compression + qrcode + AWS SDK (R2)

**Responsabilidades**:
- Servir archivos estáticos de `public/` con caching agresivo (1 año assets, no-cache HTML)
- Generar QR codes (WiFi y juego)
- Detectar IP local vía `internal-ip`
- Relay de eventos Socket.io entre TV y celulares
- Rate limiting por socket
- Generar presigned URLs de Cloudflare R2 para video
- Gestión de salas (crear, unir, cerrar)
- Compresión gzip en todas las respuestas
- Consultas SQLite filtradas (genres, artists, exclude, random, limit)

**No hace**:
- No valida reglas de juego
- No guarda puntajes
- No controla el flujo de rondas
- No tiene base de datos persistente (salas en memoria)

**Endpoints REST (9)**: Ver [API.md](API.md)

### 2. TV Frontend (`public/tv.html`)

**Stack**: HTML5 + Vanilla JS + Anime.js + GSAP + Tailwind CSS + SVG

**~5600 líneas** que contienen toda la lógica del juego:

- **Pantalla Pre-boot**: Splash con Axolo, desbloquea AudioContext
- **Bootloader**: 5 pasos (conectar, crear sala, cargar catálogo, FFmpeg, optimizar)
- **Selección de modo**: 5 modos (solo Clásico funciona)
- **Lobby**: QR, lista de jugadores, botón iniciar
- **Ruleta SVG**: Avatares PNG, giro determinista, auto-spin
- **Karaoke**: Video player, timer, mecánicas por ronda
- **Votación**: Promedio de votos → puntaje acumulado
- **Podio**: Ceremonia de 5 fases con premios especiales
- **Persistencia**: localStorage con TTL 4h, restore banner
- **Axolo**: Cut-ins estilo Persona, 180+ barks, 6 emociones, SFX ducking
- **Debug panel**: Ctrl+Shift+D

### 3. Mobile Frontend (`public/mobile.html`)

**Stack**: HTML5 + Vanilla JS + Tailwind CSS

**~1960 líneas**, 8 pantallas:

1. **Join** — Ingreso de código de sala (deep-linking con `?code=`)
2. **Avatar** — Selección de personaje (8 opciones con PNG)
3. **Géneros** — Selección de hasta 3 géneros musicales
4. **Artistas** — Selección de artistas filtrados por género
5. **Sala de espera** — Lista de jugadores conectados, VIP badge
6. **Panel de control** — Reacciones, sabotaje, info del cantante
7. **Asignación** — Selección de canción para rival (Ronda 2)
8. **Podio** — Resultado final y "Jugar otra vez"

**Features**: Service Worker PWA, haptic feedback, fullscreen automático, UISounds.

### 4. Launcher Nativo (`src/`)

**Stack**: C# WinForms (.NET Framework 4.x)

- `Launcher.cs` (281 líneas): Inicia Node.js, abre GameWindow. Audio de inicio comentado.
- `GameWindow.cs` (132 líneas): WebView2 fullscreen, sin animación de carga. Flags de GPU.
- Audio via P/Invoke a `winmm.dll` (MCI API, alias `ritmika_bgm`).

---

## Flujo de conexión

```
1. Ritmika.exe se abre
   └─► Launcher.cs mata proceso previo en puerto 3000
   └─► Inicia Node.js (server/index.js)
   └─► Abre GameWindow (WebView2) → carga http://localhost:3000

2. TV muestra pre-boot → bootloader de 5 pasos → selección de modo

3. TV crea sala
   └─► Socket: tv:create_room
   └─► Server genera código de 4 chars
   └─► Responde con: roomCode, localIP, hotspotSSID, hotspotPassword
   └─► TV muestra QR de WiFi + QR de juego + código

4. Jugador escanea QR WiFi → se conecta a la red

5. Jugador escanea QR juego → abre http://<IP>:3000/join

6. Jugador entra código + nombre + avatar
   └─► Socket: player:join
   └─► Server agrega a la sala, notifica a la TV
   └─► TV muestra al jugador en el lobby

7. Repetir 3-5 para cada jugador

8. Host inicia juego
   └─► Socket: tv:start_game → game:started a todos
```

---

## Flujo de datos durante el juego

### Broadcast general

```
TV ──tv:broadcast──► Server ──game:update──► Todos los jugadores
```

### Mensaje privado

```
TV ──tv:send_to_player(targetSocketId)──► Server ──game:private──► Jugador específico
```

### Evento de jugador → TV

```
Celular ──player:vote──► Server ──tv:vote──► TV
```

Cada acción del celular (voto, tomatazo, emoji, sabotaje) pasa por el server y llega a la TV.

---

## Base de datos de canciones

### DB principal: SQLite (`server/songs.db`)

- **Driver**: `better-sqlite3` (síncrono, nativo, rápido)
- **3,845 canciones** con URLs de Cloudflare R2 (`media.pixelhub.party`)
- **Schema**: Tabla `songs` con columnas `id`, `title`, `artist`, `genre`, `url`, `duration`. Índices en `genre` y `artist`.
- **WAL mode** activado para mejor concurrencia de lectura
- **Distribución**: pop domina (2,205), balada (453), banda (327), rock (250), ranchera (219), reggaeton (201), cumbia (187), electrónica (3)

### Endpoints de consulta

- `GET /api/songs?genres=pop,rock&artists=Shakira&exclude=id1,id2&random=true&limit=1` — Filtros dinámicos SQL
- `GET /api/artists?genres=pop` — Artistas distintos por género
- `GET /api/artist-map` — Mapa completo género→artistas (para mobile)

### Migración desde JSON

- **Origen**: `server/r2_db.json` (migrado via `scripts/migrate_to_sqlite.js`)
- **Script**: `node scripts/migrate_to_sqlite.js` — Lee JSON, crea tabla, inserta registros
- Los archivos JSON viejos (`r2_db.json`, `karaoke_db.json`) siguen en disco pero ya no se usan

---

## Almacenamiento

### En memoria (server)

- `rooms`: Map de salas activas (se pierde al reiniciar)
- `lastEventTime`: Map para rate limiting de sockets
- `urlReqCount`: Map para rate limiting de video URLs (30/min/IP)

### En disco (server)

- `server/songs.db`: SQLite con 3,845 canciones (persistente, WAL mode)

### En el cliente (TV)

- `localStorage.ritmika_game_state`: Estado del juego con TTL de 4 horas
  - Jugadores (nombre, avatar, puntaje, géneros, artistas, tomatazos)
  - Ronda actual, índice del cantante, cola de canciones, canciones asignadas

### En el cliente (Móvil)

- Sin persistencia. Todo se pierde al recargar.

---

## Seguridad

- **CORS**: Solo orígenes locales (localhost, IPs privadas, `*.local`, `*.onrender.com`)
- **Rate limiting**: Cooldowns por evento en sockets (2s/500ms/3s), 30 req/min en video URLs
- **Sanitización**: Nombres truncados (15 chars), sin HTML, avatar clamp (0-7), scores válidos (10/30/60/100)
- **Sin auth**: No hay login/contraseña. La sala es la única barrera.
- **Sin secrets en frontend**: Variables sensibles (R2 keys, ElevenLabs) solo en el server o `.env`

---

## Render.com (deploy en la nube)

- El servidor soporta deploy en Render.com
- Detección automática via `RENDER_EXTERNAL_URL`
- Origin whitelist incluye `*.onrender.com`
- Sin hotspot WiFi (jugadores necesitan internet)
- Sin pantalla nativa (TV se ve desde navegador)

---

## Decisiones de arquitectura

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Server sin lógica de juego | Server con state machine | Simplifica debugging, Frontend evoluciona solo |
| WebView2 en vez de Chrome kiosk | Puppeteer/Playwright | WebView2 ya está en Windows, sin dependencia externa |
| QR locales con npm qrcode | Google Charts API | Funciona offline, sin rate limits externos |
| Frontend monolítico (tv.html) | SPA con bundler | Sin build step, fácil de editar, offline total |
| Tailwind local (no CDN) | CDN de Tailwind | Modo offline, sin dependencia de internet |
| ElevenLabs para voces | TTS local | Calidad mucho superior, frases naturales |
| Cloudflare R2 para video | Google Drive directo | Mejor rendimiento, presigned URLs, sin CORS |
| WebP para assets | PNG | Menor tamaño, transparencia RGBA, mejor para web |
