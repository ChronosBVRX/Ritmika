#!/usr/bin/env python3
"""Genera videos de karaoke a partir del audio descargado.

Tres etapas independientes y cacheables:

    --lyrics   baja el LRC sincronizado de LRCLIB
    --stems    separa voz/instrumental con Demucs (GPU)
    --render   compone fondo + letras ASS + instrumental y exporta MP4

Cada etapa se salta si el resultado ya existe. `--force` la rehace.
"""

import argparse
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
REPORT = SRC / "report.json"

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
        if not row or row.get("status") != "downloaded" or not row.get("file"):
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
        text = lrclib_synced(track["artist"], track["title"], track.get("duration"))
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


# ---------------------------------------------------------------- stems

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


def build_ass(track, lrc_path, audio_duration, out_path):
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
Style: Lyric,{FONT_LYRIC},72,{YELLOW},{WHITE},{INK},&H96000000,-1,0,0,0,100,100,0,0,1,4,4,2,90,90,150,1
Style: Tiny,{FONT_LYRIC},30,{MUTED},{MUTED},{INK},&H96000000,0,0,0,0,100,100,2,0,1,2,2,9,70,70,46,1
Style: Title,{FONT_TITLE},96,{WHITE},{WHITE},{INK},&H96000000,0,0,0,0,100,100,0,0,1,6,6,5,80,80,0,1
Style: Artist,{FONT_TITLE},54,{YELLOW},{YELLOW},{INK},&H96000000,0,0,0,0,100,100,0,0,1,5,5,8,80,80,0,1

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
        "{\\an7\\pos(70,44)}RÍTMIKA"
    )

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

def background():
    path = BUILD / "bg.jpg"
    if path.exists():
        return path
    BUILD.mkdir(parents=True, exist_ok=True)
    source = ROOT / "public" / "assets" / "bg_neon_club.webp"
    cmd = [
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-vf", "scale=2400:1350:force_original_aspect_ratio=increase,crop=2400:1350,"
               "gblur=sigma=28,eq=brightness=-0.22:saturation=1.15",
        "-q:v", "3", str(path),
    ]
    subprocess.run(cmd, check=True)
    return path


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

    bg = background()
    frames = max(1, int(math.ceil(duration * FPS)))
    zoom = "min(1.0+0.0009*on,1.12)"
    vf = (
        f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},"
        f"ass={ass_path}:fontsdir={FONTS}"
    )
    OUT.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", str(bg), "-i", str(instrumental),
        "-filter_complex", f"[0:v]{vf}[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]",
        "-map", "[v]", "-map", "[a]",
        "-t", f"{duration:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)
    size = out_path.stat().st_size / 1e6
    print(f"  {track['id']:14s} {size:5.1f} MB  {out_path.name}")
    return True


# ---------------------------------------------------------------- main

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lyrics", action="store_true")
    parser.add_argument("--stems", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--only", default=None)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not (args.lyrics or args.stems or args.render):
        parser.error("indica al menos una etapa: --lyrics, --stems o --render")

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

    if args.stems:
        print("Stems:")
        separate(tracks, args.force)
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
