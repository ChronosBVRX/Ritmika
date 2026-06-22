# Rítmika

> Karaoke party game al estilo Jackbox. Una PC sirve como servidor y pantalla de TV, los invitados usan sus celulares como controles. Sin internet necesario.

[![Version](https://img.shields.io/badge/version-1.0.1-blue)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2B-lightgrey)]()

---

## Qué es

Rítmika es un juego de karaoke para fiestas donde un grupo de jugadores se conecta desde sus celulares a una PC que hace de servidor y pantalla grande. Un anfitrión virtual — el **Tío Axolo** — guía la partida con bromas, reacciones y premiaciones al estilo Persona 5 / Jackbox.

**Funciona local y en la nube.** Modo local: PC con Windows + hotspot WiFi. Modo online: deploy en Render, jugadores desde cualquier lugar con internet.

## Características

- **Dual-Display** — Pantalla TV + controles móviles sincronizados en tiempo real
- **Sin internet** — WiFi hotspot local, conexión directa por QR
- **Tío Axolo** — Presentador virtual con 180+ frases por género, cut-ins estilo RPG y 6 expresiones animadas
- **3 rondas** — Tu elección → Fuego Cruzado → Apagón Mental
- **8 avatares** — Personajes temáticos con PNGs transparentes
- **Ruleta animada** — SVG con avatares reales y giro determinista
- **Votación en vivo** — 10, 30, 60 o 100 puntos por canción
- **Premiación épica** — Ceremonia tipo pasarela con premios especiales
- **5 modos de juego** — Clásico (funcional), Anime, Emo, Ranchera, Nostalgia (próximamente)
- **Neo-brutalismo** — Estética Jackbox/Persona 5 con sombras sólidas y colores vibrantes

## Quick Start

### Requisitos

- Windows 10/11
- [Node.js](https://nodejs.org) v16+
- .NET Framework 4.6.2+ (para compilar el launcher)

### Instalar y ejecutar

```bash
# 1. Clonar el repositorio
git clone https://github.com/ChronosBVRX/Ritmika.git
cd Ritmika

# 2. Instalar dependencias de Node.js
npm install

# 3. Configurar variables de entorno
copy .env.example .env
# Editar .env con tu IP y configuración

# 4. Compilar el launcher (opcional, solo Windows)
build.bat

# 5. Ejecutar
Ritmika.exe
# O directamente:
npm start
```

### Archivo `.env`

```env
PORT=3000
HOTSPOT_SSID=Ritmika
HOTSPOT_PASSWORD=Ritmika2026
ADMIN_TOKEN=una_clave_segura_aqui
```

## Cómo jugar

1. **Activar hotspot WiFi** en la PC (Configuración → Red → Mobile Hotspot)
2. **Abrir Ritmika.exe** — la pantalla de TV aparece con un QR
3. **Los jugadores escanean el QR** desde sus celulares → se unen a la sala
4. **El host inicia el juego** → 3 rondas de karaoke
5. **Votar y cantar** — cada jugador puntúa a los demás desde su celular
6. **Premiación** — el Tío Axolo revela al ganador con ceremonia épica

## Arquitectura

```
PC (servidor + TV)
  ├── Node.js :3000
  ├── Ritmika.exe (C# → WebView2)
  └── Hotspot WiFi "Ritmika"
        └── Celulares → http://<IP>:3000/join
```

| Componente | Tecnología | Archivo |
|-----------|-----------|---------|
| Servidor | Node.js + Express + Socket.io | `server/index.js` |
| TV | HTML5 + Vanilla JS + Anime.js + GSAP | `public/tv.html` |
| Móvil | HTML5 + Vanilla JS + Tailwind | `public/mobile.html` |
| Launcher | C# WinForms + WebView2 | `src/Launcher.cs` |

> Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalles completos.

## Estructura del proyecto

```
Ritmika/
├── server/
│   ├── index.js              # Servidor Express + Socket.io (~825 líneas)
│   ├── songs.db              # DB principal: SQLite con 3,845 canciones
│   ├── game_modes_config.json # Config de modos de juego
│   └── deezer_audit.json     # Auditoría de géneros
├── public/
│   ├── tv.html               # Pantalla de TV (~2566 líneas, HTML/CSS)
│   ├── mobile.html           # Controlador móvil (~2015 líneas)
│   ├── js/
│   │   ├── tv/               # 6 módulos: constants, state, ui, socket, game, lobby
│   │   ├── animations.js     # UISounds + RitmikaStyleFX
│   │   ├── bootloader.js     # Bootloader 5 pasos
│   │   └── styles.js         # CSS helpers
│   ├── assets/               # Audio (392 MP3s), avatares (8 WebP), Axolo (6 WebP)
│   └── libs/                 # Tailwind, Anime.js, GSAP, QRCode (offline)
├── src/
│   ├── Launcher.cs           # Launcher C# WinForms (281 líneas)
│   └── GameWindow.cs         # Ventana WebView2 fullscreen (132 líneas)
├── scripts/                  # Build, hotspot, generación de audio, procesado de assets
├── docs/                     # Documentación detallada
├── build.bat                 # Compilador en un paso
└── package.json
```

## Documentación

| Documento | Descripción |
|-----------|------------|
| [API Reference](docs/API.md) | Endpoints REST (9) y eventos Socket.io (30+) |
| [Architecture](docs/ARCHITECTURE.md) | Diagrama de componentes y flujo de datos |
| [Gameplay](docs/GAMEPLAY.md) | Reglas, rondas, votación y mecánicas |
| [Development](docs/DEVELOPMENT.md) | Setup de desarrollo, convenciones, build |
| [Deployment](docs/DEPLOYMENT.md) | Cómo deployar y configurar la red |
| [Changelog](CHANGELOG.md) | Historial de versiones |

## Stack

| Capa | Tecnología |
|------|-----------|
| Servidor | Node.js + Express + Socket.io + better-sqlite3 + compression + qrcode |
| TV | HTML/JS vanilla + Anime.js + GSAP + Tailwind CSS + SVG |
| Móvil | HTML/JS vanilla + Tailwind CSS |
| Launcher | C# WinForms (.NET 4.x) |
| WebView2 | Edge runtime (incluido en Windows 10/11) |
| DB | SQLite (better-sqlite3, ~0.5MB, 3,845 canciones) |
| Video | Cloudflare R2 (presigned URLs via AWS SDK) |
| Audio | Web Audio API (sintetizado) + ElevenLabs (grabado) |
| Build | `build.bat` — csc.exe + descarga WebView2 |

## License

[MIT](LICENSE) — Axel Rosete
