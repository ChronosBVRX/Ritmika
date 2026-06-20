# Rítmika

> Karaoke party game al estilo Jackbox. Una PC sirve como servidor y pantalla de TV, los invitados usan sus celulares como controles. Sin internet necesario.

[![Version](https://img.shields.io/badge/version-1.0.1-blue)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2B-lightgrey)]()

---

## Qué es

Rítmika es un juego de karaoke para fiestas donde un grupo de jugadores se conecta desde sus celulares a una PC que hace de servidor y pantalla grande. Un anfitrión virtual — el **Tío Axolo** — guía la partida con bromas, reacciones y premiaciones al estilo Persona 5 / Jackbox.

**No necesitas internet.** Solo una PC con Windows y un hotspot WiFi.

## Características

- **Dual-Display** — Pantalla TV + controles móviles sincronizados en tiempo real
- **Sin internet** — WiFi hotspot local, conexión directa por QR
- **Tío Axolo** — Presentador virtual con 170+ frases por género, cut-ins estilo RPG y 6 expresiones animadas
- **3 rondas** — Tu elección → Fuego Cruzado → Apagón Mental
- **8 avatares** — Personajes temáticos con PNGs transparentes
- **Ruleta animada** — SVG con avatares reales y giro determinista
- **Votación en vivo** — 10, 30, 60 o 100 puntos por canción
- **Premiación épica** — Ceremonia tipo pasarela con premios especiales
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
| TV | HTML5 + Vanilla JS + Anime.js | `public/tv.html` |
| Móvil | HTML5 + Vanilla JS | `public/mobile.html` |
| Launcher | C# WinForms + WebView2 | `src/Launcher.cs` |

> Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalles completos.

## Estructura del proyecto

```
Ritmika/
├── server/
│   └── index.js              # Servidor Express + Socket.io
├── public/
│   ├── tv.html               # Pantalla de TV (4000+ líneas)
│   ├── mobile.html           # Controlador móvil
│   ├── assets/               # Audio, avatares, imágenes Axolo
│   ├── js/                   # Animaciones y síntesis de sonido
│   └── libs/                 # Tailwind, Anime.js, QRCode (offline)
├── src/
│   ├── Launcher.cs           # Launcher C# WinForms
│   └── GameWindow.cs         # Ventana WebView2 fullscreen
├── scripts/                  # Build, hotspot, generación de audio
├── docs/                     # Documentación detallada
├── build.bat                 # Compilador en un paso
└── package.json
```

## Documentación

| Documento | Descripción |
|-----------|------------|
| [API Reference](docs/API.md) | Endpoints REST y eventos Socket.io |
| [Architecture](docs/ARCHITECTURE.md) | Diagrama de componentes y flujo de datos |
| [Gameplay](docs/GAMEPLAY.md) | Reglas, rondas, votación y mecánicas |
| [Development](docs/DEVELOPMENT.md) | Setup de desarrollo, convenciones, build |
| [Deployment](docs/DEPLOYMENT.md) | Cómo deployar y configurar la red |
| [Changelog](CHANGELOG.md) | Historial de versiones |

## Stack

| Capa | Tecnología |
|------|-----------|
| Servidor | Node.js + Express + Socket.io + qrcode |
| TV | HTML/JS vanilla + Anime.js + Tailwind CSS |
| Móvil | HTML/JS vanilla |
| Launcher | C# WinForms (.NET 4.x) |
| WebView2 | Edge runtime (incluido en Windows 10/11) |
| Audio | Web Audio API (sintetizado) + ElevenLabs (grabado) |
| Build | `build.bat` — csc.exe + descarga WebView2 |

## License

[MIT](LICENSE) — Axel Rosete
