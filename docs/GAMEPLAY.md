# Gameplay

Guía completa de las mecánicas de juego, rondas, votación y reglas de Rítmika.

---

## Visión general

- **Jugadores**: 2-8+ (recomendado 3-6)
- **Rondas**: 3
- **Duración por canción**: ~2-3 minutos (según duración del video)
- **Duración total**: ~20-40 minutos dependiendo del número de jugadores
- **Anfitrión virtual**: Tío Axolo (guía la partida con bromas y reacciones)

---

## Flujo del juego

```
┌──────────────┐
│  PRE-BOOT    │ ← Splash con Axolo, click para desbloquear audio
└──────┬───────┘
       ▼
┌──────────────┐
│  BOOTLOADER  │ ← 5 pasos: conectar, sala, catálogo, FFmpeg, optimizar
└──────┬───────┘
       ▼
┌──────────────┐
│  MODO        │ ← Elegir modo de juego (solo Clásico funciona)
└──────┬───────┘
       ▼
┌──────────────┐
│   LOBBY      │ ← Jugadores se unen, QR, código de sala
└──────┬───────┘
       ▼
┌──────────────┐
│  RONDA 1     │ ← "Tu Elección, Tu Condena"
│  Ruleta →    │    Cada quien canta una canción de su preferencia
│  Karaoke →   │    + reto aleatorio al 50%
│  Votación    │
└──────┬───────┘
       ▼
┌──────────────┐
│  RONDA 2     │ ← "Fuego Cruzado"
│  Asignar →   │    Los jugadores asignan canciones a otros
│  Ruleta →    │    La canción asignada reemplaza la preferencia
│  Karaoke →   │
│  Votación    │
└──────┬───────┘
       ▼
┌──────────────┐
│  RONDA 3     │ ← "Apagón Mental"
│  Ruleta →    │    Igual que R1 pero con blackout
│  Karaoke →   │    Se oscurece el video y las letras al 40%
│  Votación    │
└──────┬───────┘
       ▼
┌──────────────┐
│   PODIO      │ ← Ceremonia de 5 fases con premios especiales
└──────────────┘
```

---

## Pre-boot y Bootloader

### Pre-boot
- Splash con imagen del Tío Axolo y botón "¡Entrar a Ritmika!"
- **Propósito**: Desbloquear el AudioContext del navegador (requiere interacción del usuario)

### Bootloader (5 pasos)
1. Conectando al servidor
2. Creando sala
3. Cargando catálogo de canciones
4. Verificando FFmpeg
5. Optimizando motor de juego
- Incluye retry button si falla algún paso
- Done banner al completar

---

## Modos de juego

| Modo | Estado | Descripción |
|------|--------|------------|
| Clásico | **Funcional** | Modo estándar con todos los géneros |
| Fiesta Anime | PRÓXIMAMENTE | Enfocado en anime/J-pop |
| Fiesta Emo | PRÓXIMAMENTE | Rock emo/alternative |
| Dolidas & Rancheras | PRÓXIMAMENTE | Regional mexicano |
| Nostalgia Pop | PRÓXIMAMENTE | Pop de los 2000s-2010s |

Si se selecciona un modo bloqueado, Axolo muestra: "Aguanta compa! Los changos del codigo siguen armando este modo."

---

## Lobby

### Conexión
1. La TV muestra dos QR codes:
   - **QR WiFi**: Credenciales de la red hotspot
   - **QR Juego**: URL de conexión (`http://<IP>:3000/join`)
2. Los jugadores escanean primero el WiFi, luego el de juego
3. Entran un código de sala de 4 caracteres + nombre (máx 15 chars) + avatar (8 opciones)

### Pantalla de espera
- Muestra la lista de jugadores conectados con sus avatares
- El host ve un botón "¡Que empiece la fiesta!" cuando hay al menos 2 jugadores
- El Tío Axolo da la bienvenida y comenta frases idle cada 8 segundos
- Audio preloader descarga todos los MP3s en background

---

## Ronda 1 — "Tu Elección, Tu Condena"

### Preparación
- Cada jugador selecciona sus **géneros preferidos** y **artistas favoritos** desde el celular
- El sistema usa estas preferencias para elegir la canción

### Desarrollo
1. La ruleta gira y selecciona al siguiente cantante
2. Se muestra la canción asignada (basada en preferencias del jugador)
3. **8 segundos** de preparación antes de que empiece el video
4. El jugador canta mientras los demás ven y preparan sus votos

### Reto (Challenge)
- Al **50%** de duración de la canción, aparece un reto aleatorio
- 10 retos posibles:
  - "¡Canta llorando con mocos!"
  - "¡Canta como T-Rex con brazos cortos!"
  - "¡Canta solo vocales, sin consonantes!"
  - "¡Canta con tu mejor voz de telenovela!"
  - (y 6 más)
- Dura 8 segundos en pantalla
- El Tío Axolo comenta el reto

---

## Ronda 2 — "Fuego Cruzado"

### Preparación
- Todos los jugadores son enviados a la pantalla de **asignación** en sus celulares
- Cada jugador elige una canción del catálogo y se la **asigna a un rival**
- La asignación es secreta (el rival no sabe qué le tocó)
- **Filtro inteligente**: Las canciones se filtran por los géneros y artistas de la víctima
- Tiempo de asignación: ~30 segundos (auto-spin en la TV)

### Desarrollo
1. La ruleta selecciona al cantante
2. **Si el cantante tiene una canción asignada por otro jugador**: canta esa (no la suya)
3. **Si no tiene asignación**: canta una basada en sus preferencias (igual que R1)
4. No hay reto ni blackout en esta ronda

### Lógica de selección de canción
```
1. ¿Tiene canción asignada por otro jugador? → Usar esa
2. ¿Hay canciones que coincidan con sus artistas? → Elegir una al azar
3. ¿Hay canciones que coincidan con sus géneros? → Elegir una al azar
4. Fallback: cualquier canción no usada
```

---

## Ronda 3 — "Apagón Mental"

### Desarrollo
- Igual que Ronda 1 (preferencias del jugador)
- **Sin retos**, pero con mechanic de **blackout**

### Blackout
- Al **40%** de duración de la canción:
  - El video se oscurece (`brightness(0.05)`)
  - Las letras y nombre del artista se ocultan
  - Aparece un banner de "APAGÓN" en pantalla
  - El Tío Axolo anuncia el blackout
- Dura **5-10 segundos** (aleatorio)
- Cuando termina: video y letras se restauran, Axolo comenta

---

## Sistema de votación

### Cómo votar
- Durante la canción, **todos los jugadores excepto el cantante** votan desde su celular
- Opciones de voto: **10, 30, 60 o 100 puntos**
- No se puede cambiar el voto una vez enviado

### Cálculo de puntaje
```
Puntaje de la canción = Promedio de todos los votos
Si no hay votos → 50 puntos (default)

Ejemplo:
  3 votantes: 60, 100, 30
  Promedio: (60+100+30)/3 = 63
  → El cantante suma 63 puntos a su total
```

### Auto-completado
- Si todos los votos están registrados antes de que termine la canción, esta termina automáticamente 1.5 segundos después

### Acumulación
- Los puntos se acumulan entre rondas
- El puntaje total al final del juego determina al ganador

### Reacciones de voto (TV)
- 60 frases de Axolo organizadas por tier (15 por nivel: 100, 60, 30, 10)
- Iconos: trofeo (80+), thumbs up (50+), skull (<50)

---

## Ruleta

### Comportamiento
- **Determinista**: El ganador ya se sabe antes de girar (siguiente en la cola)
- **Animación**: Gira 5 vueltas completas + ángulo necesario para caer en el ganador
- **Duración**: 2800ms con easing custom
- **Sonido**: Tick por cada borde de rebanada que cruza (sintetizado con Web Audio)

### Auto-giro
- **Rondas 1 y 3**: Auto-gira después de **4 segundos**
- **Ronda 2**: Auto-gira después de **30 segundos** (para dar tiempo de asignación)

### Visual
- SVG con rebanadas iguales (una por jugador)
- Cada rebanada muestra el avatar PNG del jugador + nombre
- Colores: `['#ec4899','#22d3ee','#a855f7','#facc15','#f97316','#22c55e','#3b82f6','#06b6d4']`
- Si hay 1 solo jugador: círculo completo sin arcos
- Fondo opaco negro para tapar filtraciones de transparencia
- Flecha `▼` en la parte superior con rebote en cada tick

---

## Karaoke

### Video player
- Se reemplaza el elemento `<video>` completo al cada canción (evita bug de pantalla negra en WebView2)
- Inicia **muted** mientras el Tío Axolo habla
- Se **unmuted** automáticamente cuando Axolo termina
- Fuente: URL presignada de Cloudflare R2 vía `/api/video-url?id=<songId>`

### Timer
- Cuenta regresiva desde la duración de la canción (o 120s si no hay metadata)
- Actualización cada segundo en el HUD
- Dispara mecánicas de ronda en porcentajes específicos

### Fin de canción
Se activa por:
- Video termina (`onended`)
- Timer llega a 0
- Todos los votos registrados

### Al terminar
1. Se detiene el video
2. Se calcula el promedio de votos
3. Se muestra el scoreboard con votos individuales y puntos totales
4. Comentario del Tío Axolo según el puntaje + bark del género del cantante
5. Auto-avanza al siguiente turno después de un timeout

---

## Mecánicas especiales

### Tomatazo 🍅
- **Costo**: 30 puntos del puntaje del atacante
- **Requisito**: Tener al menos 30 puntos
- **Efecto**: Proyectil de tomate cruza la pantalla, salpicadura, screen shake, indicador "-30 pts"
- **Contador**: Cada tomatazo incrementa `target.tomatazos` (usado para el premio "Salsa de Tomate")

### Sabotaje de audio 🔊
- Los jugadores pueden enviar sabotajes desde sus celulares
- **Umbral**: 3 sabotajes activan el efecto
- **Efecto**: Screen shake, flash magenta, Axolo reacciona enojado
- **Progreso**: Se muestra un ticker "Sabotaje: 66% (2/3)"

### Emoji reactions 😂
- Los jugadores envían emojis que flotan hacia arriba en la pantalla de TV
- Sin efecto en el juego, solo cosmético

---

## Premiación (Podio) — 5 Fases

### Fase 1 — Título revelado
- Animación épica de "LA GRAN PREMIACIÓN" con trofeo animado
- Fondo de estadio, canvas de estrellas

### Fase 2 — Premios especiales

| Premio | Criterio | Emoji |
|--------|----------|-------|
| Gallo Supremo | Menor puntaje promedio | 🐓 |
| Salsa de Tomate | Más tomatazos recibidos | 🍅 |
| Vengador Anónimo | 2do lugar con más puntos | 💗 |

### Fase 3 — Tercer y segundo lugar
- Reveles individuales con drumroll y animaciones
- Podio visual parcial con centro vacío

### Fase 4 — Reveles del ganador
- Pantalla en negro completa
- Cuenta regresiva 3-2-1 con flash
- Firework bursts y corona animada sobre el avatar

### Fase 5 — Podio final
- Todos los jugadores rankeados en podio visual
- Panel de premios especiales
- Scoreboard completo con puntos
- Confeti
- Botón "Nueva Partida"

---

## Persistencia

### Auto-guardado
Se guarda en `localStorage` con TTL de 4 horas en:
- Unión de jugadores
- Desconexión de jugadores
- Cambios de ronda
- Votación
- Fin de canción

### Restore banner
Si se recarga la TV durante una partida:
- Aparece un banner preguntando si restaurar
- Si se acepta, mergea el estado guardado con la sesión actual
- Fusiona por nombre de jugador
