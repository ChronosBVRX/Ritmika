#!/usr/bin/env python3
"""Busca, puntúa y descarga el audio original de un lote de canciones.

La búsqueda y la descarga usan clientes distintos de YouTube: el buscador
necesita `player_client=tv`, la extracción de formatos necesita el cliente
por defecto. Mezclarlos rompe una de las dos mitades.
"""

import argparse
import json
import math
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TOOL_DIR = Path(__file__).resolve().parent
ROOT = TOOL_DIR.parents[1]
MANIFEST = TOOL_DIR / "songs.json"
DEFAULT_OUT = ROOT / "media" / "karaoke-src"
DB = ROOT / "server" / "songs.db"

ACCEPT = 55.0
REVIEW = 38.0

STOPWORDS = {
    "el", "la", "los", "las", "un", "una", "de", "del", "que", "en", "a", "al",
    "y", "o", "por", "para", "con", "sin", "mi", "me", "te", "se", "lo", "su",
    "es", "son", "the", "of", "to", "and",
}

PENALTIES = [
    (r"\bcover\b", -30.0),
    (r"\ben vivo\b|\blive\b|\bdirecto\b", -25.0),
    (r"\binstrumental\b|\bkaraoke\b|\bplayback\b|\bpista\b", -25.0),
    (r"\breaction\b", -30.0),
    (r"\btutorial\b|\bc[oó]mo tocar\b|\bcomo tocar\b|\bguitar\b|\bpiano\b|\bbater[ií]a\b", -25.0),
    (r"\bremix\b|\bmix\b", -20.0),
    (r"\bsped up\b|\bslowed\b|\bnightcore\b|\breverb\b|\b8d\b", -30.0),
    (r"\bmashup\b|\bparodia\b|\bparody\b|\bsample\b", -25.0),
    (r"\bfull album\b|\b[aá]lbum completo\b|\balbum completo\b", -20.0),
    (r"\b1 hour\b|\bloop\b|\bextended\b|\b10 hours\b", -25.0),
]

BONUSES = [
    (r"\boficial\b|\bofficial\b", 4.0),
    (r"\baudio\b", 3.0),
    (r"\bletra\b|\blyrics?\b", 2.0),
    (r"\bvideo\b", 2.0),
]


def norm(text):
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def tokens(text):
    return [t for t in norm(text).split() if t not in STOPWORDS and len(t) > 1]


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", norm(text)).strip("-")[:48]


def score_candidate(cand, artist, title, ref_duration=None, min_duration=None):
    c_title = cand.get("title") or ""
    c_channel = cand.get("channel") or cand.get("uploader") or ""
    duration = cand.get("duration")
    views = cand.get("view_count") or 0

    t_title = norm(c_title)
    t_artist = norm(artist)
    t_channel = norm(c_channel)

    want = tokens(title)
    got = set(norm(c_title).split())
    recall = (sum(1 for t in want if t in got) / len(want)) if want else 0.0

    score = 40.0 * recall

    artist_hit = bool(t_artist) and (t_artist in t_title or t_artist in t_channel)
    if artist_hit:
        score += 20.0

    if t_channel == t_artist or t_channel.endswith(" topic") or t_artist in t_channel:
        score += 15.0

    for pattern, weight in BONUSES:
        if re.search(pattern, t_title):
            score += weight

    for pattern, weight in PENALTIES:
        if re.search(pattern, t_title):
            score += weight

    score += min(6.0, math.log10(views + 1) * 1.1)

    if duration is None:
        score -= 10.0
    elif duration < 80 or duration > 420:
        score -= 40.0
    elif min_duration and duration < min_duration:
        score -= 25.0

    if ref_duration and duration:
        delta = abs(duration - ref_duration)
        if delta <= 6:
            score += 12.0
        elif delta > 25:
            score -= 10.0

    return round(score, 1), recall, artist_hit


def resolve_ytdlp():
    for candidate in (os.environ.get("YTDLP"), "yt-dlp"):
        if not candidate:
            continue
        path = shutil.which(candidate) or (candidate if Path(candidate).is_file() else None)
        if not path:
            continue
        try:
            out = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=30)
        except Exception:
            continue
        version = out.stdout.strip()
        year = version[:4]
        if year.isdigit() and int(year) < 2025:
            print(f"  aviso: {path} es {version}; YouTube ya no responde bien a versiones viejas", file=sys.stderr)
        return path, version
    sys.exit("No encontré yt-dlp. Instala uno reciente o define YTDLP=/ruta/al/binario")


def search(ytdlp, query, limit=8):
    cmd = [
        ytdlp, "-J", "--flat-playlist", "--no-warnings",
        "--extractor-args", "youtube:player_client=tv",
        f"ytsearch{limit}:{query}",
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        return []
    if out.returncode != 0 or not out.stdout.strip():
        return []
    try:
        data = json.loads(out.stdout)
    except json.JSONDecodeError:
        return []
    return [e for e in (data.get("entries") or []) if e.get("id")]


def download(ytdlp, video_id, out_dir, stem):
    template = str(out_dir / f"{stem}.%(ext)s")
    cmd = [
        ytdlp, "--no-warnings", "--no-progress", "--newline",
        "-f", "bestaudio/best",
        "--download-archive", str(out_dir / ".archive.txt"),
        "-o", template,
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        return None, "timeout"
    if out.returncode != 0:
        tail = (out.stderr or out.stdout).strip().splitlines()
        return None, tail[-1] if tail else "error desconocido"
    matches = sorted(out_dir.glob(f"{stem}.*"))
    matches = [m for m in matches if m.suffix not in (".txt", ".part")]
    if not matches:
        return None, "sin archivo resultante"
    return matches[0], None


def probe(path):
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,format_name,bit_rate",
        "-of", "json", str(path),
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        fmt = json.loads(out.stdout).get("format", {})
    except Exception:
        return {}
    return {
        "format": fmt.get("format_name"),
        "duration": round(float(fmt.get("duration") or 0), 1),
        "bitrate": int(fmt.get("bit_rate") or 0),
    }


def db_titles():
    if not DB.exists():
        return set()
    try:
        with sqlite3.connect(f"file:{DB}?mode=ro", uri=True) as conn:
            rows = conn.execute("SELECT title FROM songs").fetchall()
    except sqlite3.Error:
        return set()
    return {norm(r[0]) for r in rows}


def lrclib(artist, title):
    query = urllib.parse.urlencode({"artist_name": artist, "track_name": title})
    url = f"https://lrclib.net/api/search?{query}"
    for attempt in range(3):
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Ritmika-Karaoke-Factory/1.0 (offline asset tool)"},
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                items = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < 2:
                time.sleep(2.5 * (attempt + 1))
                continue
            return {"status": "error", "detail": f"HTTP {exc.code}"}
        except Exception as exc:
            if attempt < 2:
                time.sleep(1.5)
                continue
            return {"status": "error", "detail": str(exc)[:80]}
    else:
        return {"status": "error", "detail": "sin respuesta"}

    if not items:
        return {"status": "none"}

    synced = [i for i in items if i.get("syncedLyrics")]
    plain = [i for i in items if i.get("plainLyrics")]
    if synced:
        return {"status": "synced", "count": len(synced), "duration": synced[0].get("duration")}
    if plain:
        return {"status": "plain", "count": len(plain), "duration": plain[0].get("duration")}
    return {"status": "none"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.environ.get("RITMIKA_KARAOKE_DIR", str(DEFAULT_OUT)))
    parser.add_argument("--manifest", default=str(MANIFEST))
    parser.add_argument("--only", default=None, help="ids separados por coma")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-lyrics", action="store_true")
    args = parser.parse_args()

    out_dir = Path(args.out).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    tracks = manifest["tracks"]
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        tracks = [t for t in tracks if t["id"] in wanted]

    ytdlp, version = resolve_ytdlp()
    print(f"yt-dlp {version}")
    print(f"salida: {out_dir}")
    print(f"lote:   {manifest['batch']} ({len(tracks)} pistas)\n")

    known = db_titles()
    report_path = out_dir / "report.json"
    previous = {}
    if report_path.exists():
        try:
            for row in json.loads(report_path.read_text(encoding="utf-8")).get("tracks", []):
                previous[row["id"]] = row
        except (json.JSONDecodeError, KeyError):
            previous = {}
    results = []

    for index, track in enumerate(tracks, 1):
        tid, artist, title = track["id"], track["artist"], track["title"]
        query = track.get("search") or f"{artist} {title}"
        existing = sorted(
            p for p in out_dir.glob(f"{tid}__*")
            if p.suffix not in (".txt", ".part")
        )

        record = {
            "id": tid, "artist": artist, "title": title, "query": query,
            "in_db": norm(title) in known,
            "status": "pending", "score": None, "chosen": None,
            "candidates": [],
        }

        lyrics = {} if args.no_lyrics else lrclib(artist, title)
        if lyrics:
            record["lyrics"] = lyrics
        ref = lyrics.get("duration")

        if existing:
            info = probe(existing[0])
            prior = previous.get(tid, {})
            record.update({
                "status": "downloaded", "reused": True, "file": str(existing[0]),
                "duration": info.get("duration"), "format": info.get("format"),
                "score": prior.get("score"),
                "chosen": prior.get("chosen"),
            })
            results.append(record)
            print(f"[{index:02d}/{len(tracks)}] {tid:14s} ya existe")
            continue

        forced = track.get("video")
        if forced:
            stem = f"{tid}__{slug(artist)}__{slug(title)}"
            path, error = download(ytdlp, forced, out_dir, stem)
            if not path:
                record["status"] = "error"
                record["detail"] = error
                results.append(record)
                print(f" forzado {forced}: {error}")
                continue
            info = probe(path)
            record.update({
                "status": "downloaded",
                "file": str(path),
                "duration": info.get("duration"),
                "format": info.get("format"),
                "chosen": {"id": forced, "title": "(fijado a mano)", "channel": "",
                           "duration": info.get("duration"), "score": 0},
            })
            results.append(record)
            print(f" forzado {forced}  {info.get('duration', '?'):>5}s")
            continue

        print(f"[{index:02d}/{len(tracks)}] {tid:14s} buscando…", end="", flush=True)
        candidates = search(ytdlp, query)
        if not candidates:
            record["status"] = "no_results"
            results.append(record)
            print(" sin resultados")
            continue

        scored = []
        for cand in candidates:
            value, recall, artist_hit = score_candidate(cand, artist, title, ref, track.get("min_duration"))
            scored.append({
                "id": cand["id"],
                "title": cand.get("title"),
                "channel": cand.get("channel") or cand.get("uploader"),
                "duration": cand.get("duration"),
                "views": cand.get("view_count"),
                "score": value,
                "recall": round(recall, 2),
                "artist_hit": artist_hit,
            })
        scored.sort(key=lambda c: c["score"], reverse=True)
        best = scored[0]
        record["candidates"] = scored[:5]
        record["score"] = best["score"]
        record["chosen"] = best

        if args.dry_run:
            record["status"] = "would_download" if best["score"] >= ACCEPT else "review"
            results.append(record)
            print(f" {best['score']:5.1f}  {best['title'][:58]}")
            continue

        if best["score"] < REVIEW:
            record["status"] = "review"
            results.append(record)
            print(f" {best['score']:5.1f}  descartado, requiere revisión")
            continue

        stem = f"{tid}__{slug(artist)}__{slug(title)}"
        path, error = download(ytdlp, best["id"], out_dir, stem)
        if not path:
            record["status"] = "error"
            record["detail"] = error
            results.append(record)
            print(f" {best['score']:5.1f}  falló: {error}")
            continue

        info = probe(path)
        record.update({
            "status": "downloaded" if best["score"] >= ACCEPT else "downloaded_low",
            "file": str(path),
            "duration": info.get("duration"),
            "format": info.get("format"),
            "bitrate": info.get("bitrate"),
        })
        results.append(record)
        print(f" {best['score']:5.1f}  {info.get('duration', '?'):>5}s  {best['title'][:52]}")

        if not args.no_lyrics:
            time.sleep(0.25)

    merged = dict(previous)
    for row in results:
        merged[row["id"]] = row
    order = {t["id"]: i for i, t in enumerate(manifest["tracks"])}
    results = sorted(merged.values(), key=lambda r: order.get(r["id"], 999))

    report_path.write_text(
        json.dumps({"batch": manifest["batch"], "tracks": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    write_markdown(out_dir / "report.md", results)

    downloaded = [r for r in results if r["status"].startswith("downloaded")]
    review = [r for r in results if r["status"] in ("review", "no_results", "error")]
    print(f"\n{len(downloaded)} descargadas · {len(review)} por revisar · {out_dir/'report.md'}")


def write_markdown(path, results):
    lines = [
        "| id | artista | canción | estado | score | dur | audio elegido | canal | letra |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    labels = {
        "downloaded": "ok", "downloaded_low": "ok?", "already": "existía",
        "review": "REVISAR", "no_results": "sin resultados", "error": "ERROR",
        "pending": "-", "would_download": "dry",
    }
    for r in results:
        chosen = r.get("chosen") or {}
        lyrics = r.get("lyrics", {})
        lyr = lyrics.get("status", "-")
        if lyrics.get("status") == "synced":
            lyr = "sync"
        lines.append(
            "| {id} | {artist} | {title} | {state} | {score} | {dur} | {audio} | {chan} | {lyr} |".format(
                id=r["id"], artist=r["artist"], title=r["title"],
                state=labels.get(r["status"], r["status"]),
                score=r.get("score") if r.get("score") is not None else "",
                dur=f"{r.get('duration')}s" if r.get("duration") else "",
                audio=(chosen.get("title") or "")[:52].replace("|", "/"),
                chan=(chosen.get("channel") or "")[:22].replace("|", "/"),
                lyr=lyr,
            )
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
