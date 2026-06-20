# Development

Guía para desarrolladores que quieran contribuir o modificar Rítmika.

---

## Requisitos

| Herramienta | Versión | Propósito |
|-------------|---------|-----------|
| Windows | 10/11 | SO requerido |
| Node.js | v16+ | Servidor |
| npm | (viene con Node) | Dependencias |
| .NET Framework | 4.6.2+ | Compilar launcher C# |
| csc.exe | (viene con .NET) | Compilador C# |
| Python 3 | 3.x | Procesado de assets (Pillow) |
| Git | cualquier | Control de versiones |

---

## Setup de desarrollo

```bash
# 1. Clonar
git clone https://github.com/ChronosBVRX/Ritmika.git
cd Ritmika

# 2. Instalar dependencias
npm install

# 3. Crear .env
copy .env.example .env

# 4. Ejecutar en modo dev (con nodemon)
npm run dev

# 5. Abrir en navegador
# TV: http://localhost:3000
# Móvil: http://localhost:3000/join
```

### Scripts disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| Iniciar servidor | `npm start` | Node.js en modo producción |
| Desarrollo | `npm run dev` | Nodemon (auto-reload) |
| Deploy rápido | `npm run deploy` | git add + commit + push |
| Compilar EXE | `build.bat` | Compila Launcher.cs + GameWindow.cs |

---

## Estructura del código

```
Ritmika/
├── server/
│   ├── index.js              # Servidor Express + Socket.io (~600 líneas)
│   ├── r2_db.json            # DB principal: 3,845 canciones (Cloudflare R2)
│   ├── karaoke_db.json       # DB fallback: 2,820 canciones
│   ├── build_summary.json    # Stats de build
│   ├── game_modes_config.json # Config de modos de juego
│   └── deezer_audit.json     # Auditoría de géneros
│
├── public/
│   ├── tv.html               # Pantalla TV (~5600 líneas)
│   ├── mobile.html           # Controlador móvil (~1960 líneas)
│   ├── js/
│   │   └── animations.js     # UISounds (Web Audio) + RitmikaStyleFX (confetti, etc.)
│   ├── libs/
│   │   ├── tailwind.js       # Tailwind CSS local
│   │   ├── anime.min.js      # Anime.js para animaciones
│   │   ├── gsap.min.js       # GSAP (adicional)
│   │   └── QRCode.min.js     # Generación de QR en cliente
│   └── assets/
│       ├── audio/            # 392 MP3s (voces Axolo, intros, votos, SFX)
│       ├── avatars/          # 8 WebPs de avatares con transparencia
│       └── tio_axolo_vignette_*.webp  # 6 expresiones de Axolo + variantes por modo
│
├── src/
│   ├── Launcher.cs           # Launcher C# WinForms (281 líneas)
│   └── GameWindow.cs         # Ventana WebView2 (132 líneas)
│
├── scripts/
│   ├── generate_icon.ps1     # Crea ritmika.ico desde tio_axolo_body.webp
│   ├── download_deps.ps1     # Descarga DLLs de WebView2 desde NuGet
│   ├── hotspot.ps1           # Activa hotspot WiFi de Windows
│   ├── generate_all_audio.js # Genera voces con ElevenLabs API
│   ├── generate_podium_audio.js  # Genera audio de podio
│   ├── generate_podium_extra.js  # Audio extra de podio
│   ├── fix_conexion.ps1      # Agrega regla de firewall para puerto 3000
│   ├── build_r2_db.py        # Construye DB de Cloudflare R2
│   ├── crawl_drive.py        # Crawler de Google Drive para karaoke
│   ├── convert_assets.py     # Convierte assets de imagen (PNG → WebP)
│   ├── process_green.py      # Procesa assets de fondo verde
│   ├── fix_axolo_transparency.py  # Corrige transparencia de vignettes
│   ├── fix_stars_transparency.py  # Corrige transparencia de estrellas
│   ├── gen_lobby_deco.py     # Genera decoraciones de lobby
│   ├── generate_tomato_asset.py   # Genera assets de tomate
│   ├── optimize_logo.py      # Optimiza imágenes de logo
│   ├── download_fonts.py     # Descarga/customiza fuentes web
│   ├── check_api.py          # Verifica conectividad de API
│   └── add_audio.py          # Agrega assets de audio
│
├── [scripts de fix en raíz]  # 15+ scripts de mantenimiento
├── build.bat                 # Compilador en un paso
└── package.json              # v1.0.1, dependencias Node.js
```

---

## Convenciones de código

### JavaScript (server + frontends)

- **Estilo**: CommonJS (`require`), sin TypeScript
- **Naming**: `camelCase` para variables y funciones
- **Eventos Socket.io**: Prefijo `tv:` para eventos de la TV, `player:` para eventos del celular, `game:` para eventos del server
- **Sin comentarios** a menos que sea estrictamente necesario
- **HTML vanilla**: Sin frameworks (React, Vue, etc.)

### C# (launcher)

- **Estilo**: .NET Framework 4.x, WinForms
- **Naming**: `PascalCase` para métodos y propiedades
- **Controles custom**: `RButton` y `RPanel` (heredan de Control/Panel)
- **Audio**: P/Invoke a `winmm.dll` via `mciSendString`

### CSS

- **Framework**: Tailwind CSS (clases utility-first)
- **Estilo**: Neo-brutalismo / Jackbox
  - Bordes: `border: 4px solid #111827`
  - Sombras: `box-shadow: 7px 7px 0px #111827`
  - Fondo oscuro: `#0f172a`
  - Acentos: `#ffe600` (amarillo), `#00e5ff` (cian), `#f0047f` (magenta)

### Assets de imagen

- **Avatares**: WebPs con transparencia RGBA real (floodfill desde esquinas, convertidos de PNG)
- **Viñetas Axolo**: Generadas con IA sobre fondo verde, procesadas con Pillow floodfill
- **Formato final**: Siempre `.webp` para transparencia y menor tamaño

---

## Build system

### `build.bat` — Compilación en un paso

```
1. Verifica dependencias (Node.js, npm, csc.exe)
2. Genera ritmika.ico desde tio_axolo_body.webp
3. Descarga DLLs de WebView2 desde NuGet
4. Compila Launcher.cs + GameWindow.cs → Ritmika.exe
5. Copia DLLs junto al EXE
```

### Compilar manualmente

```cmd
%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:Ritmika.exe src\Launcher.cs src\GameWindow.cs /reference:Microsoft.Web.WebView2.Core.dll /reference:Microsoft.Web.WebView2.WinForms.dll
```

---

## Cómo agregar features

### Nueva mecánica de ronda

1. Agregar lógica en `tv.html` (función correspondiente al flujo de ronda)
2. Agregar eventos Socket.io en `server/index.js` si necesita comunicación nueva
3. Agregar pantalla/en pantalla en `mobile.html` si el jugador necesita interactuar
4. Agregar voces Axolo si el anfitrión debe comentar

### Nueva canción

1. Agregar entrada en `server/r2_db.json` con `{ id, title, artist, genre, url, duration }`
2. El servidor la carga automáticamente al reiniciar

### Nueva expresión de Axolo

1. Generar imagen con IA sobre fondo verde
2. Procesar con Pillow floodfill para transparencia RGBA
3. Guardar como `public/assets/tio_axolo_vignette_<emocion>.webp`
4. Agregar mapeo en `AXOLO_PRESET_MAP` en `tv.html`
5. Generar audio con ElevenLabs y guardar en `public/assets/audio/`

### Nueva frase de Axolo

1. Generar MP3 con ElevenLabs (`scripts/generate_all_audio.js`)
2. Guardar en `public/assets/audio/`
3. Agregar referencia en el array correspondiente en `tv.html` (ej: `LOBBY_WELCOME_PHRASES`)

---

## Troubleshooting

### El servidor no arranca

- Verificar que el puerto 3000 no esté en uso: `netstat -ano | findstr :3000`
- Matar proceso previo: `taskkill /PID <pid> /F`
- Verificar que `server/r2_db.json` existe

### WebView2 no carga

- Verificar que las DLLs están junto al EXE: `WebView2Loader.dll`, `Microsoft.Web.WebView2.*.dll`
- En Windows 10 sin Edge: instalar [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Audio no suena

- MCI puede fallar con ciertos MP3
- Verificar que el audio de inicio está comentado en Launcher.cs (diseñado así)
- Verificar que `menu_music.mp3` existe en `public/assets/audio/`

### QR no aparece

- Verificar que `qrcode` está instalado: `npm list qrcode`
- Verificar que la IP detectada es correcta: `GET /api/network-config`

### Hotspot no funciona

- Ejecutar `hotspot.ps1` como administrador
- Verificar que el adaptador WiFi soporta hotspot
- Si falla, activar manualmente: Configuración → Red → Mobile Hotspot

### Pantalla negra en video

- Bug conocido de WebView2: se soluciona reemplazando el elemento `<video>` completo
- Verificar que la URL del video es accesible (presigned URL no expirada)

### DB no carga

- Verificar que `server/r2_db.json` existe y es JSON válido
- El servidor usa `r2_db.json` como primario, `karaoke_db.json` como fallback
- Si R2 no está configurado, las URLs de video pueden no funcionar

---

## Depuración

### Server

```bash
# Logs en consola
npm start

# Verificar salud del servidor
curl http://localhost:3000/api/health

# Ver canciones disponibles
curl http://localhost:3000/api/songs | head
```

### TV

- Abrir DevTools en WebView2: F12
- `localStorage.getItem('ritmika_game_state')` — ver estado guardado
- `window.catalogoKaraoke` — ver catálogo de canciones cargado
- Ctrl+Shift+D — debug panel con info de estado

### Socket.io

- Inspeccionar pestaña Network → filtro WS en DevTools
- Verificar que los eventos llegan y salen correctamente
