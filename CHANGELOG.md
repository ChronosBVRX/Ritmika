# Changelog

Todas las notables cambios a Rítmika. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

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
