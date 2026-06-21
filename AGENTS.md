# Rítmika — Project Context

Karaoke party game estilo Jackbox. Servidor en la nube (Render), los jugadores se conectan desde cualquier lugar con internet. Sin hotspot local, sin WiFi de PC.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Servidor | Node.js + Express + Socket.io + better-sqlite3 + qrcode + compression (puerto 3000) |
| TV (pantalla grande) | HTML/JS vanilla + Tailwind + Anime.js + GSAP + SVG, ~5600 líneas en `public/tv.html` |
| Control móvil | HTML/JS vanilla + Tailwind, ~1960 líneas en `public/mobile.html` |
| Base de datos | SQLite (`better-sqlite3`, ~0.5MB, 3,845 canciones en `server/songs.db`) |
| Launcher nativo | C# WinForms (.NET Framework 4.x), compilado con csc.exe (sin dependencias externas) |
| Ventana de juego | WebView2 (Edge runtime incluido en Windows 10/11) |
| Build | `build.bat` — genera icono, descarga WebView2, compila C#, copia DLLs |
| Audio | winmm.dll (MCI) via P/Invoke — MP3 con alias `ritmika_bgm` |
| Video storage | Cloudflare R2 (presigned URLs via AWS SDK) |
| Assets | WebP (avatares, vignettes Axolo), MP3 (392 archivos de audio) |

---

## Archivos clave

### Servidor
- `server/index.js` — ~800 líneas. Express + Socket.io + SQLite. Pasarela de eventos JSON entre TV y celulares + endpoints de datos con filtros dinámicos. Compresión gzip. QR con `qrcode` (npm). Presigned URLs de Cloudflare R2 para video. Endpoints: `/`, `/join`, `/qr-game`, `/qr-wifi`, `/api/network-config`, `/api/songs`, `/api/artists`, `/api/artist-map`, `/api/audio-files`, `/api/health`, `/api/video-url`, `/api/game-modes`.
- `server/songs.db` — Base de datos SQLite con 3,845 canciones (generada desde `r2_db.json` via `scripts/migrate_to_sqlite.js`). Columnas: `id`, `title`, `artist`, `genre`, `url`, `duration`. Índices en genre y artist.
- `server/game_modes_config.json` — Configuración de 7 modos de juego estructurados con filtros de género.
- `server/deezer_audit.json` — Auditoría de la API de Deezer para resolución de géneros de artistas.

### Frontend
- `public/tv.html` — ~5600 líneas. Pantalla grande. Toda la lógica del juego: pantalla pre-boot, bootloader de 5 pasos, selección de modo, ruleta SVG, karaoke con video player, votación, podio de 5 fases, QR dinámico, persistencia localStorage, sistema de voces Axolo con cut-in (estilo Persona/RFG). Debug panel (Ctrl+Shift+D). Audio preloader. SFX ducking. **Ya no almacena el catálogo completo** — `pickSongForPlayer()` hace consultas server-side con filtros.
- `public/mobile.html` — ~1960 líneas. Control táctil. 8 pantallas: join, avatar, géneros, artistas, sala de espera, panel de control, asignación R2, podio. Service Worker PWA. Haptic feedback. Fullscreen automático. Deep-linking con `?code=`. Catálogo de artistas vía `/api/artist-map`.
- `public/js/animations.js` — 314 líneas. UISounds (Web Audio API synthesizer: click, tick, chime, whoosh, reveal, stinger) + RitmikaStyleFX (confetti, screen-shake, pop-in, stagger, glowPulse, axoloNod, bigReveal, flashBang, counter).
- `public/assets/audio/` — 392 archivos MP3. Voces Axolo por género (20×9 géneros = 180 barks), reacciones de voto (15×4 tiers = 60), intros (20), premios (16), eventos (lobby, round, blackout, roulette, sabotage, idle, podium, modes, SFX).
- `public/assets/avatars/` — 8 WebP de avatares con transparencia alfa real (generados con IA + floodfill, convertidos de PNG a WebP).
- `public/assets/tio_axolo_vignette_<emocion>.webp` — Assets de la mascota en modo RGBA con transparencia real. 6 emociones: `neutral`, `laughing`, `mischievous`, `sad`, `angry`, `singing`. + `tio_axolo_body.webp` para pantalla de carga. + Variantes por modo: `axolo_anime.webp`, `axolo_emo.webp`, `axolo_ranchera.webp`, `axolo_nostalgia.webp`.
- `public/assets/` — También incluye: `logo_ritmika.webp`, fondos (`bg_neon_club.webp`, `bg_neon_y2k.webp`), decoraciones de lobby, assets de podio (`podium_bg_stadium.webp`, `podium_crown.webp`), assets de ruleta, `loading_bg.mp4`, iconos de modo, favicon, tomato assets (SVG + WebP), fuentes woff2 (Fredoka, Paytone One).
- `public/libs/` — Tailwind.js local + Anime.js local + GSAP local + QRCode.min.js (CDN evitado para rendimiento).

### Launcher Nativo (C#)
- `src/Launcher.cs` — 281 líneas. Arranca servidor Node.js, abre GameWindow directo (sin formulario previo). Limpia puerto 3000 antes de iniciar. Incluye `RButton` y `RPanel` custom controls (sin uso actual). Audio de inicio comentado (no reproduce nada al abrir).
- `src/GameWindow.cs` — 132 líneas. Ventana WebView2 fullscreen sin animación de carga (va directo al servidor). F11 toggle fullscreen. Polling al servidor cada 500ms. Flags de GPU y video acelerado.

### Build
- `build.bat` — 62 líneas. Un solo paso: icono → dependencias → compilar → copiar DLLs.
- `scripts/migrate_to_sqlite.js` — Lee `r2_db.json` y genera `server/songs.db` con schema SQLite.
- `scripts/generate_icon.ps1` — Crea `ritmika.ico` desde `tio_axolo_body.webp`.
- `scripts/download_deps.ps1` — Descarga WebView2 SDK de NuGet, extrae DLLs.
- `scripts/generate_all_audio.js` — Genera voces con ElevenLabs API. Lee API key de `.env`. 172+ frases definidas. Soporta skip si el MP3 ya existe.
- `scripts/generate_podium_audio.js` — Genera audio de ceremonia de podio con ElevenLabs.
- `scripts/generate_podium_extra.js` — Audio extra de podio.
- `scripts/build_r2_db.py` — Construye la base de datos de Cloudflare R2 (genera r2_db.json).
- `scripts/crawl_drive.py` — Crawler de carpetas de Google Drive para archivos de karaoke.
- `scripts/convert_assets.py` — Convierte assets de imagen (PNG → WebP).
- `scripts/process_green.py` — Procesa assets de fondo verde con floodfill para transparencia.
- `scripts/fix_axolo_transparency.py` — Corrige transparencia de vignettes Axolo.
- `scripts/fix_stars_transparency.py` — Corrige transparencia de assets de estrellas.
- `scripts/gen_lobby_deco.py` — Genera decoraciones de lobby.
- `scripts/generate_tomato_asset.py` — Genera assets de tomate (proyectil + salpicadura).
- `scripts/optimize_logo.py` — Optimiza/comprime imágenes de logo.
- `scripts/download_fonts.py` — Descarga/customiza fuentes web.
- `scripts/check_api.py` — Verifica conectividad/configuración de API.
- `scripts/add_audio.py` — Script para agregar assets de audio.

### Scripts de fix en raíz (15+ archivos)
- `fix_checkall.js`, `fix_conexion.cmd`, `fix_deleted_code.py`, `fix_dupes.js`, `fix_final.js`, `fix_leftover.py`, `fix_leftover_final.py`, `fix_mangled.py`, `fix_paths.js`, `fix_podium_css.py`, `fix_podium_html.py`, `fix_transition_and_keys.py`, `fix_transition_and_keys2.py`, `fix_tv.py`, `fix_video_visibility.py`
- `apply_brutalism.py`, `apply_brutalism2.py` — Aplican estilo neo-brutalismo al TV HTML.
- `check_audio.js`, `fix2.js`, `fix3.js`, `patch_tv.js`, `replace.js` — Scripts de mantenimiento varios.

### Config
- `.env` — `PORT=3000`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`
- `.gitignore` — Excluye `.env`, EXEs, DLLs de WebView2, `libs/webview2/`, `songs.db`, `*.log`

---

## Arquitectura del juego

```
Servidor en la nube (Render)
  └── Node.js :3000

PC (TV)
  ├── Ritmika.exe (C# WinForms → GameWindow WebView2)
  │     ├── Abre GameWindow directo
  │     └── Inicia servidor Node.js, mata proceso previo en puerto 3000
  └── WebView2 carga http://localhost:3000

Celulares desde cualquier lugar
  └── http://<url-publica>:3000/join
```

### Flujo
1. Servidor Node.js arranca (local en la PC o en Render)
2. GameWindow (WebView2) carga `http://localhost:3000` directo (sin pantalla de carga)
3. La TV muestra pantalla pre-boot → bootloader de 5 pasos → selección de modo
4. Se crea la sala → QR o link de invitación para compartir
5. Celulares abren `http://<IP>:3000/join` (por WiFi local o por internet público)
6. Tío Axolo (host) guía el juego: 3 rondas → podio de 5 fases

### Modos de juego (5, solo Clásico funciona)
- **Clásico** — Modo estándar con todos los géneros
- **Fiesta Anime** — PRÓXIMAMENTE
- **Fiesta Emo** — PRÓXIMAMENTE
- **Dolidas & Rancheras** — PRÓXIMAMENTE
- **Nostalgia Pop** — PRÓXIMAMENTE

### Rondas
- **Ronda 1 — "Tu Elección, Tu Condena"** — Ruleta, cada quien canta una canción de su preferencia + reto al 50%
- **Ronda 2 — "Fuego Cruzado"** — Los jugadores asignan canciones a otros, la asignada reemplaza la preferencia
- **Ronda 3 — "Apagón Mental"** — Igual que R1 pero con blackout de video/letras al 40%
- **Podio** — Ceremonia de 5 fases: título → premios especiales → 3ro/2do → ganador épico → podio final

### Géneros musicales (8 en frontend)
- Frontend (tv.html + mobile.html): reggaeton, banda, ranchera, rock, pop, cumbia, balada, **electronica**
- SQLite: 3,845 canciones (pop domina con 2,205, electrónica solo 3)
- Si un jugador selecciona "electronica", el backend puede tener muy pocas canciones

---

## Decisiones importantes

### Git — Commit y Push Automáticos
- **Repositorio remoto**: `https://github.com/ChronosBVRX/Ritmika.git` (origin/main)
- **Regla OBLIGATORIA**: Después de CADA cambio en el código, el agente DEBE hacer commit y push al remoto automáticamente, sin esperar a que el usuario lo pida.
- **Flujo de commit**:
  1. `git add -A`
  2. `git commit -m "mensaje descriptivo"` (explicar QUÉ y POR QUÉ)
  3. `git push`
- **Versionado**: Si se solicita incrementar la versión, usar `npm version patch|minor|major` — esto actualiza `package.json` y crea un tag en Git automáticamente.
- **UI**: La versión del `package.json` se emite a los clientes vía `socket.emit('server_version', ...)`. `tv.html` y `mobile.html` la muestran en `div#version-display`.

### Sin launcher panel — directo a GameWindow
- `Ritmika.exe` abre directo GameWindow (WebView2), sin formulario previo.
- El launcher C# solo inicia servidor y abre la ventana. Audio de inicio comentado.
- `RButton` y `RPanel` aún existen en `Launcher.cs` pero sin uso.

### WebView2 en vez de Chrome kiosk
- WebView2 es parte de Windows 10/11 (Edge runtime).
- F11 toggle fullscreen. Flags de GPU y video acelerado.
- Requiere DLLs: `WebView2Loader.dll`, `Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll` (auto-download por build.bat).

### QR codes locales con qrcode (npm)
- Endpoints: `GET /qr-game` y `GET /qr-wifi` generan QR con `qrcode` (npm).
- 400×400px, visibles desde lejos.

### Cloudflare R2 (Video Storage)
- Videos alojados en Cloudflare R2 (bucket `ritmika`, endpoint `media.pixelhub.party`).
- El servidor genera presigned URLs con expiración de 30 minutos vía AWS SDK.
- TV llama a `GET /api/video-url?id=<songId>` para obtener URL firmada.
- Fallback a URL pública si R2 no está configurado.
- Base de datos de canciones: SQLite (`server/songs.db`, 3,845 canciones).

### SQLite — Base de Datos de Canciones
- **Driver**: `better-sqlite3` (síncrono, nativo, rápido).
- **Schema**: Tabla `songs` con columnas `id`, `title`, `artist`, `genre`, `url`, `duration`. Índices en `genre` y `artist`.
- **Origen**: Migrada desde `r2_db.json` (~1MB JSON) a `songs.db` (~0.5MB SQLite).
- **Endpoints**:
  - `GET /api/songs?id=X` — canción individual por ID
  - `GET /api/songs?genres=pop,rock&artists=Shakira&exclude=id1,id2&random=true&limit=1` — filtro dinámico con ORDER BY RANDOM()
  - `GET /api/artists?genres=pop` — artistas distintos por género
  - `GET /api/artist-map` — todos los artistas agrupados por género (para mobile)
- **TV**: `pickSongForPlayer()` ahora es async, hace 3 intentos server-side (artista → género → fallback random), pasa `songQueue` como `exclude`. Ya no almacena el catálogo completo en `window.catalogoKaraoke`.
- **Ronda 2**: Pool de canciones se obtiene de `/api/songs?genres=...&limit=60` en vez de filtrar el catálogo completo client-side.

### Controles custom (RButton, RPanel) — sin uso actual
- `RButton` hereda `Control`, dibuja rectángulo redondeado con `GraphicsPath`.
- Efecto hover: suma 20 a cada componente RGB con `Math.Min(255, ...)`.
- `RPanel` hereda `Panel`, dibuja fondo redondeado. No llama `base.OnPaint(e)`.

### Persistencia en TV
- `localStorage` guarda: `ritmika_game_state` (players, scores, round, songs, currentSingerIdx, songQueue, assignedSongs).
- TTL: 4 horas. Auto-guarda en: joins, leaves, cambios de ronda, votación, fin de canción.
- Restore banner al recargar: pregunta si restaurar, mergea por nombre.

### Rate limiting (server)
- Tomatazo: 2s por socket
- Emoji: 500ms
- Sabotaje: 3s
- Video URLs: 30 requests/IP/minuto
- Cleanup en disconnect.

### Scores por voto
- Solo 10, 30, 60, 100. Valores inválidos → clamped a 10.

### Compresión y caching
- Compresión gzip activa en todas las respuestas HTTP (`compression` npm).
- HTML: `no-store, no-cache, must-revalidate, private`.
- Assets estáticos: `public, max-age=31536000, immutable` (1 año).

### Audio
- `AudioPlayer` clase estática en Launcher.cs: P/Invoke a `winmm.dll` (`mciSendString`). Alias: `ritmika_bgm`.
- `PlayOnce()` abre y reproduce una vez. `PlayLoop()` añade "repeat". `Stop()` detiene y cierra.
- **Audio de inicio desactivado**: `new_game.mp3` está comentado en el código.
- **`menu_music.mp3` SÍ existe** en `public/assets/audio/`.

### Sistema de voces Axolo (tv.html)
- `axoloSay(text, moodOrDuration)` → función principal. Reproduce audio MP3 y muestra cut-in.
- `hacerHablarAlAxolo(texto, audioFile)` → normaliza `.wav` a `.mp3` en runtime. Todos los archivos reales son MP3.
- `AXOLO_PRESET_MAP` → mapea archivo de audio a emoción del retrato (talking, mischievous, laughing, angry). Sad y singing manejados en el cut-in handler.
- `GENRE_BARKS` → 9 géneros × 20 frases cada uno = 180 barks totales.
- SFX ducking: el volumen de todos los SFX baja cuando Axolo habla (`duckSfx()`/`unduckSfx()`).

### Avatares de jugadores (`public/assets/avatars/`)
- 8 WebP con transparencia alfa real generados con IA (estilo 3D cartoon/mascota de fiesta).
- Procesados con floodfill desde las 4 esquinas (Pillow Python), luego convertidos de PNG a WebP.
- Nombres: `avatar_0_taco_rockero.webp` … `avatar_7_pulpo_salsero.webp`.
- Catálogo de avatares (id → emoji, label, color):
  - 0: 🌮 Taco Rockero — `#f97316`
  - 1: 🌶️ Chile Enmascarado — `#ef4444`
  - 2: 🍹 Tequila Fiestero — `#a855f7`
  - 3: ⭐ Estrella de Rock — `#facc15`
  - 4: 🦜 Loro Cumbiambero — `#22c55e`
  - 5: 🎸 Guitarra Mágica — `#3b82f6`
  - 6: 👑 Rey del Palenque — `#ec4899`
  - 7: 🐙 Pulpo Salsero — `#06b6d4`

### Tío Axolo — Character Cut-in System (Estilo Persona / RPG)
- **Modo Oculto por Defecto**: Tío Axolo no se visualiza de forma permanente. Su retrato y cuadro de diálogo se disparan dinámicamente al hablar.
- **Activos de Expresión WebP**: Archivos de imagen transparente por contexto (`tio_axolo_vignette_<mood>.webp`): `neutral`, `laughing`, `mischievous`, `sad`, `angry`, `singing`. + Variantes por modo de juego.
- **6 emociones** con colores: talking (yellow `#ffe600`), mischievous (purple `#9b00ff`), laughing (magenta `#f0047f`), angry (red `#ef4444`), sad (slate `#1e293b`), singing (cyan `#22d3ee`).

#### Estructura HTML del Cut-in:
```html
<div id="axolo-cutin-overlay" class="pointer-events-none">
  <div id="axolo-cutin-bar">
    <div id="axolo-cutin-portrait-wrap">
      <img id="axolo-cutin-portrait" src="/assets/tio_axolo_vignette_neutral.webp" />
    </div>
    <div id="axolo-cutin-textbox">
      <div id="axolo-cutin-text">...</div>
    </div>
  </div>
</div>
```

#### CSS clave de la franja inclinada (Skewed & Un-skewed):
- La franja diagonal `#axolo-cutin-bar` aplica una inclinación de `-12deg` (`transform: skewX(-12deg)`).
- El retrato y la caja de texto aplican `skewX(12deg)` para contrarrestar.
- Entrada elástica con `filter: blur(10px)` a `blur(0)`.

#### Efecto de Sonido Sintetizado ("Swoosh"):
- Web Audio API en `playSwooshSound()`. Barrido de sierra de 80Hz a 1400Hz con filtro paso bajo.

### Estilo visual — Neo-Brutalismo (Jackbox-style)
- Paneles con `border: 4px solid #111827; box-shadow: N px N px 0px #111827`.
- Tipografía: `Paytone One` (títulos) y `Fredoka` (instrucciones).
- Colores: fondo `#0f172a`, acento `#ffe600` (amarillo), `#00e5ff` (cian), `#f0047f` (magenta), `#ec4899` (rosa).

### Pantalla Pre-boot y Bootloader (tv.html)
- **Pre-boot**: Splash con imagen de Axolo y botón "Entrar a Ritmika" que desbloquea el AudioContext del navegador.
- **Bootloader**: Secuencia de 5 pasos: 1) Conectar al servidor, 2) Crear sala, 3) Verificar catálogo (vía `/api/health`), 4) Verificar FFmpeg, 5) Optimizar motor de juego. Incluye retry button y done banner.

### Audio Preloader (tv.html)
- Durante el boot, pre-descarga todos los MP3s de `public/assets/audio/` vía `/api/audio-files`.
- Max 6 descargas concurrentes. Evita buffers durante el juego.

### Debug Panel (tv.html)
- Ctrl+Shift+D activa un overlay con info de debug: estado de video, código de sala, etc.

### Service Worker (mobile.html)
- Registra `/service-worker.js` para soporte PWA.
- Deep-linking: `?code=ABCD` pre-llena el código de sala.

### Haptic Feedback (mobile.html)
- `navigator.vibrate()` en: tomatazo (`[50,30,80,30,50]`), tomatazo rechazado (`[100,50,100]`), voto (`40ms`), sabotaje (`[30,20,80]`).

---

## Build & Deploy

### Requisitos
- Windows 10/11
- .NET Framework 4.6.2+ (csc.exe en `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\`)
- Node.js + npm (para servidor y dependencias)
- Python 3 + Pillow (para procesado de assets de imagen)

### Compilar
```bat
build.bat
```
Pasos:
1. Verifica dependencias
2. Genera `ritmika.ico` desde `tio_axolo_body.webp`
3. Busca csc.exe
4. Compila `src/Launcher.cs` + `src/GameWindow.cs` → `Ritmika.exe`
5. Copia `WebView2Loader.dll` y `Microsoft.Web.WebView2.*.dll` junto al EXE

### Migración de Base de Datos
```bash
node scripts/migrate_to_sqlite.js   # Genera server/songs.db desde r2_db.json
```

### Resultado
- `Ritmika.exe` (~24KB) + DLLs de WebView2 (~2MB total)

---

## Bugs conocidos / Gotchas

1. **RButton hover crash (fixed)** — `Color.FromArgb(bg.R + 20, ...)` se desborda si el color base tiene componentes > 235. Usar `Math.Min(255, ...)`. Bug ya corregido en `Launcher.cs:168-171`.
2. **Rounded panel children painting** — `RPanel.OnPaint` no llama `base.OnPaint(e)`. Si algún control hijo no se renderiza, agregar `base.OnPaint(e)`.
3. **MP3 decoding** — MCI puede fallar con ciertos MP3. Si no suena, probar con WAV o instalar codec.
4. **WebView2 no disponible** — En Windows 10 sin Edge/WebView2 runtime, GameWindow falla. Windows Update lo instala.
5. **Multi-monitor** — `Screen.PrimaryScreen.Bounds` puede no ser el monitor deseado.
6. **Inclinación de Franjas (Skew & Un-skew)** — Aplicar sesgo inverso (`skewX(12deg)`) en capas internas.
7. **Sintetizador Web Audio API** — Osciladores nativos con rampas de ganancia y frecuencia exponenciales para efectos offline.
8. **tio_axolo_vignette_*.webp deben ser RGBA** — Generadas con IA sobre verde plano, procesadas con Pillow floodfill.
9. **Origen de rotación SVG (transform-origin)** — Usar valores absolutos en px (ej: `250px 250px`), nunca `center`.
10. **Colapso de altura en video por Tailwind Preflight** — Forzar dimensiones en contenedor `.tv-screen` y `position: absolute` en `<video>`.
11. **Electrónica sin canciones en DB** — SQLite tiene solo 3 canciones de electrónica de 3,845. Fallback a otros géneros.
12. **Podio no se veía (fixed)** — Eliminar `#podium-screen` antiguo del DOM y recrear elemento nuevo con CSS inline.
13. **Entidades HTML (`textContent` vs `innerHTML`)** — Usar `.innerHTML` al inyectar entidades como `&#127942;`.
14. **Assets de Premiación Premium** — Procesados con floodfill para transparencia perfecta.
15. **Audio de inicio desactivado** — `new_game.mp3` está comentado en Launcher.cs. No suena nada al abrir.
16. **Formato de assets: PNG → WebP** — Todos los avatares y vignettes Axolo fueron convertidos de PNG a WebP.
17. **DB principal: SQLite** — El servidor carga `songs.db` (ya no `r2_db.json`). URLs apuntan a `media.pixelhub.party` (Cloudflare R2).
18. **Referencias `.wav` en GENRE_BARKS pero archivos `.mp3`** — Funciona gracias a normalización en runtime, pero es frágil.
19. **Video black screen en WebView2** — El compositor de Chromium a veces no detecta la fuente de video. Fix: asignar `video.src` antes del double `requestAnimationFrame`.
20. **Ronda 2 — Asignaciones lentas** — El spin button se oculta hasta que todos asignan o pasan 30s. Si un jugador no responde, la rueda gira igual.

---

## Próximos pasos sugeridos

- [x] Integrar avatares como imágenes reales en player cards, ruleta y móvil
- [x] Launcher detecta si Node.js está instalado
- [x] `menu_music.mp3` — Ahora SÍ existe
- [x] Premiación Premium inmersiva
- [x] Limpiar scripts legacy
- [x] Filtro dinámico en Ronda 2 (Fuego Cruzado)
- [x] Convertir assets de PNG a WebP
- [x] Integrar Cloudflare R2 para video
- [x] Migrar DB de JSON a SQLite (better-sqlite3)
- [x] Eliminar almacenamiento de catálogo completo en TV (server-side filtering)
- [ ] **Flujo del juego roto** — Investigar por qué después de la ruleta no empiezan los videos
- [ ] **Activar audio de inicio** — `new_game.mp3` está comentado, decidir si reactivar
- [ ] **Probar restore banner en TV** (recargar en medio del juego)
- [ ] **Probar Ronda 2 (Fuego Cruzado)** completa
- [ ] **Probar con 4+ jugadores simultáneos**
- [ ] Implementar modos de juego (Anime, Emo, Ranchera, Nostalgia)

---

## Estado actual (resumen ejecutivo)

| Componente | Estado | Notas |
|-----------|--------|-------|
| Server | **COMPLETO** | ~800 líneas, Express + Socket.io + SQLite, R2 presigned URLs, endpoints filtrados |
| TV Frontend | **COMPLETO** | ~5600 líneas, server-side song selection, sin catálogo en memoria |
| Mobile Frontend | **COMPLETO** | ~1960 líneas, artist map via API, 8 pantallas, PWA, haptic |
| Launcher C# | **COMPLETO** | 281 líneas, bug de RButton corregido, audio desactivado |
| GameWindow | **COMPLETO** | 132 líneas, WebView2, sin animación de carga |
| Build System | **COMPLETO** | EXE compilado y funcional, DLLs presentes |
| Audio Assets | **COMPLETO** | 392 MP3s (180 genre barks + 60 vote reactions + 152 outros) |
| Avatar Assets | **COMPLETO** | 8 WebP presentes |
| Axolo Assets | **COMPLETO** | 6 vignettes WebP + body + variantes por modo |
| Karaoke DB | **COMPLETO** | 3,845 canciones en SQLite (songs.db), endpoints filtrados |
| menu_music.mp3 | **EXISTE** | Archivo presente en public/assets/audio/ |
| Audio de inicio | **DESACTIVADO** | new_game.mp3 comentado en Launcher.cs |

---

## Convenciones de código
- Server: `server/index.js` — CommonJS (require), sin TypeScript
- TV/Mobile: HTML vanilla, sin frameworks. Tailwind + Anime.js + GSAP para animaciones.
- C#: .NET Framework 4.x, WinForms, sin librerías externas.
- Sin comentarios en código a menos que sea necesario.
- `camelCase` en JS, `PascalCase` en C#.

---

## Guía de Estética, Diseño y Animaciones (Estándar: Persona 5)

### 1. Sistema de Diálogos y Cut-ins
- **Estilo Inclinado (Skew)**: Usar `skewX(-12deg)` en contenedores, `skewX(12deg)` en contenido interno.
- **Movimiento y Velocidad**: Entradas/salidas rápidas con `filter: blur(10px)` a `blur(0)`.
- **Sonido Sincronizado**: Swoosh sintetizado con Web Audio API.

### 2. Estilo Visual: Jackbox + Persona 5
- **Paleta**: Fondo oscuro (`#0f172a`) + bloques vibrantes: `#ffe600`, `#00e5ff`, `#f0047f`, `#ec4899`.
- **Tipografía**: `Paytone One` (títulos), `Fredoka` (instrucciones).
- **Neo-Brutalismo**: `border: 4px solid #111827; box-shadow: 7px 7px 0px #111827`.

### 3. Microinteracciones (Anime.js + GSAP)
- **Pop-ins**: Rebotes elásticos con `elasticity`. `stagger` para apariciones en cadena.
- **Eventos**: `screen-shake`, `glowPulse`, confetti bursts.
- **Feedback**: Botones móviles con translate al hacer tap.

### 4. Manejo de Assets
- **Transparencia RGBA**: Floodfill desde esquinas, formato WebP final.
- **SVG**: Usar `<image>` con `transform-origin` en px absolutos.

### 5. Pipeline de Generación de Imágenes (IA + Transparencia)
- Prompt: "sobre un fondo verde plano y sólido"
- Estilo: 3D cartoon / mascota de fiesta
- Procesamiento: Pillow floodfill desde esquinas
- Formato final: `.webp` (convertido desde PNG RGBA)

### REGLA ESTRICTA DE EDICIÓN EN tv.html
**NUNCA** usar herramientas de reemplazo difuso (fuzzy replace) en `public/tv.html` para bloques de código que contengan llaves repetitivas, arrays o listeners genéricos. **SOLUCIÓN OBLIGATORIA**: Usar scripts de Node.js (`node -e`) con expresiones regulares seguras o `indexOf`/`splice` basado en líneas precisas. Verificar sintaxis después de cada edición.
