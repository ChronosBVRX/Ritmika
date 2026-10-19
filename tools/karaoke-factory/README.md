# Karaoke Factory

Producción offline de pistas para Ritmika. **No forma parte del runtime del juego.**

```
songs.json (manifiesto)
      ↓
búsqueda puntuada en YouTube
      ↓
media/karaoke-src/<id>__<artista>__<título>.<ext>
      ↓
report.md · report.json  (elección + score + letra disponible)
```

## Por qué existe

El catálogo de Ritmika viene de colecciones de karaoke. El repertorio emo mexicano
(PXNDX, División Minúscula, Insite, Thermo…) no está en esas colecciones, así que
hay que construirlo. Este paso solo consigue **el audio original**, que es la
materia prima para alinear la letra y separar la voz después.

## Requisitos

- `yt-dlp` **reciente** (2025+). El de los repos de Linux suele estar viejo y
  YouTube devuelve 0 resultados o `The page needs to be reloaded`.
  ```bash
  curl -L -o ~/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
  chmod +x ~/bin/yt-dlp
  ```
- `ffmpeg` / `ffprobe` en `PATH`
- Python 3.10+ (solo stdlib)

## Uso

```bash
export YTDLP=~/bin/yt-dlp          # opcional si yt-dlp del PATH ya es nuevo
python3 tools/karaoke-factory/fetch_songs.py --dry-run    # solo puntuar
python3 tools/karaoke-factory/fetch_songs.py              # descargar
python3 tools/karaoke-factory/fetch_songs.py --only pxndx-01,insite-03
```

Salida por defecto: `media/karaoke-src/` (ignorado por git). Se puede cambiar con
`--out` o `RITMIKA_KARAOKE_DIR`.

## Cómo elige la versión correcta

Cada resultado se puntúa antes de descargar:

- coincidencia de tokens del título (40 pts)
- artista en el título o el canal (20 pts)
- canal oficial o `- Topic` (15 pts)
- bonuses por `oficial` / `audio` / `letra`
- castigos fuertes: `cover`, `en vivo`, `instrumental`, `karaoke`, `remix`,
  `sped up`, `reaction`, `tutorial`, `1 hour`

`score >= 55` descarga, `38–55` queda en revisión, `< 38` se descarta. El reporte
muestra los 5 candidatos por pista para poder auditar la decisión.

## Trampas conocidas

- **Búsqueda y descarga usan clientes distintos.** `ytsearch` necesita
  `player_client=tv`; la extracción de formatos necesita el cliente por defecto.
  Mezclarlos rompe una de las dos mitades.
- **"PXNDX" como término de búsqueda devuelve 0 resultados.** Hay que buscar por
  "Panda". El campo `search` del manifiesto existe para eso.
- **Canal oficial ≠ audio de estudio.** Se prefiere `Audio Oficial` sobre el video
  oficial: el video puede traer intro hablada o efectos.
- **El archivo descargado tiene la voz.** Es intencional: la alineación de letras
  funciona mucho mejor contra el mix original. El instrumental sale después con
  Demucs.

## Siguiente etapa (no implementada)

1. `demucs --two-stems=vocals` → instrumental
2. letras de LRCLIB → fallback a texto y alineación forzada con WhisperX
3. render de fondo + letras con ffmpeg
4. subida a R2 + upsert en `server/songs.db` con `mode='emo'`
