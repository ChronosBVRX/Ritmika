#!/usr/bin/env python3
"""Audita que los assets de imagen que deben ser transparentes lo sean.

Reporta, por cada imagen: modo (RGB/RGBA), si el canal alfa tiene
transparencia real y el color de las 4 esquinas. Sirve para detectar assets
generados con fondo plano (blanco/negro/verde) que deberian ser RGBA.

Uso:
    python3 scripts/audit_asset_transparency.py [--fix] [--report out.json]
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Falta Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# Assets que SIEMPRE van encima de otras capas: deben tener alfa real.
# (fondos y capturas no: son opacos a proposito)
TRANSPARENT_HINTS = (
    "avatar", "vignette", "axolo", "award", "icon_", "trophy", "crown",
    "stars", "star_", "tomato", "deco", "logo", "glitter", "particle",
    "splash", "badge", "medal", "pedestal", "shard", "confetti",
)

OPAQUE_HINTS = (
    "bg_", "_bg", "background", "fondo", "lobby_bg", "loading_bg",
    "podium_bg", "wallpaper", "cover", "poster",
)

EXTS = {".png", ".webp", ".jpg", ".jpeg"}


def classify(path: Path) -> str:
    name = path.name.lower()
    if any(h in name for h in OPAQUE_HINTS):
        return "opaque"
    if any(h in name for h in TRANSPARENT_HINTS):
        return "transparent"
    return "unknown"


def analyze(path: Path) -> dict:
    info = {"path": str(path.relative_to(ROOT)), "expect": classify(path)}
    try:
        with Image.open(path) as im:
            info["format"] = im.format
            info["size"] = list(im.size)
            info["mode"] = im.mode
            has_alpha = "A" in im.getbands() or im.mode == "P" and "transparency" in im.info
            info["has_alpha"] = bool(has_alpha)

            rgba = im.convert("RGBA")
            w, h = rgba.size
            px = rgba.load()

            transparent = 0
            step = max(1, (w * h) // 40000)
            samples = 0
            for y in range(0, h, max(1, int(step ** 0.5))):
                for x in range(0, w, max(1, int(step ** 0.5))):
                    samples += 1
                    if px[x, y][3] == 0:
                        transparent += 1
            info["transparent_pct"] = round(100.0 * transparent / max(1, samples), 1)

            corners = {}
            for label, (cx, cy) in {
                "tl": (0, 0), "tr": (w - 1, 0), "bl": (0, h - 1), "br": (w - 1, h - 1),
            }.items():
                corners[label] = list(px[cx, cy])
            info["corners"] = corners
            info["corners_equal"] = len({tuple(v) for v in corners.values()}) == 1
            info["corner_opaque"] = all(v[3] == 255 for v in corners.values())

            if info["has_alpha"] and info["transparent_pct"] > 1.0:
                info["status"] = "ok"
            elif info["expect"] == "opaque":
                info["status"] = "ok" if not info["has_alpha"] else "opaque-bg"
            else:
                info["status"] = "sin-transparencia"
    except Exception as exc:  # noqa: BLE001
        info["error"] = str(exc)
        info["status"] = "error"
    return info


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", default=None, help="guardar JSON del reporte")
    args = ap.parse_args()

    items = []
    for base, dirs, files in os.walk(PUBLIC):
        dirs[:] = [d for d in dirs if d not in {"node_modules", "libs", "fonts"}]
        for f in sorted(files):
            p = Path(base) / f
            if p.suffix.lower() in EXTS:
                items.append(analyze(p))

    problems = [i for i in items if i["status"] not in ("ok", "error")]
    errors = [i for i in items if i["status"] == "error"]

    print(f"Assets analizados: {len(items)}")
    print(f"Con transparencia OK: {sum(1 for i in items if i['status'] == 'ok')}")
    print(f"PROBLEMAS (deberian ser RGBA y no lo son): {len(problems)}")
    if errors:
        print(f"Errores de lectura: {len(errors)}")

    print("\n== PROBLEMAS ==")
    for i in problems:
        corners = ", ".join(f"{k}{tuple(v)}" for k, v in i["corners"].items())
        print(
            f"  {i['path']}  [{i.get('mode')} {i.get('size')}] "
            f"alfa={i.get('has_alpha')} transp={i.get('transparent_pct')}%  "
            f"esquinas={corners}"
        )

    print("\n== DUDOSOS (sin pista en el nombre) ==")
    for i in items:
        if i["expect"] == "unknown" and i["status"] != "ok":
            print(f"  {i['path']}  [{i.get('mode')} {i.get('size')}] transp={i.get('transparent_pct')}%")

    if args.report:
        Path(args.report).write_text(json.dumps(items, indent=2, ensure_ascii=False))
        print(f"\nReporte escrito en {args.report}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
