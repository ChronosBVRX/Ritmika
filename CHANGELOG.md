# Changelog

Todas las notables cambios a Rítmika. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [Sin publicar] - 2026-10-20

### Added
- **Premium FX** (`public/css/premium-fx.css` + `public/js/tv/premium-fx.js`) para ruleta, retos, apagón mental y tomatazos, con capa de rendimiento que apaga los efectos pesados sin perder el arte.
- Fondo de escenario 16:9 generado con ComfyUI/SDXL (`roulette_bg_stage_wide.webp`) y assets HD de tomate (`tomato_projectile_hd.webp`, `tomato_splat_hd.webp`) con alfa real.
- `scripts/generate_premium_fx_assets.py` para reproducir el fondo y los assets de tomate con el pipeline local.
- Ruleta: slices con degradado y brillo, aros de luz, nombres horizontales legibles, avatares con halo, ranking por puntaje y tarjeta de ganador con rayos y confeti.
- Retos: tarjeta premium con sello, icono, barra de tiempo, chispas y entrada animada.
- Tomatazo: proyectil HD con estela, impacto con onda expansiva, estallido de tomate, salpicaduras múltiples, texto `¡TOMATAZO!`, marcador atacante → víctima y penalización.
- Apagón mental: banner reposicionado, scanlines y viñeta pulsante.

### Gameplay (P0)
- El reto ahora se envía a **todos los celulares**, queda visible en un HUD persistente de la TV y se evalúa con un voto binario “¿Cumplió?” durante la votación.
- Fallback de compatibilidad para relays v1.0.1: el voto de reto también viaja como emoji `🎭✅`/`🎭❌` por `player:emoji`.
- Reto cumplido: **+15 pts**. La votación espera también los votos de reto antes de cerrar; los bots votan el reto.
- El reto entra al **35%** de la canción (mín. 25 s, máx. 75 s) y ya no lleva voz de Axolo encima de la canción.
- El apagón entra al **40%** (mín. 30 s, máx. 90 s) y ya no lleva intro/outro de voz encima de la canción.
- Tomatazo: cuesta **10 pts**, solo se puede lanzar al cantante actual y resta **−15 pts** a su canción (tope −30).
- El scoreboard muestra el desglose `Votos + Reto − Tomates = Total`.
- El premio **Vengador Anónimo** ahora usa el jugador con más sabotajes reales.
- Bloqueado el autovoto del cantante.

### Fixed
- El heading de la ruleta era casi invisible por falta de contraste.
- Los nombres de los jugadores no se dibujaban en la ruleta de 2+ jugadores.
- El botón de girar quedaba enfocado detrás de la tarjeta de ganador y asomaba su anillo cian.
- Los cut-ins de Axolo mostraban entidades HTML literales (`&#161;`) en el podio y otras frases.
- Los nombres de bots ya no muestran el sufijo `(Bot)` en ruleta ni en la tarjeta de ganador.

## [Web 1.1.2 / Android TV 1.0.13] - 2026-10-20

### Added
- Navegación D-pad unificada (`dpad-nav.js`) para menú, modales, lobby, ruleta, karaoke y podio.
- Anillo de foco cian global; en Android se muestra también con foco programático.
- `KEYCODE_BACK` cierra modal, luego vuelve del lobby y al final sale; `KEYCODE_BUTTON_START` equivale a Enter.

### Fixed
- Navegación espacial del menú: modos, CTA y utilidades sin saltos ni callejones sin salida.
- Lobby: foco en Atrás/Ajustes/Empezar, exclusión de botones decorativos y recuperación si Empezar se oculta.
- Modales: foco atrapado, cierre con Escape/Back y retorno al botón que los abrió.
- Podio dinámico y botones de juego reciben foco; `Skip` de debug y controles ocultos ya no se recorren.
- El WebView recupera el foco al volver de Ajustes/Altavoz nativos.

## [Web 1.1.1 / Android TV 1.0.12] - 2026-10-20

### Changed
- **Android TV vuelve a la interfaz web compartida**: el APK carga `/tv?native=1` y usa el mismo menú/lobby HTML que la versión PC.
- `native-boot.js` entra directo al menú web en Android, sin preboot ni una segunda UI nativa.
- Se elimina el WebView fuera del viewport y el render duplicado del menú/lobby: un solo render path.
- Se conservan el video ExoPlayer, el panel de audio Bluetooth y el modal nativo de Ajustes.
- El perfil **Rendimiento** sigue siendo el predeterminado en Android TV.

### Removed
- `NativeShellView`, `NeoBrutalUi`, `RemoteImages`, `shell-bridge.js`, las fuentes Paytone/Fredoka del APK y los hooks `__ritmikaShellPush`.
- El flag `shell=1` deja de usarse; la app Android y la web comparten la misma UI.

### Fixed
- El menú/lobby de Android ya no compite con una capa nativa encima ni mantiene el WebView oculto solo para conservar el socket.

## [Web 1.1.0 / Android TV 1.0.11] - 2026-10-19

### Added
- **Dos canales de release**: Web/PC en `/tv` (alias `/`, `/pc`) y Android TV vía APK con shell nativo.
- El menú de PC muestra `v1.1.0 · WEB PC`; el APK mantiene su propia versión `1.0.11` y OTA independiente.
- **Shell nativo de menú y lobby** en Android TV: el menú de modos, hero, QR, código, jugadores y botón de inicio se pintan en Kotlin con D-pad.
- El WebView queda como motor oculto de sala/socket/juego; al iniciar la partida se muestra el juego y el shell desaparece.
- `shell-bridge.js` sincroniza modo, sala, QR, jugadores y estado entre el WebView y el shell nativo; las acciones nativas reutilizan los flujos existentes.
- Fuentes Paytone One y Fredoka incluidas en el APK para el shell nativo.
- Modos de rendimiento **Automático / Rendimiento / Calidad** para Android TV, seleccionables desde Ajustes del lobby.
- `performance.js` + `performance.css`: en Rendimiento se apagan loops, filtros grandes, halftones, confetti, screen-shake y transiciones de pantalla; el arte y los flujos se conservan.
- Prioridad de renderer `IMPORTANT` para el WebView de Android TV.
- Modal nativo **Ajustes del lobby** en Android TV: Altavoz/Audio, música del menú y movimiento reducido, sin pausar la sala.
- Botón **⚙ AJUSTES** en la cabecera del lobby, visible solo en Android y alcanzable con D-pad.
- Botón **🔊 ALTAVOZ** en el menú principal (solo Android) y atajo `KEYCODE_MENU` del control remoto para abrir el panel.
- Panel nativo **Altavoz / Audio** en Android TV: lista bocinas emparejadas, descubre y empareja nuevas, muestra estado A2DP y guarda la bocina preferida.
- `BluetoothAudioController` con permisos para Android 7–15, discovery, `createBond`, `BluetoothA2dp` y `AudioDeviceCallback` para confirmar el audio.
- “Reconectar” espera 15 s la reconexión automática de Android y guía al usuario; no fuerza A2DP porque requiere API privilegiada.
- Menú principal **Palenque Arcade**: fondo y cinco portadas de modo generados localmente con ComfyUI/SDXL (Juggernaut XL), papel picado vectorial y sistema visual neo-brutalista.
- Selección de modo tipo videojuego: riel de shows, hero cinematográfico con Axolo, ficha del modo, CTA `CREAR SALA` y datos reales del catálogo.
- Modales de **Cómo jugar**, **Ajustes** (música, pantalla completa, movimiento reducido) y **Créditos**.
- Transiciones de sala con bandas diagonales y sello `¡SALA CREADA!`; retorno al menú con `¡DE VUELTA AL SHOW!`.
- Scripts `generate_menu_assets.py` y `generate_menu_ornaments.py` para reproducir los assets del menú.
- Director de fases (`public/js/tv/flow.js`) que espera a que termine la voz de Axolo antes de avanzar, calcula pausas sobre el audio real y transmite `PHASE_STATE` a los celulares.
- Controles móviles de flujo: girar ruleta, iniciar canción y siguiente turno, habilitados solo cuando la TV confirma que el audio terminó.
- Indicador de avance automático en la TV y cuenta regresiva de la fase.
- 670 pistas Party Tyme importadas a R2 y SQLite (catálogo en 4.515 canciones)
- Modos Dolidas & Rancheras y Nostalgia Pop habilitados en TV con temas visuales y rondas temáticas
- Etiquetado de modos: 1.057 ranchera, 299 nostalgia, 58 emo, 1 anime
- Endpoint `/api/game-modes` + `server/game_modes_config.json` para el panel admin
- Índices SQLite para `LOWER(genre)`, `LOWER(mode)`, `artist` y `title`

### Changed
- La pantalla principal ya no es un dashboard de tres columnas: ahora es un menú de arcade con los modos como opciones.
- Se eliminó el auto-creado de sala a los 2 segundos; el show se elige explícitamente con teclado, mando o mouse.
- El menú principal permite llegar a Cómo jugar, Ajustes, Altavoz y Créditos con el D-pad; Altavoz también se abre con la tecla MENU del control.
- El botón Ajustes del menú principal abre el modal nativo en Android; en web se conserva el modal HTML.
- En Android TV el menú y el lobby usan el shell nativo; la ruleta, karaoke y podio siguen en el WebView, que se activa al empezar la partida.
- El servidor local/relay ahora acepta salas en modo `ranchera` y `nostalgia` (antes las convertía a `clasico`).
- En Android TV el modo Automático usa Rendimiento por defecto; Calidad restaura todos los efectos visuales.
- Los botones decorativos Entra/Código/Avatar/A cantar del lobby dejan de ser focusables para que el D-pad no se pierda en acciones falsas.
- La lista de jugadores se movió al lobby; el menú ya no muestra un panel de jugadores vacío.
- El menú principal y el lobby quedan sin diálogos de Axolo: no hay cut-in ni voz mientras se elige el show o se muestran el código, el QR y los jugadores. Los diálogos vuelven al iniciar la partida.
- La canción ya no arranca en silencio mientras Axolo presenta: el video espera pausado en 0 y empieza cuando termina la voz.
- El temporizador del karaoke usa `video.currentTime` (respeta buffering/pausas) en vez de un contador de pared.
- La votación, el scoreboard y el podio esperan a la narración completa; ya no se cortan prompts ni reacciones.
- El cantante puede iniciar su canción desde el celular (antes el servidor solo aceptaba al host).
- El primer humano en entrar es host aunque existan bots de prueba.
- `stopAllSfx` hace fade-out en vez de cortar el ambiente de golpe.
- Limpieza de 1.933 títulos legacy (`low`, `multi`, `estilo de`, `pista y letra`, etc.)
- Normalización de 84 artistas duplicados (Wisin & Yandel, Los Tigres del Norte, Paquita, etc.)
- Corrección de 96 canciones con género mal etiquetado (Emmanuel, Rihanna, Nicky Jam, etc.)
- Regenerado `artist-metadata.json` (643 artistas únicos)

### Fixed
- Audios de Axolo cortados por tiempos fijos de 8s/10s/12s.
- Video del karaoke empezando antes que la presentación, con letra desfasada.
- Botón "¡Estoy listo!" del cantante que el servidor rechazaba por no ser host.
- Cola de voz que descartaba frases completas al llegar una nueva.

## [1.0.1] - 2026-06-20

### Added
- Sistema de voces Axolo con 180+ frases por género (9 géneros × 20 frases = 180 barks)
- Cut-ins estilo Persona 5 con 6 expresiones animadas (talking, mischievous, laughing, angry, sad, singing)
- 8 avatares WebP con transparencia RGBA real (convertidos de PNG)
- Premiación premium con ceremonia de 5 fases (título, premios especiales, 3ro/2do, ganador, podio final)
- Cloudflare R2 para video storage con presigned URLs de 30 min (via AWS SDK)
- 5 modos de juego: Clásico (funcional), Anime, Emo, Ranchera, Nostalgia (próximamente)
- Ronda 3 "Apagón Mental" con blackout de video/letras al 40%
- Sistema de sabotaje de audio con umbral de 3 activaciones
- Tomatazo con costo de 30 puntos y animación de proyectil
- Persistencia localStorage con TTL de 4 horas y restore banner
- Rate limiting en server (tomatazo 2s, emoji 500ms, sabotaje 3s, video URLs 30/min)
- Generación local de QR codes con npm `qrcode`
- Hotspot WiFi con `hotspot.ps1` (WinRT API)
- Bot system con 6 nombres predefinidos para testing single-player
- Pantalla Pre-boot con "Entrar a Ritmika" (desbloquea AudioContext)
- Bootloader de 5 pasos (conectar, sala, catálogo, FFmpeg, optimizar)
- Selección de modo de juego antes de crear sala
- Audio preloader que descarga todos los MP3s durante el boot
- SFX ducking (volumen baja cuando Axolo habla)
- Debug panel (Ctrl+Shift+D) en TV
- Service Worker PWA en mobile (offline support)
- Haptic feedback en mobile (tomatazo, voto, sabotaje)
- Deep-linking con `?code=` en mobile
- Fullscreen automático en mobile al primer tap
- 6 endpoints REST nuevos: `/api/network-config`, `/api/songs`, `/api/audio-files`, `/api/health`, `/api/video-url`
- Compresión gzip activa en todas las respuestas
- Caching agresivo (1 año para assets, no-cache para HTML)
- Soporte para deploy en Render.com
- 392 archivos MP3 (up from 172): genre barks, vote reactions, intros, premios, eventos, SFX
- `menu_music.mp3` existe en assets/audio/
- Variantes de Axolo por modo de juego (anime, emo, ranchera, nostalgia)
- Assets de tomate (SVG + WebP) para animación de proyectil
- Decoraciones de lobby, assets de podio (estadio, corona), fondos premium
- GSAP cargado como librería de animación adicional

### Fixed
- RButton hover crash por desbordamiento de color (Math.Min)
- Podio no se renderizaba por conflictos de clases CSS → recrear elemento DOM
- Entidades HTML mostradas como texto plano → cambiar a innerHTML
- Colapso de altura en video por Tailwind Preflight
- Inclinación de franjas skew sin contrarrestar en contenido interno
- Referencias .wav en GENRE_BARKS con archivos .mp3 (normalización en runtime)
- Assets de premiación con halos verdes → procesados con floodfill

### Changed
- DB principal migrada a SQLite (`server/songs.db` via `better-sqlite3`) — reemplaza a `r2_db.json` en memoria
- Video endpoint: `/api/video-url` (presigned R2 URLs) reemplaza a `/api/video-proxy` (inexistente)
- Assets de imagen: todos convertidos de PNG a WebP (avatares + vignettes Axolo)
- Launcher C# abre GameWindow directo (sin formulario previo)
- Audio de inicio desactivado (`new_game.mp3` comentado en Launcher.cs)
- Rebanadas de ruleta usan avatares WebP en vez de emojis de texto
- Todas las dependencias de frontend locales (sin CDN) para modo offline
- GameWindow.cs reducido de 282 a 132 líneas (animación de carga eliminada)
- GENRE_BARKS: 20 frases/género (180 total), no 10 como se documentaba

## [1.0.0] - 2026-01-01

### Added
- Versión inicial del proyecto
- Servidor Node.js con Express + Socket.io
- Pantalla TV con ruleta SVG, karaoke y votación
- Controlador móvil con selección de avatar y géneros
- Launcher C# con WebView2
- Build system con `build.bat`
- 3 rondas de juego
- Sistema de salas con códigos de 4 caracteres
