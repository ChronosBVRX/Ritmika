#!/usr/bin/env python3
"""Genera videos de karaoke a partir del audio descargado.

Tres etapas independientes y cacheables:

    --lyrics   baja el LRC sincronizado de LRCLIB
    --stems    separa voz/instrumental con Demucs (GPU)
    --render   compone fondo + letras ASS + instrumental y exporta MP4

Cada etapa se salta si el resultado ya existe. `--force` la rehace.
"""

import argparse
import difflib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TOOL_DIR = Path(__file__).resolve().parent
ROOT = TOOL_DIR.parents[1]
MANIFEST = TOOL_DIR / "songs.json"
FONTS = TOOL_DIR / "fonts"

SRC = ROOT / "media" / "karaoke-src"
BUILD = ROOT / "media" / "karaoke-build"
OUT = ROOT / "media" / "karaoke-video"
ALIGNED = BUILD / "aligned"
TRANSCRIPTS = BUILD / "transcripts"
REPORT = SRC / "report.json"

THEMES = {
    "neon": {
        "sung": "&H0000E6FF",
        "unsung": "&H00FFFFFF",
        "outline": "&H00271811",
        "background": ROOT / "public" / "assets" / "bg_neon_club.webp",
        "grade": "gblur=sigma=28,eq=brightness=-0.22:saturation=1.15",
        "fit": "scale=2400:1350:force_original_aspect_ratio=increase,crop=2400:1350",
        "visualizer": False,
        "watermark": "RÍTMIKA",
    },
    "anime": {
        "sung": "&H007F3DFF",
        "unsung": "&H00FFFFFF",
        "outline": "&H00201218",
        "background": ROOT / "public" / "assets" / "menu" / "hero_anime.webp",
        "grade": "gblur=sigma=7,eq=brightness=-0.30:saturation=1.20",
        "fit": "scale=2400:1600:force_original_aspect_ratio=increase,crop=2400:1350",
        "visualizer": True,
        "watermark": "RÍTMIKA · ANIME",
    },
}
THEME = "neon"

DEMUCS_PY = Path("/home/chronos/Escritorio/Comfy/venv/bin/python")
DEMUCS = Path("/home/chronos/Escritorio/Comfy/venv/bin/demucs")


def resolve_demucs():
    override = os.environ.get("RITMIKA_DEMUCS")
    if override:
        return Path(override).expanduser()
    if DEMUCS.exists():
        return DEMUCS
    found = shutil.which("demucs")
    if found:
        return Path(found)
    sys.exit(
        "No encontré demucs. Instálalo en un venv con PyTorch o define "
        "RITMIKA_DEMUCS=/ruta/al/binario"
    )

FPS = 25
WIDTH, HEIGHT = 1920, 1080

FONT_LYRIC = "Fredoka"
FONT_TITLE = "Paytone One"

# ASS: &HAABBGGRR
YELLOW = "&H0000E6FF"
WHITE = "&H00FFFFFF"
INK = "&H00271811"
MUTED = "&H00B4B4B4"


def norm(text):
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", norm(text)).strip("-")[:48]


def load_tracks():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    by_id = {t["id"]: t for t in report["tracks"]}
    tracks = []
    for entry in json.loads(MANIFEST.read_text(encoding="utf-8"))["tracks"]:
        row = by_id.get(entry["id"])
        if not row or row.get("status") not in ("downloaded", "downloaded_low") or not row.get("file"):
            continue
        tracks.append({**entry, "file": Path(row["file"]), "duration": row.get("duration")})
    return tracks


# ---------------------------------------------------------------- lyrics

def lrclib_synced(artist, title, audio_duration=None):
    query = urllib.parse.urlencode({"artist_name": artist, "track_name": title})
    url = f"https://lrclib.net/api/search?{query}"
    for attempt in range(4):
        req = urllib.request.Request(
            url, headers={"User-Agent": "Ritmika-Karaoke-Factory/1.0 (offline asset tool)"}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                items = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 503) and attempt < 3:
                import time
                time.sleep(3 * (attempt + 1))
                continue
            return None
        except Exception:
            return None
    else:
        return None

    candidates = []
    for item in items:
        synced = item.get("syncedLyrics")
        if not synced or not synced.strip():
            continue
        candidates.append((record_score(item, audio_duration), synced))

    if not candidates:
        return None
    candidates.sort(key=lambda pair: pair[0], reverse=True)
    return candidates[0][1]


def record_score(item, audio_duration):
    synced = item.get("syncedLyrics") or ""
    plain = item.get("plainLyrics") or ""
    n_synced = sum(1 for line in synced.splitlines() if line.strip())
    n_plain = sum(1 for line in plain.splitlines() if line.strip())
    duration = item.get("duration")

    score = 0.0

    if duration and audio_duration:
        delta = abs(duration - audio_duration)
        if delta <= 2:
            score += 50
        elif delta <= 5:
            score += 38
        elif delta <= 12:
            score += 18
        else:
            score -= 45

    if n_plain:
        score += 30 * min(1.0, n_synced / n_plain)

    times = []
    for match in re.finditer(r"\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]", synced):
        minutes, seconds, frac = match.groups()
        value = int(minutes) * 60 + int(seconds)
        if frac:
            value += int(frac) / (1000 if len(frac) == 3 else 100)
        times.append(value)
    times.sort()
    gaps = [b - a for a, b in zip(times, times[1:]) if b - a > 35]
    score -= 12 * len(gaps)
    if times and times[0] > max(20, 0.35 * (audio_duration or 200)):
        score -= 10

    return score


def parse_lrc(text):
    pattern = re.compile(r"\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]")
    lines = []
    for raw in text.splitlines():
        stamps = list(pattern.finditer(raw))
        if not stamps:
            continue
        body = pattern.sub("", raw).strip()
        for stamp in stamps:
            minutes, seconds, frac = stamp.groups()
            value = int(minutes) * 60 + int(seconds)
            if frac:
                value += int(frac) / (1000 if len(frac) == 3 else 100)
            lines.append((value, body))
    lines.sort(key=lambda x: x[0])
    return lines


def fetch_lyrics(tracks, force=False):
    target = BUILD / "lyrics"
    target.mkdir(parents=True, exist_ok=True)
    missing = 0
    for track in tracks:
        path = target / f"{track['id']}.lrc"
        if path.exists() and not force:
            continue
        lookup = track.get("lookup") or {}
        text = lrclib_synced(
            lookup.get("artist") or track["artist"],
            lookup.get("title") or track["title"],
            track.get("duration"),
        )
        if not text:
            print(f"  {track['id']:14s} sin letra sincronizada")
            missing += 1
            continue
        path.write_text(text, encoding="utf-8")
        parsed = parse_lrc(text)
        sung = [t for t, body in parsed if body]
        gaps = [b[0] - a[0] for a, b in zip(parsed, parsed[1:]) if b[0] - a[0] > 35]
        warn = f"  ¡{len(gaps)} hueco(s)!" if gaps else ""
        print(f"  {track['id']:14s} {len(sung):3d} líneas{warn}")
    return missing


def group_words(words, max_gap=0.6, max_chars=44):
    lines = []
    current = []
    for word in words:
        text = " ".join(item["w"] for item in current)
        if current and (word["s"] - current[-1]["e"] > max_gap or len(text) > max_chars):
            lines.append(current)
            current = []
        current.append(word)
    if current:
        lines.append(current)
    return lines


def to_lrc(lines):
    out = []
    for words in lines:
        start = words[0]["s"]
        minutes = int(start // 60)
        seconds = start % 60
        text = " ".join(word["w"] for word in words)
        out.append(f"[{minutes:02d}:{seconds:05.2f}] {text}")
    return "\n".join(out) + "\n"


def synthesize_missing(tracks, force=False):
    """Crea un LRC desde la transcripción para las pistas sin letra."""
    (BUILD / "lyrics").mkdir(parents=True, exist_ok=True)
    TRANSCRIPTS.mkdir(parents=True, exist_ok=True)
    model = None
    made = 0
    for track in tracks:
        lrc = BUILD / "lyrics" / f"{track['id']}.lrc"
        if lrc.exists() and not force:
            continue
        cache = TRANSCRIPTS / f"{track['id']}.json"
        if cache.exists() and not force:
            words = json.loads(cache.read_text(encoding="utf-8"))
        else:
            if model is None:
                model = load_aligner()
            try:
                result = model.transcribe(
                    str(track["file"]), language=None,
                    verbose=False, word_timestamps=True,
                )
            except Exception as exc:
                print(f"  {track['id']:14s} falló: {str(exc)[:50]}")
                continue
            words = [
                {"w": w.word.strip(), "s": float(w.start), "e": float(w.end)}
                for segment in result.segments for w in segment.words if w.word.strip()
            ]
            cache.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
        lines = group_words(words)
        if not lines:
            continue
        lrc.write_text(to_lrc(lines), encoding="utf-8")
        made += 1
        print(f"  {track['id']:14s} {len(lines):3d} líneas (transcripción)")

    if model is not None:
        del model
        import gc
        import torch
        gc.collect()
        torch.cuda.empty_cache()
    return made


# ---------------------------------------------------------------- alignment

def norm_token(text):
    return re.sub(r"[^0-9a-záéíóúüñ]", "", text.lower())


def load_aligner():
    try:
        import stable_whisper
    except ImportError:
        sys.exit(
            "Falta stable-ts. Ejecuta este script con el python del venv que lo "
            "tiene instalado (el mismo de demucs), no con el python del sistema."
        )
    model_name = os.environ.get("RITMIKA_WHISPER_MODEL", "medium")
    device = os.environ.get("RITMIKA_WHISPER_DEVICE", "cuda")
    return stable_whisper.load_model(
        model_name, device=device, download_root=os.environ.get("RITMIKA_WHISPER_DIR")
    )


def line_similarity(tokens, words):
    a = " ".join(norm_token(t) for t in tokens)
    b = " ".join(norm_token(w) for w in words)
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()


def vocal_envelope(track, sr=16000, window=0.02):
    import numpy as np

    vocals = stem_dir(track) / "vocals.wav"
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(vocals), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
        capture_output=True,
    ).stdout
    signal = np.frombuffer(raw, dtype=np.float32)
    size = int(sr * window)
    frames = len(signal) // size
    energy = np.sqrt((signal[: frames * size].reshape(frames, size) ** 2).mean(axis=1) + 1e-12)
    return 20 * np.log10(energy + 1e-9), window


def estimate_shift(starts, duration, envelope, window):
    """Desfase global que mejor alinea las líneas del LRC con la voz audible."""
    import numpy as np

    total = len(envelope)
    activity = np.zeros(total, dtype=bool)
    for index, moment in enumerate(starts):
        following = starts[index + 1] if index + 1 < len(starts) else duration
        span = min(2.0, max(0.4, following - moment))
        begin = int(max(0, moment / window))
        finish = int(min(total, (moment + span) / window))
        if finish > begin:
            activity[begin:finish] = True

    steps = int(round(40 / window))
    stride = max(1, int(round(0.1 / window)))
    best = (0.0, -1e9)
    for lag in range(-steps, steps + 1, stride):
        mask = np.roll(activity, lag)
        if lag > 0:
            mask[:lag] = False
        elif lag < 0:
            mask[lag:] = False
        if mask.sum() < total * 0.05:
            continue
        score = envelope[mask].mean() - envelope[~mask].mean()
        if score > best[1]:
            best = (lag * window, float(score))
    return best[0]


def align_lines(lines, heard, starts, duration, prior=0.0, min_score=0.85):
    """La letra manda; Whisper solo detecta si el audio es otra versión.

    El desfase se estima con las tres primeras líneas, que suelen ser únicas y
    no se repiten como los coros. Se exige que al menos dos coincidan en ±3 s;
    si no hay consenso, se usa el LRC tal cual. Ninguna línea se descarta.
    """
    import bisect

    times_heard = [item[1] for item in heard]
    deltas = []

    for index in range(min(3, len(lines))):
        tokens = [token for token in lines[index].split() if token]
        count = len(tokens)
        if not count:
            continue
        left = bisect.bisect_left(times_heard, max(0.0, starts[index] - 35.0))
        right = bisect.bisect_right(times_heard, min(duration, starts[index] + 35.0))
        if right - left < 2:
            continue

        best = (0.0, left)
        longest = int(count * 1.5) + 4
        shortest = max(1, int(count * 0.55))
        for start in range(left, right):
            limit = min(len(heard) - start, longest)
            for length in range(shortest, limit + 1):
                if heard[start + length - 1][1] > starts[index] + 35.0:
                    break
                value = line_similarity(
                    tokens, [heard[j][0] for j in range(start, start + length)]
                )
                if value > best[0]:
                    best = (value, start)
        score, start = best
        if score >= min_score:
            deltas.append(heard[start][1] - starts[index])

    shift = prior
    ordered = sorted(deltas)
    for left_value, right_value in zip(ordered, ordered[1:]):
        if right_value - left_value <= 3.0:
            shift = (left_value + right_value) / 2
            break

    times = [max(0.0, moment + shift) for moment in starts]
    for index in range(1, len(times)):
        if times[index] <= times[index - 1]:
            times[index] = times[index - 1] + 0.35

    records = []
    for index, line in enumerate(lines):
        tokens = [token for token in line.split() if token]
        if not tokens:
            continue
        begin = times[index]
        following = times[index + 1] if index + 1 < len(lines) else duration
        finish = max(begin + 0.4, min(following, begin + 8.0))
        records.append({
            "start": round(begin, 3),
            "end": round(finish, 3),
            "words": distribute_words(tokens, begin, finish),
            "score": 0,
        })

    return records, len(deltas) / 3.0, len(deltas)


def distribute_words(tokens, start, end):
    weights = [max(1, syllables(t)) for t in tokens]
    total = sum(weights) or 1
    words = []
    clock = start
    for token, weight in zip(tokens, weights):
        span = max(0.05, (end - start) * weight / total)
        words.append({"w": token, "s": round(clock, 3), "e": round(clock + span, 3)})
        clock += span
    return words


def lrc_records(parsed, shift, duration):
    records = []
    for index, (moment, text) in enumerate(parsed):
        following = parsed[index + 1][0] if index + 1 < len(parsed) else duration
        start = max(0.0, moment + shift)
        end = min(duration, following + shift)
        if end <= start:
            end = start + 0.6
        tokens = [token for token in text.split() if token]
        if not tokens:
            continue
        records.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "words": distribute_words(tokens, start, end),
            "score": 0,
        })
    return records


def align_tracks(tracks, force=False):
    """Transcribe el audio y pega la letra sobre lo que de verdad se canta.

    No usa forced alignment: si el audio es otra version (mas intro, otro
    master), forzar el texto produce basura. Transcribir primero y emparejar
    despues tolera versiones distintas y detecta lineas que no se cantan.
    """
    ALIGNED.mkdir(parents=True, exist_ok=True)
    TRANSCRIPTS.mkdir(parents=True, exist_ok=True)
    pending = []
    for track in tracks:
        out = ALIGNED / f"{track['id']}.json"
        lrc = BUILD / "lyrics" / f"{track['id']}.lrc"
        if out.exists() and not force:
            continue
        if not lrc.exists() or not Path(track["file"]).exists():
            continue
        pending.append((track, out, lrc))

    if not pending:
        print("  alineación ya lista")
        return

    model = load_aligner()
    for track, out, lrc in pending:
        parsed = [(start, text) for start, text in parse_lrc(lrc.read_text(encoding="utf-8")) if text]
        if not parsed:
            continue
        lines = [text for _, text in parsed]

        cache = TRANSCRIPTS / f"{track['id']}.json"
        if cache.exists() and not force:
            heard = [(w["w"], w["s"], w["e"]) for w in json.loads(cache.read_text(encoding="utf-8"))]
        else:
            try:
                result = model.transcribe(
                    str(track["file"]), language="es", verbose=False, word_timestamps=True
                )
            except Exception as exc:
                print(f"  {track['id']:14s} falló: {str(exc)[:60]}")
                continue
            heard = [
                (word.word.strip(), float(word.start), float(word.end))
                for segment in result.segments for word in segment.words
                if word.word.strip()
            ]
            cache.write_text(
                json.dumps([{"w": w, "s": s, "e": e} for w, s, e in heard], ensure_ascii=False),
                encoding="utf-8",
            )

        if not heard:
            continue

        duration = track.get("duration") or (heard[-1][2] + 1)
        records, ratio, anchors = align_lines(
            lines, heard, [start for start, _ in parsed], duration, 0.0
        )

        out.write_text(
            json.dumps({"lines": records}, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        drift = records[0]["start"] - parsed[0][0]
        print(
            f"  {track['id']:14s} {len(records):3d}/{len(lines):3d} líneas · "
            f"ancladas {anchors:2d} · desfase {drift:+.1f}s"
        )

    del model
    import gc
    import torch
    gc.collect()
    torch.cuda.empty_cache()


def match_timings(mine, heard):
    """Empareja tokens propios con palabras detectadas; interpola los huecos."""
    ours = [norm_token(token) for _, token in mine]
    theirs = [norm_token(word) for word, _, _ in heard]
    timings = [None] * len(ours)

    matcher = difflib.SequenceMatcher(None, ours, theirs, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for offset in range(i2 - i1):
                _, start, end = heard[j1 + offset]
                timings[i1 + offset] = (start, end)

    known = [i for i, value in enumerate(timings) if value]
    if not known:
        return timings

    for left, right in zip(known, known[1:]):
        if right - left == 1:
            continue
        if mine[left][0] != mine[right][0]:
            continue
        start = timings[left][1]
        end = timings[right][0]
        step = (end - start) / (right - left)
        for offset in range(1, right - left):
            timings[left + offset] = (start + step * (offset - 1), start + step * offset)

    return timings



def stem_dir(track):
    return BUILD / "stems" / "htdemucs" / Path(track["file"]).stem


def separate(tracks, force=False):
    pending = [t for t in tracks if force or not (stem_dir(t) / "no_vocals.wav").exists()]
    if not pending:
        print("  stems ya listos")
        return
    BUILD.joinpath("stems").mkdir(parents=True, exist_ok=True)
    batch = pending[:12]
    cmd = [
        str(resolve_demucs()), "--two-stems=vocals", "-n", "htdemucs",
        "--device", os.environ.get("RITMIKA_DEMUCS_DEVICE", "cuda"),
        "-o", str(BUILD / "stems"),
    ] + [str(t["file"]) for t in batch]
    print(f"  demucs: {len(batch)} pistas…", flush=True)
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if len(pending) > len(batch):
        separate(tracks, force)


# ---------------------------------------------------------------- ass

def ass_time(value):
    if value < 0:
        value = 0
    hours = int(value // 3600)
    minutes = int((value % 3600) // 60)
    seconds = value % 60
    return f"{hours}:{minutes:02d}:{seconds:05.2f}"


def syllables(word):
    groups = re.findall(r"[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]+", word)
    return max(1, len(groups))


def clean_text(text):
    return text.replace("{", "(").replace("}", ")").replace("\\", "/").strip()


def karaoke_line(start, end, text):
    words = [w for w in text.split() if w]
    if not words:
        return None
    weights = [syllables(w) for w in words]
    total = sum(weights)
    gap = max(0.4, end - start)
    natural = max(0.9, 0.30 * total)
    wipe = min(gap, natural)
    budget = int(round(wipe * 100))
    chunks = []
    used = 0
    for index, (word, weight) in enumerate(zip(words, weights)):
        if index == len(words) - 1:
            cs = max(1, budget - used)
        else:
            cs = max(1, int(round(budget * weight / total)))
            used += cs
        chunks.append(f"{{\\k{cs}}}{clean_text(word)} ")
    return "".join(chunks).rstrip()


def karaoke_words(words):
    chunks = []
    for index, word in enumerate(words):
        if index + 1 < len(words):
            span = words[index + 1]["s"] - word["s"]
        else:
            span = word["e"] - word["s"]
        cs = max(6, int(round(span * 100)))
        chunks.append(f"{{\\k{cs}}}{clean_text(word['w'])} ")
    return "".join(chunks).rstrip()


def build_ass(track, lrc_path, audio_duration, out_path):
    theme = THEMES[THEME]
    sung, unsung, ink = theme["sung"], theme["unsung"], theme["outline"]
    lines = parse_lrc(lrc_path.read_text(encoding="utf-8"))
    if not lines:
        return False

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {WIDTH}
PlayResY: {HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Lyric,{FONT_LYRIC},64,{sung},{unsung},{ink},&H96000000,-1,0,0,0,100,100,0,0,1,4,4,2,90,90,0,1
Style: Next,{FONT_LYRIC},50,&H00DCDCDC,&H00DCDCDC,{ink},&H96000000,0,0,0,0,100,100,0,0,1,3,3,2,90,90,0,1
Style: Prev,{FONT_LYRIC},44,&H008C8C8C,&H008C8C8C,{ink},&H96000000,0,0,0,0,100,100,0,0,1,3,3,2,90,90,0,1
Style: Tiny,{FONT_LYRIC},30,{MUTED},{MUTED},{ink},&H96000000,0,0,0,0,100,100,2,0,1,2,2,9,70,70,46,1
Style: Title,{FONT_TITLE},96,{unsung},{unsung},{ink},&H96000000,0,0,0,0,100,100,0,0,1,6,6,5,80,80,0,1
Style: Artist,{FONT_TITLE},54,{sung},{sung},{ink},&H96000000,0,0,0,0,100,100,0,0,1,5,5,8,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []

    events.append(
        f"Dialogue: 1,{ass_time(0)},{ass_time(4.6)},Title,,0,0,0,,"
        f"{{\\an5\\pos(960,430)\\fad(500,700)}}{clean_text(track['title'])}"
    )
    events.append(
        f"Dialogue: 1,{ass_time(0)},{ass_time(4.6)},Artist,,0,0,0,,"
        f"{{\\an5\\pos(960,540)\\fad(500,700)}}{clean_text(track['artist'])}"
    )
    events.append(
        f"Dialogue: 1,{ass_time(0)},{ass_time(4.6)},Tiny,,0,0,0,,"
        f"{{\\an5\\pos(960,640)\\fad(500,700)}}K A R A O K E"
    )
    events.append(
        f"Dialogue: 0,{ass_time(0)},{ass_time(audio_duration)},Tiny,,0,0,0,,"
        "{\\an7\\pos(70,44)}" + theme["watermark"]
    )

    aligned_path = ALIGNED / f"{track['id']}.json"
    aligned = None
    if aligned_path.exists():
        try:
            aligned = json.loads(aligned_path.read_text(encoding="utf-8")).get("lines") or None
        except json.JSONDecodeError:
            aligned = None

    if aligned:
        for index, line in enumerate(aligned):
            start = line["start"]
            next_start = aligned[index + 1]["start"] if index + 1 < len(aligned) else audio_duration
            display_end = min(max(line["end"] + 0.6, start + 0.8), next_start)
            body = karaoke_words(line["words"])
            if not body:
                continue
            events.append(
                f"Dialogue: 0,{ass_time(start)},{ass_time(display_end)},Lyric,,0,0,0,,"
                f"{{\\an2\\pos(960,890)\\fad(90,160)}}{body}"
            )
            if index + 1 < len(aligned):
                following = " ".join(word["w"] for word in aligned[index + 1]["words"])
                events.append(
                    f"Dialogue: 0,{ass_time(start)},{ass_time(next_start)},Next,,0,0,0,,"
                    f"{{\\an2\\pos(960,975)\\fad(140,160)}}{clean_text(following)}"
                )
            if index > 0:
                previous = " ".join(word["w"] for word in aligned[index - 1]["words"])
                events.append(
                    f"Dialogue: 0,{ass_time(start)},{ass_time(next_start)},Prev,,0,0,0,,"
                    f"{{\\an2\\pos(960,800)\\fad(160,140)}}{clean_text(previous)}"
                )
    else:
        for index, (start, text) in enumerate(lines):
            end = lines[index + 1][0] if index + 1 < len(lines) else audio_duration
            end = min(end, audio_duration)
            if end <= start:
                end = start + 1.0
            body = karaoke_line(start, end, text)
            if not body:
                continue
            display_end = min(end, start + max(1.2, 0.30 * sum(syllables(w) for w in text.split())) + 2.2)
            events.append(
                f"Dialogue: 0,{ass_time(start)},{ass_time(display_end)},Lyric,,0,0,0,,"
                f"{{\\fad(120,220)}}{body}"
            )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return True


# ---------------------------------------------------------------- render

def background(theme):
    path = BUILD / f"bg_{THEME}.jpg"
    if path.exists():
        return path
    BUILD.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-v", "error", "-i", str(theme["background"]),
        "-vf", f"{theme['fit']},{theme['grade']}",
        "-q:v", "3", str(path),
    ]
    subprocess.run(cmd, check=True)
    return path


def probe(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    try:
        return {"duration": float(result.stdout.strip())}
    except ValueError:
        return {}


def render(track, force=False):
    ass_path = BUILD / "ass" / f"{track['id']}.ass"
    out_path = OUT / f"{track['id']}__{slug(track['artist'])}__{slug(track['title'])}.mp4"
    if out_path.exists() and not force:
        print(f"  {track['id']:14s} ya existe")
        return True

    lrc = BUILD / "lyrics" / f"{track['id']}.lrc"
    instrumental = stem_dir(track) / "no_vocals.wav"
    if not lrc.exists():
        print(f"  {track['id']:14s} sin letra, se omite")
        return False
    if not instrumental.exists():
        print(f"  {track['id']:14s} sin instrumental, se omite")
        return False

    duration = track.get("duration") or 0
    if not build_ass(track, lrc, duration, ass_path):
        print(f"  {track['id']:14s} LRC vacío, se omite")
        return False

    theme = THEMES[THEME]
    bg = background(theme)
    frames = max(1, int(math.ceil(duration * FPS)))
    zoom = "min(1.0+0.0009*on,1.12)"
    vf = (
        f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},"
        f"ass={ass_path}:fontsdir={FONTS}"
    )
    OUT.mkdir(parents=True, exist_ok=True)
    if theme["visualizer"]:
        graph = (
            f"[0:v]{vf}[base];"
            f"[1:a]showwaves=s=1920x70:mode=cline:colors=0xFF3D7F:rate={FPS},"
            f"format=rgba,colorchannelmixer=aa=0.55[wave];"
            f"[base][wave]overlay=0:1006:shortest=1[v];"
            f"[1:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]"
        )
    else:
        graph = f"[0:v]{vf}[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]"

    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", str(bg), "-i", str(instrumental),
        "-filter_complex", graph,
        "-map", "[v]", "-map", "[a]",
        "-t", f"{duration:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)

    actual = probe(out_path).get("duration") or 0
    if duration and abs(actual - duration) > 0.6:
        print(f"  {track['id']:14s} salida corta ({actual:.1f}s vs {duration:.1f}s), reintentando")
        subprocess.run(cmd, check=True)
        actual = probe(out_path).get("duration") or 0
        if abs(actual - duration) > 0.6:
            print(f"  {track['id']:14s} sigue corta ({actual:.1f}s), revisar")
            return False

    size = out_path.stat().st_size / 1e6
    print(f"  {track['id']:14s} {size:5.1f} MB  {out_path.name}")
    return True


# ---------------------------------------------------------------- main

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lyrics", action="store_true")
    parser.add_argument("--synth", action="store_true")
    parser.add_argument("--stems", action="store_true")
    parser.add_argument("--align", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--only", default=None)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--src", default=None)
    parser.add_argument("--build", default=None)
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--manifest", default=None)
    parser.add_argument("--theme", default="neon")
    args = parser.parse_args()

    if not (args.lyrics or args.synth or args.stems or args.align or args.render):
        parser.error("indica al menos una etapa: --lyrics, --stems, --align o --render")

    global SRC, BUILD, OUT, ALIGNED, TRANSCRIPTS, REPORT, MANIFEST, THEME
    if args.src:
        SRC = Path(args.src).expanduser().resolve()
    if args.build:
        BUILD = Path(args.build).expanduser().resolve()
    if args.out_dir:
        OUT = Path(args.out_dir).expanduser().resolve()
    if args.manifest:
        MANIFEST = Path(args.manifest).expanduser().resolve()
    ALIGNED = BUILD / "aligned"
    TRANSCRIPTS = BUILD / "transcripts"
    REPORT = SRC / "report.json"
    THEME = args.theme
    if THEME not in THEMES:
        parser.error(f"tema desconocido: {THEME}")

    tracks = load_tracks()
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        tracks = [t for t in tracks if t["id"] in wanted]
    if args.limit:
        tracks = tracks[: args.limit]
    print(f"{len(tracks)} pistas\n")

    if args.lyrics:
        print("Letras:")
        missing = fetch_lyrics(tracks, args.force)
        print(f"  {missing} sin letra sincronizada\n")

    if args.synth:
        print("Letras desde transcripción:")
        synthesize_missing(tracks, args.force)
        print()

    if args.stems:
        print("Stems:")
        separate(tracks, args.force)
        print()

    if args.align:
        print("Alineación:")
        align_tracks(tracks, args.force)
        print()

    if args.render:
        ready = [t for t in tracks if (BUILD / "lyrics" / f"{t['id']}.lrc").exists()]
        print(f"Render: {len(ready)} pistas con letra")
        ok = 0
        for track in ready:
            if render(track, args.force):
                ok += 1
        print(f"\n{ok} videos en {OUT}")


if __name__ == "__main__":
    main()
