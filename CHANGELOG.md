# Changelog

Todas las notables cambios a Rítmika. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [1.0.1] - 2026-06-20

### Added
- Sistema de voces Axolo con 170+ frases por género (8 géneros + default)
- Cut-ins estilo Persona 5 con 6 expresiones animadas (neutral, laughing, mischievous, sad, angry, singing)
- 8 avatares PNG con transparencia RGBA real (generados con IA + floodfill)
- Premiación premium con ceremonia tipo pasarela y 5 fases animadas
- Proxy de video para Google Drive con soporte Range (Cloudflare R2 presigned URLs)
- Modo de juego: Clasico, Anime, Emo, Rancheras, Nostalgia Pop
- Ronda 3 "Apagón Mental" con mechanic de blackout de video/letras
- Sistema de sabotaje de audio con umbral de activación
- Tomatazo con costo de 30 puntos y animación de proyectil
- Persistencia localStorage con TTL de 4 horas y restore banner
- Rate limiting en server (tomatazo 2s, emoji 500ms, sabotaje 3s)
- Generación local de QR codes con npm `qrcode`
- Hotspot WiFi con `hotspot.ps1` (WinRT API)
- Bot system para testing single-player

### Fixed
- RButton hover crash por desbordamiento de color (Math.Min)
- Podio no se renderizaba por conflictos de clases CSS → solución: recrear elemento DOM
- Entidades HTML mostradas como texto plano → cambiar a innerHTML
- Colapso de altura en video por Tailwind Preflight
- Inclinación de franjas skew sin contrarrestar en contenido interno
- Referencias .wav en GENRE_BARKS con archivos .mp3 (normalización en runtime)
- Assets de premiación con halos verdes → procesados con floodfill

### Changed
- Launcher C# abre GameWindow directo (sin formulario previo)
- Rebanadas de ruleta usan avatares PNG en vez de emojis de texto
- Todas las dependencias de frontend locales (sin CDN) para modo offline

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
