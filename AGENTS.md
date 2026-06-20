# Rítmika — Project Context

Karaoke party game estilo Jackbox. Una PC sirve como servidor + pantalla de TV, los invitados usan sus celulares como controles. Sin internet necesario durante el juego.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Servidor | Node.js + Express + Socket.io + qrcode (puerto 3000) |
| TV (pantalla grande) | HTML/JS vanilla, 3287 líneas en `public/tv.html` |
| Control móvil | HTML/JS vanilla, 1838 líneas en `public/mobile.html` |
| Launcher nativo | C# WinForms (.NET Framework 4.x), compilado con csc.exe (sin dependencias externas) |
| Ventana de juego | WebView2 (Edge runtime incluido en Windows 10/11) |
| Build | `build.bat` — genera icono, descarga WebView2, compila C#, copia DLLs |
| Audio | winmm.dll (MCI) via P/Invoke — MP3 con alias `mpegvideo` |

---

## Archivos clave

### Servidor
- `server/index.js` — 540 líneas. Express + Socket.io. Servidor "pasoarela pura" — solo enruta eventos JSON entre TV y celulares, cero lógica de juego. Maneja salas, votación, rate limiting. IP detectada con `os.networkInterfaces()`. QR locales con `qrcode` (npm). Proxy de video para Google Drive con soporte Range.

### Frontend
- `public/tv.html` — 3287 líneas. Pantalla grande. Toda la lógica del juego: ruleta SVG, karaoke con video player, votación, podio, QR dinámico, persistencia localStorage, sistema de voces Axolo con cut-in (estilo Persona/RFG). 8 géneros de barks (reggaeton, banda, ranchera, rock, pop, cumbia, balada, electronica) + default.
- `public/mobile.html` — 1838 líneas. Control táctil. 8 pantallas: join, panel control, selección géneros, selección artistas, reacciones, asignación (R2), votación, podio.
- `public/js/animations.js` — 275 líneas. UISounds (Web Audio API synthesizer) + RitmikaStyleFX (confetti, screen-shake, pop-in, stagger, glowPulse, axoloNod, bigReveal).
- `public/assets/audio/` — 172 archivos MP3. Voces Axolo por género (10×8 géneros + 10 default = 90), intros, votos, premios, eventos, idle.
- `public/assets/avatars/` — 8 PNGs de avatares con transparencia alfa real (generados con IA + floodfill).
- `public/assets/tio_axolo_vignette_<emocion>.png` — Assets de la mascota en modo RGBA con transparencia real. 6 emociones: `neutral`, `laughing`, `mischievous`, `sad`, `angry`, `singing`. + `tio_axolo_body.png` para pantalla de carga.
- `public/libs/` — Tailwind.js local + Anime.js local + QRCode.min.js (evita CDN para offline).

### Launcher Nativo (C#)
- `src/Launcher.cs` — 241 líneas. Arranca servidor Node.js, reproduce `new_game.mp3` al abrir, abre GameWindow directo (sin formulario previo). Limpia puerto 3000 antes de iniciar. Incluye `RButton` y `RPanel` custom controls (sin uso actual).
- `src/GameWindow.cs` — 282 líneas. Ventana WebView2 fullscreen con pantalla de carga animada (Axolo con glow, dots, pulso). F11 toggle fullscreen. Polling al servidor cada 500ms.

### Launcher PowerShell (legacy)
- `Ritmika.ps1` — 486 líneas. Launcher GUI alternativo con PowerShell WinForms. Tiene selector de modo WiFi/Túnel, QR con Google Charts, hotspot toggle, Chrome kiosk. **Este launcher NO es el activo** — `Ritmika.exe` usa el launcher C# directo a GameWindow.
- `Ritmika.bat` — Wrapper que ejecuta `Ritmika.ps1`.
- `jugar.bat` — 60 líneas. Script batch legacy que activa hotspot, inicia servidor, y abre Chrome kiosk. Alternativa sin GUI.

### Build
- `build.bat` — 62 líneas. Un solo paso: icono → dependencias → compilar → copiar DLLs.
- `scripts/generate_icon.ps1` — Crea `ritmika.ico` desde `tio_axolo_body.png`.
- `scripts/download_deps.ps1` — Descarga WebView2 SDK de NuGet, extrae DLLs.
- `scripts/hotspot.ps1` — 66 líneas. Activa el hotspot WiFi de Windows usando WinRT API (`NetworkOperatorTetheringManager`). Muestra instrucciones manuales si falla. **No es llamado automáticamente por Launcher.cs** — se usa desde `jugar.bat` o manualmente.
- `scripts/generate_all_audio.js` — 332 líneas. Genera voces con ElevenLabs API. Lee API key de `.env`. 172 frases definidas. Soporta skip si el MP3 ya existe.
- `scripts/fix_conexion.ps1` — Agrega regla de firewall para puerto 3000.
- `fix_conexion.cmd` — Wrapper batch para fix de conexión.

### Config
- `.env` — `PORT=3000`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `HOTSPOT_SSID=Ritmika`, `HOTSPOT_PASSWORD=Ritmika2026`
- `.gitignore` — Excluye `.env`, EXEs, DLLs de WebView2, `libs/webview2/`

---

## Arquitectura del juego

```
PC (servidor + TV)
  ├── Node.js :3000
  ├── Launcher.exe (C# WinForms → GameWindow WebView2)
  │     ├── Abre GameWindow directo (sin formulario previo)
  │     ├── Audio: new_game.mp3 (una vez al abrir)
  │     └── Inicia servidor Node.js, mata proceso previo en puerto 3000
  └── Hotspot WiFi "Ritmika" (activado manual o por jugar.bat)
        └── Celulares → http://<IP>:3000/join
```

### Flujo
1. `Ritmika.exe` se abre → servidor Node.js arranca, GameWindow abre fullscreen
2. GameWindow (WebView2) carga `http://localhost:3000` con animación de carga (Axolo con glow pulsante)
3. La TV muestra QR grandes del juego + instrucciones de conexión para que celulares escaneen
4. Celulares escanean QR WiFi → se conectan a la red → escanean QR juego → `http://<IP>:3000/join`
5. Tío Axolo (host) guía el juego: 3 rondas → podio final

### Rondas
- **Ronda 1** — Ruleta de géneros, cada quien canta una canción conocida
- **Ronda 2 (Fuego Cruzado)** — Canciones asignadas por el servidor, cantan las de otros
- **Ronda 3** — Mix / final
- **Podio** — Top 3 con animación

### Géneros musicales (8 en frontend, 7 en DB)
- Frontend (tv.html + mobile.html): reggaeton, banda, ranchera, rock, pop, cumbia, balada, **electronica**
- `karaoke_db.json`: reggaeton, banda, ranchera, rock, pop, cumbia, balada (**sin electronica** — 2820 canciones, 287 artistas)
- Si un jugador selecciona "electronica", el juego usa canciones de otros géneros o fallback

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

### Sin tunnel / online mode
- `localtunnel` instalado originalmente, se eliminó por completo.
- `jugar_online.bat` borrado.
- Código de tunnel purgado de server, TV y launcher C#.
- **Nota**: `Ritmika.ps1` (legacy) aún tiene código de tunnel (`$script:UseTunnel`, card "Por Internet"). No tiene efecto en el launcher activo.
- Conectividad vía WiFi hotspot de Windows.

### Sin launcher panel — directo a GameWindow
- `Ritmika.exe` abre directo GameWindow (WebView2), sin formulario previo.
- El launcher C# solo inicia servidor, reproduce audio y abre la ventana.
- `RButton` y `RPanel` aún existen en `Launcher.cs` pero sin uso. Mantenidos por si se reintroduce panel.

### WebView2 en vez de Chrome kiosk
- WebView2 es parte de Windows 10/11 (Edge runtime).
- Elimina dependencia de Chrome, ventana nativa.
- F11 toggle fullscreen.
- Requiere DLLs: `WebView2Loader.dll`, `Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll` (auto-download por build.bat).

### QR codes locales con qrcode (npm)
- Endpoints en el servidor: `GET /qr-game` y `GET /qr-wifi` generan QR con `qrcode` (npm).
- TV los carga directo como `<img src="/qr-game">`, sin Google Charts.
- 400×400px, visibles desde lejos.
- **Nota**: `Ritmika.ps1` (legacy) usa Google Charts API para QR — no aplica al launcher activo.

### Hotspot WiFi
- **No es activado automáticamente por el launcher C#**.
- Opciones para activarlo:
  1. `jugar.bat` → ejecuta `scripts/hotspot.ps1` antes de iniciar servidor
  2. Manual: Configuración → Red → Mobile Hotspot → SSID: Ritmika, Password: Ritmika2026
  3. `scripts/hotspot.ps1` directamente (requiere permisos Admin)
- `hotspot.ps1` usa WinRT API (`NetworkOperatorTetheringManager`) para activar el hotspot. Si falla, muestra instrucciones manuales.
- `fix_conexion.cmd` agrega regla de firewall para puerto 3000.

### Controles custom (RButton, RPanel) — sin uso actual
- `RButton` hereda `Control`, dibuja rectángulo redondeado con `GraphicsPath`.
- Efecto hover: suma 20 a cada componente RGB con `Math.Min(255, ...)` para evitar desborde.
- `RPanel` hereda `Panel`, dibuja fondo redondeado.
- **IMPORTANTE**: RPanel no llama `base.OnPaint(e)` — los controles hijos se pintan solos vía mensajes separados de WinForms, pero si algún control hijo no se pinta, revisar esto.

### Persistencia en TV
- `localStorage` guarda: `ritmika_game_state` (players, scores, round, songs, currentSingerIdx, songQueue, assignedSongs).
- TTL: 4 horas. Auto-guarda en: joins, leaves, cambios de ronda, votación, fin de canción.
- Restore banner al recargar: pregunta si restaurar, mergea por nombre.

### Rate limiting (server)
- Tomatazo: 2s por socket
- Emoji: 500ms
- Sabotaje: 3s
- Cleanup en disconnect.

### Scores por voto
- Solo 10, 30, 60, 100. Valores inválidos → clamped a 10.

### Audio
- `AudioPlayer` clase estática en Launcher.cs: P/Invoke a `winmm.dll` (`mciSendString`).
- `PlayOnce()` abre y reproduce una vez. `PlayLoop()` añade "repeat". `Stop()` detiene y cierra.
- MP3 requiere alias `mpegvideo` en MCI.
- Solo `new_game.mp3` se reproduce al launcher. **`menu_music.mp3` no existe** — feature no implementada.

### Sistema de voces Axolo (tv.html)
- `axoloSay(text, moodOrDuration)` → función principal. Reproduce audio MP3 y muestra cut-in.
- `hacerHablarAlAxolo(texto, audioFile)` → normaliza `.wav` a `.mp3` en runtime (línea 3126: `.replace(/\.(wav|mp3)$/i, '') + '.mp3'`). Todos los archivos reales son MP3.
- `AXOLO_PRESET_MAP` → mapea archivo de audio a emoción del retrato (neutral, laughing, mischievous, sad, angry, singing).
- `GENRE_BARKS` → 8 géneros × 10 frases cada uno. Referencian `.wav` pero se resuelven a `.mp3`.
- **Riesgo**: Si se modifica la línea 3126 de normalización, TODOS los audios Axolo romperían (404 en `.wav`).

### Avatares de jugadores (`public/assets/avatars/`)
- 8 PNGs con transparencia alfa real generados con IA (estilo 3D cartoon/mascota de fiesta).
- Procesados con floodfill desde las 4 esquinas (Pillow Python) para eliminar el fondo.
- Nombres: `avatar_0_taco_rockero.png` … `avatar_7_pulpo_salsero.png`.
- Los catálogos `AVATARS` en `tv.html` y `mobile.html` están vinculados a estas imágenes PNG transparentes mediante la propiedad `img`. Se utilizan de forma directa en la selección de avatar del móvil, tarjetas de jugadores, pips de la sala de espera y en las rebanadas de la ruleta en la pantalla de TV.
- Catálogo de avatares (id → emoji, label, color, border):
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
- **Activos de Expresión RGBA**: Posee archivos de imagen transparente independientes por contexto (`tio_axolo_vignette_<mood>.png`): `neutral`, `laughing` (risas), `mischievous` (pícaro), `sad` (triste/fallo), `angry` (enojo/sabotaje), `singing` (canto).

#### Estructura HTML del Cut-in:
```html
<div id="axolo-cutin-overlay" class="pointer-events-none">
  <div id="axolo-cutin-bar">
    <div id="axolo-cutin-portrait-wrap">
      <img id="axolo-cutin-portrait" src="/assets/tio_axolo_vignette_neutral.png" />
    </div>
    <div id="axolo-cutin-textbox">
      <div id="axolo-cutin-text">...</div>
    </div>
  </div>
</div>
```

#### CSS clave de la franja inclinada (Skewed & Un-skewed):
- La franja diagonal `#axolo-cutin-bar` aplica una inclinación de `-12deg` (`transform: skewX(-12deg)`).
- El retrato (`#axolo-cutin-portrait-wrap`) y la caja de texto (`#axolo-cutin-textbox`) aplican una inclinación inversa de `12deg` (`transform: skewX(12deg)`) para contrarrestar la deformación y mostrar el contenido perfectamente vertical y legible.
- Entrada elástica y desenfoque de velocidad: Se desliza velozmente mediante transiciones y aplica un desenfoque temporal (`filter: blur(10px)` a `blur(0)`) para simular movimiento rápido.

#### Efecto de Sonido Sintetizado ("Swoosh"):
- Implementado a través de la API de **Web Audio** del navegador en `playSwooshSound()`. Sintetiza de forma local un efecto "swoosh" limpio de barrido de frecuencia de sierra (de 80Hz a 1400Hz) modulado con un filtro de paso bajo, evitando descargas de assets adicionales. Sincronizado en la entrada y salida de la franja.

### Estilo visual — Neo-Brutalismo (Jackbox-style)
El lobby de TV usa un sistema visual de "sticker/Jackbox" consistente:
- Paneles con `border: 4px solid #111827; box-shadow: N px N px 0px #111827` (sombra sólida desplazada).
- Tipografía: `Paytone One` (títulos) y `Fredoka` (instrucciones). Importadas desde Google Fonts.
- Colores principales: fondo `#0f172a` (azul muy oscuro), acento `#ffe600` (amarillo), `#00e5ff` (cian), `#f0047f` (magenta), `#ec4899` (rosa Axolo).
- Textos de instrucciones: `font-weight:900`, `color:#111827` (negro), `font-family: Fredoka`.
- Elementos estilo sticker aplicados a:
  - Panel cian de conexión: `border:4px solid #111827; box-shadow:7px 7px 0px #111827`
  - Modal de restauración: `border:4px solid #111827; box-shadow:5px 5px 0px #111827`
  - Código de sala (letras): ya tenían este estilo.
  - Botón "¡Que empiece la fiesta!": ya tenía este estilo.

### Proxy de Video para Google Drive
- El servidor Node.js actúa como proxy de streaming (`/api/video-proxy?id=...`) para videos alojados en Google Drive.
- Bypassa las restricciones CORS y CORP (`cross-origin-resource-policy: same-site`) que el motor de WebView2/Chromium aplica de forma estricta para solicitudes de recursos externos de otros orígenes.
- Soporta peticiones parciales HTTP `Range`, canalizando las respuestas `206 Partial Content` y cabeceras de tamaño/rango desde Google Drive hacia el reproductor web para permitir buffering y rebobinado nativos.
- La TV traduce de forma transparente cualquier enlace de Google Drive detectado en la URL de las canciones al endpoint del proxy local.

### Ajustes y Estilo de la Ruleta (TV)
- **Modo 1 Jugador**: SVG no dibuja arcos de longitud cero cuando hay una sola porción en la rueda (la ruleta se renderizaba invisible/negra). Se solucionó forzando un elemento `<circle>` completo para la rueda, posicionando la imagen y texto de etiqueta, y limitando el giro final a múltiplos exactos de 360° para que termine derecho.
- **Avatares PNG en Rebanadas**: Las rebanadas de la ruleta usan etiquetas `<image>` SVG con los archivos de avatar transparentes locales (`av.img`) en lugar de emojis de texto.
- **Fondo de Rueda Negro**: Se incluyó un círculo de fondo opaco (`circle fill="#111827"`) directamente debajo del grupo para tapar filtraciones de transparencia y sostener los bordes gruesos de la rueda.

---

## Build & Deploy

### Requisitos
- Windows 10/11
- .NET Framework 4.6.2+ (csc.exe en `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\`)
- Node.js + npm (para servidor y dependencias)
- Internet solo primera vez (descarga WebView2 DLLs)
- Python 3 + Pillow (para procesado de assets de imagen)

### Compilar
```bat
build.bat
```
Pasos:
1. Verifica dependencias
2. Genera `ritmika.ico` desde `public/assets/tio_axolo_body.png`
3. Busca csc.exe
4. Compila `src/Launcher.cs` + `src/GameWindow.cs` → `Ritmika.exe`
5. Copia `WebView2Loader.dll` y `Microsoft.Web.WebView2.*.dll` junto al EXE

### Resultado
- `Ritmika.exe` (~24KB) + DLLs de WebView2 (~2MB total)
- Sin internet para jugar (WebView2 runtime ya está en Windows).

---

## Bugs conocidos / Gotchas

1. **RButton hover crash (fixed)** — `Color.FromArgb(bg.R + 20, ...)` se desborda si el color base tiene componentes > 235. Usar `Math.Min(255, ...)`. Bug ya corregido en `Launcher.cs:168-171`. `err.txt` es artefacto stale.
2. **Rounded panel children painting** — `RPanel.OnPaint` no llama `base.OnPaint(e)`. Si algún control hijo no se renderiza, agregar `base.OnPaint(e)`.
3. **MP3 decoding** — MCI puede fallar con ciertos MP3. Si no suena, probar con WAV o instalar codec.
4. **WebView2 no disponible** — En Windows 10 sin Edge/WebView2 runtime, GameWindow falla. Windows Update lo instala.
5. **Hotspot sin activación automática** — El launcher C# NO activa el hotspot. Hay que hacerlo manual o con `jugar.bat`/`hotspot.ps1`. Requiere permisos Admin.
6. **Hotspot sin DHCP/IPS** — Si los dispositivos no obtienen IP, puede ser driver del adaptador virtual.
7. **Multi-monitor** — `Screen.PrimaryScreen.Bounds` puede no ser el monitor deseado.
8. **Inclinación de Franjas (Skew & Un-skew)** — Al sesgar un contenedor en CSS (ej: `skewX(-12deg)`), todo su contenido también se deforma. Para mantener retratos y textos legibles y rectos dentro de la barra diagonal, se debe aplicar un sesgo inverso idéntico (`skewX(12deg)`) en las capas de envoltura internas.
9. **Sintetizador Web Audio API** — Para emitir efectos de sonido rápidos de interfaz (como swooshes o destellos) sin depender de archivos de audio adicionales y asegurar soporte offline robusto, se programan osciladores nativos con rampas de ganancia y frecuencia exponenciales (Web Audio Context).
10. **tio_axolo_vignette_*.png deben ser RGBA** — Todas las expresiones del presentador se generan con IA sobre verde plano y se convierten a transparencia RGBA mediante Pillow floodfill en local.
11. **Origen de rotación SVG (transform-origin)** — Por defecto, en gráficos vectoriales SVG, los grupos `<g>` rotan tomando como pivote la coordenada `(0,0)` (esquina superior izquierda del lienzo). Esto causaba que la ruleta orbitara de forma excéntrica perdiéndose fuera de la pantalla. Para rotar concéntricamente, debe especificarse `transform-origin` con valores absolutos en px (ej: `210px 210px`) en el CSS o inline en el tag `<g>`, evitando palabras clave relativas como `center` (que calculan la caja límite de forma impredecible según la geometría asimétrica de los elementos).
12. **Colapso de altura en video por Tailwind Preflight** — Tailwind reinicia el alto de las etiquetas `<video>` a `auto`. Si no hay metadata o el reproductor está vacío, esto colapsa la altura del reproductor a un tamaño mínimo (barra de controles). Se solucionó forzando dimensiones de `100vw`/`100vh` en el contenedor `.tv-screen` de la TV y aplicando `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1` sobre el elemento `<video>`.
13. **Referencias `.wav` en GENRE_BARKS pero archivos `.mp3`** — Todas las frases de `GENRE_BARKS` en tv.html referencian archivos `.wav`, pero los archivos reales en disco son `.mp3`. Funciona gracias a la normalización en runtime (`hacerHablarAlAxolo()` línea 3126), pero es frágil. Las frases de `AXOLO_SINGER_INTROS` y otras ya usan `.mp3` directamente.
14. **Electrónica sin canciones en DB** — El frontend soporta 8 géneros (incluyendo electronica), pero `karaoke_db.json` solo tiene 7 (sin electronica). Si un jugador elige electronica, el backend no tiene canciones de ese género para asignar en Ronda 2.
15. **Podio no se veía al final del juego** — El problema era que `showPodium()` modificaba el elemento `#podium-screen` existente en el DOM (cambiaba innerHTML, cssText, clases), pero el navegador no renderizaba los cambios aunque el computed style mostrara `display:flex; z-index:10001; opacity:1`. Solución: eliminar el `#podium-screen` antiguo del DOM (`parentNode.removeChild`) y crear un elemento `<div>` completamente nuevo con `id="podium-screen"`, sin la clase `tv-screen`, con todo el CSS inline. De esta forma se evitan conflictos de clases CSS y el navegador renderiza correctamente. Ubicación: `showPodium()` en tv.html (~línea 3210).

16. **Entidades HTML (`textContent` vs `innerHTML`)** — Se corrigieron varios errores donde entidades como `&#127942;` se mostraban como texto plano en lugar del emoji. Siempre usar `.innerHTML` al inyectar estas entidades dinámicamente.
17. **Assets de Premiación Premium** — Los PNGs de corona y trofeo se procesaron con floodfill en Python para lograr una transparencia perfecta (sin rastro de compresión o "halos" verdes).
18. **Flujo de karaoke atascado** — Actualmente el juego se rompe después de la ruleta; el botón de "a cantar" no avanza al reproductor de video. **(BUG PENDIENTE)**

---

## Próximos pasos sugeridos

- [x] Integrar los PNGs de `public/assets/avatars/` como imágenes reales en las player cards, rebanadas de la ruleta y vistas del móvil
- [x] Launcher detecta si Node.js está instalado y muestra MessageBox con instrucciones de descarga
- [x] **`menu_music.mp3`** — Decidido no implementar. Solo `new_game.mp3` se reproduce en el launcher. La música de fondo se maneja desde la TV vía Web Audio API si se desea.
- [ ] **Flujo del juego roto** — Investigar por qué después de la ruleta no empiezan los videos y el botón de 'a cantar' se atasca o no avanza en el flujo.
- [ ] **Activar hotspot automáticamente desde Launcher.cs** — Actualmente el launcher C# no llama `hotspot.ps1`. Opción: integrar la llamada con elevación UAC desde C#.
- [x] **Premiación Premium inmersiva** — Se agregaron SFX reales (ElevenLabs) y se corrigieron los tiempos de animación y placeholders de audio (`lobby_welcome_0.mp3`) para que el Tío Axolo mencione específicamente cada premio y evento de la ceremonia final.
- [x] **Limpiar scripts legacy** — `Ritmika.ps1`, `Ritmika.bat`, `jugar.bat` eliminados.
- [x] **Eliminar `err.txt`** — Artefacto stale eliminado.
- [ ] **Probar restore banner en TV** (recargar en medio del juego)
- [x] **Filtro dinámico en Ronda 2 (Fuego Cruzado)** implementado (la lista de canciones en el celular ahora se filtra inteligentemente por las preferencias de géneros y artistas de la víctima seleccionada).
- [ ] **Probar Ronda 2 (Fuego Cruzado)** completa
- [ ] **Probar con 4+ jugadores simultáneos**
- [ ] Opcional: splash screen con logo antes del launcher

---

## Estado actual (resumen ejecutivo)

| Componente | Estado | Notas |
|-----------|--------|-------|
| Server | **COMPLETO** | 540 líneas, todos los eventos, rate limiting, video proxy |
| TV Frontend | **COMPLETO** | 4031 líneas, todas las pantallas, Axolo cut-in, ruleta, karaoke, votación, podio premium con ceremonia tipo pasarela |
| Mobile Frontend | **COMPLETO** | 1838 líneas, 8 pantallas, toda la interactividad |
| Launcher C# | **COMPLETO** | 241 líneas, bug de RButton corregido, audio reproduce |
| GameWindow | **COMPLETO** | 282 líneas, WebView2, animación de carga |
| Build System | **COMPLETO** | EXE compilado y funcional, DLLs presentes |
| Audio Assets | **COMPLETO** | 172 MP3s + SFX Inmersivos (ElevenLabs), cobertura total de géneros y ceremonias |
| Avatar Assets | **COMPLETO** | 8 PNGs presentes |
| Axolo Assets | **COMPLETO** | 6 vignettes + body PNG |
| Karaoke DB | **COMPLETO** | 2820 canciones, 287 artistas, 7 géneros |
| menu_music.mp3 | **NO EXISTE** | Feature no implementada |
| Hotspot automático | **NO IMPLEMENTADO** en launcher C# | Solo funciona con jugar.bat o manual (legacy eliminado) |
| Referencias .wav | **RESUELTA** | 109 refs normalizadas a .mp3 |
| Electronica en DB | **FALTANTE** | Frontend lo soporta, DB no tiene canciones. Fallback a otros géneros. |

---

## Convenciones de código
- Server: `server/index.js` — CommonJS (require), sin TypeScript
- TV/Mobile: HTML vanilla, sin frameworks. Anime.js para animaciones.
- C#: .NET Framework 4.x, WinForms, sin librerías externas.
- Sin comentarios en código a menos que sea necesario.
- `camelCase` en JS, `PascalCase` en C#.

---

## Guía de Estética, Diseño y Animaciones (Estándar: Persona 5)

Para mantener la coherencia visual en Rítmika, todos los agentes que generen o modifiquen UI/UX deben adherirse estrictamente a las siguientes pautas, utilizando la estética de **Persona 5** como nuestro estándar principal para la presentación visual, menús y diálogos.

### 1. Sistema de Diálogos y Cut-ins
- **Dinámica Visual**: Los diálogos y notificaciones no deben ser cajas rectangulares estáticas. Deben utilizar un sistema de "cut-in" dinámico.
- **Estilo Inclinado (Skew)**: Usar contenedores con ángulos agresivos (ej. `transform: skewX(-12deg)`). Los contenidos internos (textos y retratos) deben aplicar el sesgo inverso (`skewX(12deg)`) para evitar deformación.
- **Movimiento y Velocidad**: Las entradas/salidas deben ser extremadamente rápidas ("snappy"). Usar desenfoque temporal (`filter: blur(10px)` a `blur(0)`) durante las transiciones para simular motion blur por velocidad.
- **Sonido Sincronizado**: Las apariciones de la interfaz deben estar acompañadas de efectos de sonido ("swoosh") sintetizados mediante Web Audio API para mayor inmediatez e impacto.

### 2. Estilo Visual General: Jackbox + Persona 5
- **Paleta de Colores**: Fondo principal oscuro (`#0f172a` o negro sólido) combinado con bloques de colores muy vibrantes, altamente saturados y contrastantes: amarillo chillón (`#ffe600`), cian (`#00e5ff`), magenta (`#f0047f`) y rosa (`#ec4899`). Evitar gradientes suaves; usar bloques sólidos.
- **Tipografía**:
  - **Títulos/Encabezados**: `Paytone One` para gran impacto.
  - **Textos e Instrucciones**: `Fredoka` en peso grueso (`font-weight: 900`).
- **Efecto Sticker / Neo-Brutalismo**: Todos los paneles, botones y tarjetas deben tener un borde sólido y oscuro (`border: 4px solid #111827`) junto con una sombra sólida desplazada y sin difuminar (`box-shadow: 7px 7px 0px #111827`).

### 3. Microinteracciones y Efectos (Anime.js)
- **Aparición (Pop-ins)**: Los elementos de UI deben aparecer con rebotes elásticos (`elasticity`) en la escala. Si hay múltiples elementos (como la lista de jugadores), usar la función de `stagger` de Anime.js para apariciones en cadena.
- **Eventos Destacados**: Para acciones de gran impacto (votación, penalizaciones, sabotajes), utilizar el efecto de vibración de pantalla (`screen-shake`), pulsos de brillo (`glowPulse`) y destellos en los bordes.
- **Feedback Interactivo**: Los botones en la interfaz móvil (`mobile.html`) deben dar respuesta inmediata de presión. Al hacer "tap", el contenedor debe trasladarse para nivelarse con su `box-shadow` simulando el hundimiento de un botón mecánico físico.

### 4. Manejo de Assets (Tío Axolo y Avatares)
- **Transparencia RGBA Total**: No rodear a los personajes con fondos cuadrados; conservar la transparencia generada por floodfill en todas las viñetas (`tio_axolo_vignette_*.png`) y avatares.
- **Gestión SVG**: Al insertar estas imágenes en gráficos dinámicos (como la ruleta de géneros), usar etiquetas `<image>` dentro del SVG para asegurar que rotan correctamente en conjunción con un `transform-origin` definido en coordenadas absolutas de píxeles, nunca relativas (`center`).

### 5. Pipeline de Generación de Imágenes (IA + Transparencia)
Cuando un agente necesite generar nuevos assets visuales (nuevas expresiones, avatares o props) usando sus herramientas de generación de imágenes, debe seguir este flujo estricto:
- **Prompting para Recorte**: Al generar la imagen, SIEMPRE incluye en el prompt la instrucción de colocar al sujeto "sobre un fondo verde plano y sólido (solid flat green background)". Evita sombras proyectadas sobre el piso que dificulten el recorte.
- **Estilo Artístico**: Mantener el estilo 3D cartoon / mascota de fiesta, con iluminación limpia y colores vibrantes.
- **Procesamiento de Transparencia (Floodfill)**: La imagen generada cruda NO debe usarse directamente. Debe procesarse mediante un script de Python (`Pillow`) aplicando `floodfill` desde las esquinas para reemplazar el color verde por transparencia total (Alpha = 0).
- **Formato Final**: Guardar siempre como `.png` (RGBA). Esto garantiza bordes limpios sin halos verdes ni artefactos de compresión, manteniendo la estética pulcra tipo "sticker" sobre nuestros fondos oscuros.

 
 # # #   R E G L A   E S T R I C T A   D E   E D I C I � N   E N   t v . h t m l 
 * * N U N C A   u s e s   h e r r a m i e n t a s   d e   r e e m p l a z o   d i f u s o   ( f u z z y   r e p l a c e )   c o m o   \ m u l t i _ r e p l a c e _ f i l e _ c o n t e n t \   o   \  e p l a c e _ f i l e _ c o n t e n t \   e n   \ p u b l i c / t v . h t m l \   p a r a   b l o q u e s   d e   c � d i g o   q u e   c o n t e n g a n   l l a v e s   r e p e t i t i v a s   ( \ } \ ) ,   a r r a y s   o   l i s t e n e r s   g e n � r i c o s . * * 
 E l   a r c h i v o   \ 	 v . h t m l \   e s   u n   m o n o l i t o   g i g a n t e   d e   m � s   d e   5 0 0 0   l � n e a s .   L o s   r e e m p l a z o s   d i f u s o s   s u e l e n   c a u s a r   d u p l i c a c i o n e s   m a s i v a s ,   c o r r o m p i e n d o   l a s   e t i q u e t a s   \ < s c r i p t > \   y   r o m p i e n d o   l a   c a r g a   i n i c i a l   p o r   c o m p l e t o   c o n   \ S y n t a x E r r o r :   U n e x p e c t e d   t o k e n \ . 
 * * S O L U C I � N   O B L I G A T O R I A : * *   P a r a   e d i t a r   l � g i c a   e n   \ 	 v . h t m l \ ,   d e b e s   e x t r a e r   e l   c o n t e n i d o ,   p r o c e s a r l o   o   h a c e r   r e e m p l a z o s   e x a c t o s   u s a n d o   u n   s c r i p t   d e   N o d e . j s   ( \ 
 o d e   - e \ )   c o n   e x p r e s i o n e s   r e g u l a r e s   s e g u r a s   o   \ i n d e x O f \ / \ s p l i c e \   b a s a d o   e n   l � n e a s   p r e c i s a s .   D e s p u � s   d e   c a d a   e d i c i � n   e s t r u c t u r a l ,   D E B E S   v e r i f i c a r   l a   s i n t a x i s   d e   l o s   s c r i p t s   e m b e b i d o s .  
 