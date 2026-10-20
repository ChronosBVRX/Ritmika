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

## Siguiente etapa — videos de karaoke

`render_karaoke.py` hace las cuatro etapas siguientes, cada una cacheable:

```bash
python3 tools/karaoke-factory/render_karaoke.py --lyrics          # LRCLIB → media/karaoke-build/lyrics
python3 tools/karaoke-factory/render_karaoke.py --stems           # Demucs → instrumental
python3 tools/karaoke-factory/render_karaoke.py --align           # Whisper → tiempos por palabra
python3 tools/karaoke-factory/render_karaoke.py --stems --render  # todo
python3 tools/karaoke-factory/render_karaoke.py --render --only pxndx-01
```

Las etapas `--stems` y `--align` necesitan el **python del venv** que tiene
torch/demucs/stable-ts, no el del sistema:

```bash
~/Comfy/venv/bin/python tools/karaoke-factory/render_karaoke.py --align
```

Salida: `media/karaoke-video/<id>__<artista>__<título>.mp4` (1920×1080, H.264 + AAC).

### La receta (aprendida a golpes)

1. **El audio y la letra tienen que ser la misma versión.** Es el error que más
   caro sale. `Cita en el quirófano` se bajó del video oficial (271 s, con un
   sketch de 23 s) mientras el LRC venía del álbum (243 s). Ningún alineador
   arregla eso: hay que emparejar versiones antes de tocar la letra.
2. **Nunca forzar el texto contra el audio.** El *forced alignment* de Whisper
   coloca todas las palabras aunque no existan en el audio, y el resultado se ve
   sincronizado en el papel pero es basura (una palabra estirada 37 s).
3. **Transcribir primero, emparejar después.** Whisper devuelve cuándo se canta
   cada palabra que reconoce; luego se pega la letra canónica sobre esa
   transcripción con `difflib`. Si el audio tiene intro, sketch o outro, el
   desfase se absorbe solo.
4. **Medir el emparejamiento.** Si menos del 55% de las palabras de la letra
   encuentran pareja en la transcripción, la canción no es viable con esa
   transcripción: se conserva el LRC, corregido por la mediana del desfase de las
   líneas que sí empataron con alta confianza (y solo si esa mediana es menor a
   8 s). Un desplazamiento global pequeño se corrige; uno grande es señal de que
   el emparejamiento no es confiable y no se toca.
5. **Descartar lo que no se canta.** Las líneas sin palabras emparejadas no se
   muestran. Es preferible un hueco a una línea inventada.
6. **Verificar antes de renderizar.** Un frame en el segundo donde debe entrar
   la primera línea cuesta 2 segundos y evita 40 minutos de render a ciegas.

## Cómo se arma el video

1. **Letras**: se elige el LRC de LRCLIB que mejor puntúa por cercanía de duración,
   completitud contra la letra plana y ausencia de huecos mayores a 35 s. Hay hasta
   16 versiones por canción y muchas tienen los timestamps corridos.
2. **Instrumental**: `demucs --two-stems=vocals`. Se conserva `vocals.wav` por si
   luego se quiere una pista guía.
3. **Alineación**: Whisper transcribe el audio con timestamps por palabra; la
   letra canónica se pega línea por línea sobre esa transcripción con `difflib`
   (`--align`). Si el emparejamiento baja del 55%, se conserva el LRC con el
   desfase medido en las líneas de alta confianza.
4. **Karaoke**: cada palabra recibe un `\k` igual a su duración real y la línea se
   oculta 0.6 s después de la última. Si no hay alineación, cae al reparto por
   sílabas del LRC.
5. **Fondo**: `bg_neon_club.webp` con blur y oscurecido, más un zoom lento.

### Requisitos extra

- `demucs` y `stable-ts` en un venv con PyTorch. La ruta de demucs se detecta sola
  en `/home/chronos/Escritorio/Comfy/venv/bin/demucs` o se define con
  `RITMIKA_DEMUCS`; el dispositivo con `RITMIKA_DEMUCS_DEVICE` (`cuda` por defecto).
- El modelo de Whisper se elige con `RITMIKA_WHISPER_MODEL` (`medium` por defecto;
  `large-v3` no cabe si ComfyUI ya ocupa 6 GB de la GPU) y la caché con
  `RITMIKA_WHISPER_DIR`.
- Fuentes: `fonts/Fredoka-Bold.ttf` es una instancia estática generada desde la
  variable de Google Fonts (fontconfig no resuelve la variable y libass caía a
  Noto Sans). `PaytoneOne-Regular.ttf` viene directo del repo de Google Fonts.
  Ambas son OFL.

### Limitaciones conocidas

- La alineación depende de que Whisper entienda la letra cantada. En mixes muy
  densos o con coros encimados baja el porcentaje de emparejamiento y se nota.
  El log imprime ese porcentaje por canción: por debajo de 75% conviene revisar.
- Dos pistas del lote (`thermo-02`, `delux-02`) no tienen LRC sincronizado en
  LRCLIB. Se omiten del render hasta resolverlas.
- El video no trae barra de progreso ni cuenta atrás.
