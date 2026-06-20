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

**Stack**: Node.js + Express + Socket.io + compression + qrcode

**Responsabilidades**:
- Servir archivos estáticos de `public/`
- Generar QR codes (WiFi y juego)
- Detectar IP local para QR
- Relay de eventos Socket.io entre TV y celulares
- Rate limiting por socket
- Proxy de video a Cloudflare R2 (presigned URLs)
- Gestión de salas (crear, unir, cerrar)

**No hace**:
- No valida reglas de juego
- No guarda puntajes
- No controla el flujo de rondas
- No tiene base de datos persistente

**Endpoints REST**: Ver [API.md](API.md)

### 2. TV Frontend (`public/tv.html`)

**Stack**: HTML5 + Vanilla JS + Anime.js + Tailwind CSS + SVG

**Toda la lógica del juego**:
- Estado del juego (jugadores, rondas, puntajes, turno actual)
- Ruleta SVG con avatares PNG
- Video player de karaoke
- Sistema de votación y scoring
- Cut-ins del Tío Axolo (6 emociones)
- Premiación con ceremonia de 5 fases
- Persistencia localStorage (TTL 4h)

**Tamaño**: ~4000+ líneas, monolito autocontenido.

### 3. Mobile Frontend (`public/mobile.html`)

**Stack**: HTML5 + Vanilla JS

**8 pantallas**:
1. Join (ingresar código de sala)
2. Panel de control
3. Selección de géneros
4. Selección de artistas
5. Reacciones (emoji, tomatazo)
6. Asignación de canciones (Ronda 2)
7. Votación
8. Podio

### 4. Launcher Nativo (`src/`)

**Stack**: C# WinForms (.NET Framework 4.x)

- `Launcher.cs`: Inicia el servidor Node.js, reproduce audio de inicio, abre GameWindow
- `GameWindow.cs`: Ventana WebView2 fullscreen con animación de carga
- Audio via P/Invoke a `winmm.dll` (MCI API)

---

## Flujo de conexión

```
1. Ritmika.exe se abre
   └─► Launcher.cs inicia Node.js (server/index.js)
   └─► Abre GameWindow (WebView2) → carga http://localhost:3000

2. TV crea sala
   └─► Socket: tv:create_room
   └─► Server genera código de 4 chars
   └─► Responde con: roomCode, localIP, hotspotSSID, hotspotPassword
   └─► TV muestra QR de WiFi + QR de juego + código

3. Jugador escanea QR WiFi → se conecta a la red

4. Jugador escanea QR juego → abre http://<IP>:3000/join

5. Jugador entra código + nombre + avatar
   └─► Socket: player:join
   └─► Server agrega a la sala, notifica a la TV
   └─► TV muestra al jugador en el lobby

6. Repetir 3-5 para cada jugador

7. Host inicia juego
   └─► Socket: tv:start_game → game:started a todos
```

---

## Flujo de datos durante el juego

### Broadcast general

```
TV ──tv:broadcast──► Server ──game:update──► Todos los jugadores
```

La TV envía actualizaciones de estado (nueva ronda, resultado de ruleta, etc.) que el server reenvía a todos los celulares.

### Mensaje privado

```
TV ──tv:send_to_player(targetSocketId)──► Server ──game:private──► Jugador específico
```

Usado para enviar la canción asignada al cantante de turno.

### Evento de jugador → TV

```
Celular ──player:vote──► Server ──tv:vote──► TV
```

Cada acción del celular (voto, tomatazo, emoji) pasa por el server y llega a la TV.

---

## Protocolo de comunicación

Todos los eventos son objetos JSON. El servidor funciona como un bus de eventos:

```javascript
// TV emite
socket.emit('tv:broadcast', {
  roomCode: 'ABCD',
  event: 'SINGER_SELECTED',
  data: { player: {...}, song: {...} }
});

// Server reenvía a todos en la sala
io.to(roomCode).emit('game:update', {
  event: 'SINGER_SELECTED',
  data: { player: {...}, song: {...} }
});

// Celular recibe
socket.on('game:update', (payload) => {
  if (payload.event === 'SINGER_SELECTED') { ... }
});
```

---

## Almacenamiento

### En memoria (server)

- `rooms`: Map de salas activas (se pierde al reiniciar)
- `songDatabase`: Array de canciones cargado de `server/r2_db.json`
- `lastEventTime`: Map para rate limiting
- `urlReqCount`: Map para rate limiting de video URLs

### En el cliente (TV)

- `localStorage.ritmika_game_state`: Estado del juego con TTL de 4 horas
  - Jugadores (nombre, avatar, puntaje, géneros, artistas, tomatazos)
  - Ronda actual, índice del cantante, cola de canciones
  - Canciones asignadas (Ronda 2)

### En el cliente (Móvil)

- Sin persistencia. Todo se pierde al recargar.

---

## Seguridad

- **CORS**: Solo orígenes locales (localhost, IPs privadas, *.local, *.onrender.com)
- **Rate limiting**: Cooldowns por evento en sockets, límite de requests en video URLs
- **Sanitización**: Nombres truncados, sin HTML, avatar clamp, scores válidos
- **Sin auth**: No hay login/contraseña. La sala es la única barrera.
- **Sin secrets en frontend**: Variables sensibles (R2 keys) solo en el server

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
