#!/usr/bin/env python3
"""Quita el fondo horneado de assets que deberian ser transparentes (RGBA).

Detecta el color de fondo muestreando el borde de la imagen (soporta fondos de
varios tonos, como el tablero de ajedrez de "transparencia" que algunas
herramientas dejan horneado) y hace floodfill desde el borde, de modo que solo
se borra el fondo CONECTADO al borde: los blancos/grises internos del dibujo se
conservan.

Uso:
    python3 scripts/fix_asset_transparency.py public/assets/award_*.webp
    python3 scripts/fix_asset_transparency.py --check public/assets/*.webp
    python3 scripts/fix_asset_transparency.py --tol 40 --grow 2 img.webp

Salida: sobrescribe el archivo como WEBP con alfa (o PNG si la extension es
.png). Con --check solo informa.
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
except ImportError:
    print("Falta Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent


def border_colors(rgb: Image.Image, alpha: Image.Image, depth: int = 48, quant: int = 8) -> list[tuple[int, int, int]]:
    """Tonos de fondo candidatos: los que aparecen en >=3 de las 4 esquinas.

    Es deliberadamente conservador: si una esquina es transparente no aporta, y
    un color solo cuenta si esta en casi todas las esquinas. Asi no confundimos
    un fleco de color del propio dibujo con el fondo.
    """
    w, h = rgb.size
    depth = max(4, min(depth, w // 2, h // 2))
    px = rgb.load()
    ap = alpha.load()
    patches = {
        "tl": [(x, y) for y in range(depth) for x in range(depth)],
        "tr": [(w - 1 - x, y) for y in range(depth) for x in range(depth)],
        "bl": [(x, h - 1 - y) for y in range(depth) for x in range(depth)],
        "br": [(w - 1 - x, h - 1 - y) for y in range(depth) for x in range(depth)],
    }
    votes: dict[tuple[int, int, int], int] = {}
    for pts in patches.values():
        tones = set()
        for (x, y) in pts:
            if ap[x, y] > 0:
                tones.add(tuple(v // quant * quant for v in px[x, y]))
        for t in tones:
            votes[t] = votes.get(t, 0) + 1

    candidates = [t for t, n in votes.items() if n >= 3]
    opaque_corners = sum(1 for pts in patches.values() if any(ap[x, y] > 0 for (x, y) in pts))
    if opaque_corners < 3:
        return []
    return candidates[:4]


def build_bg_mask(rgb: Image.Image, alpha: Image.Image, colors: list[tuple[int, int, int]], tol: int) -> Image.Image:
    """Mascara 255 donde el pixel es opaco y se parece a algun tono de fondo."""
    mask = Image.new("L", rgb.size, 0)
    for c in colors:
        solid = Image.new("RGB", rgb.size, c)
        diff = ImageChops.difference(rgb, solid)
        r, g, b = diff.split()
        maxdiff = ImageChops.lighter(ImageChops.lighter(r, g), b)
        m = maxdiff.point(lambda v, t=tol: 255 if v <= t else 0)
        mask = ImageChops.lighter(mask, m)
    opaque = alpha.point(lambda v: 255 if v > 0 else 0)
    return ImageChops.multiply(mask, opaque)


def green_candidates(rgb: Image.Image, alpha: Image.Image, quant: int = 16,
                     min_share: float = 0.04, limit: int = 3) -> list[tuple[int, int, int]]:
    """Tonos verdes dominantes entre los pixeles opacos (fondo de croma)."""
    px = rgb.load()
    ap = alpha.load()
    w, h = rgb.size
    counter: Counter = Counter()
    total = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            if ap[x, y] == 0:
                continue
            r, g, b = px[x, y]
            total += 1
            if g > r + 18 and g > b + 18:
                counter[tuple(v // quant * quant for v in (r, g, b))] += 1
    return [c for c, n in counter.most_common(limit) if n >= total * min_share]


def light_candidates(rgb: Image.Image, alpha: Image.Image, quant: int = 8,
                     min_share: float = 0.05, limit: int = 3) -> list[tuple[int, int, int]]:
    """Tonos claros neutros dominantes (fondos blancos/grises)."""
    px = rgb.load()
    ap = alpha.load()
    w, h = rgb.size
    counter: Counter = Counter()
    total = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            if ap[x, y] == 0:
                continue
            r, g, b = px[x, y]
            total += 1
            if min(r, g, b) >= 170 and max(r, g, b) - min(r, g, b) <= 14:
                counter[tuple(v // quant * quant for v in (r, g, b))] += 1
    return [c for c, n in counter.most_common(limit) if n >= total * min_share]


def flood_from_border(mask: Image.Image, transparent: Image.Image | None = None,
                      marker: int = 128) -> Image.Image:
    """Marca (marker) la componente de fondo conectada al borde.

    Si se pasa `transparent`, las zonas ya transparentes cuentan como parte del
    fondo: asi se termina de quitar un croma que quedo a medias (el fondo no
    llega al borde porque el borde ya estaba recortado).
    """
    if transparent is not None:
        mask = ImageChops.lighter(mask, transparent.point(lambda v: 255 if v == 0 else 0))
    w, h = mask.size
    px = mask.load()
    seeds = []
    for x in range(w):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(h):
        seeds.append((0, y))
        seeds.append((w - 1, y))
    for s in seeds:
        if px[s[0], s[1]] == 255:
            ImageDraw.floodfill(mask, s, marker, thresh=0)
    return mask


def process(path: Path, tol: int, grow: int, check: bool, opts) -> dict:
    img = Image.open(path).convert("RGBA")
    rgb = img.convert("RGB")
    alpha = img.getchannel("A")
    if getattr(opts, "auto_green", False):
        colors = green_candidates(rgb, alpha)
    elif getattr(opts, "auto_light", False):
        colors = light_candidates(rgb, alpha)
    else:
        colors = border_colors(rgb, alpha)
    out = {"path": str(path.relative_to(ROOT)) if path.is_absolute() else str(path), "colors": colors}

    if not colors:
        out["result"] = "sin-fondo-detectado"
        return out

    mask = build_bg_mask(rgb, alpha, colors, tol)
    before = mask.histogram()[255]
    mask = flood_from_border(mask, alpha if opts.from_transparent else None)
    bg = mask.histogram()[128]
    out["bg_pixels"] = bg
    out["bg_pct"] = round(100.0 * bg / (mask.size[0] * mask.size[1]), 1)

    if check:
        out["result"] = "necesita-fix" if out["bg_pct"] > 1.0 else "ok"
        return out

    if grow > 0:
        # Come el borde anti-aliaseado (solo pixeles que siguen pareciendo fondo).
        dilated = mask.filter(ImageFilter.MaxFilter(2 * grow + 1))
        glued = ImageChops.multiply(
            dilated.point(lambda v: 255 if v >= 128 else 0),
            mask.point(lambda v: 255 if v == 255 else 0),
        )
        mask = ImageChops.lighter(mask, glued)

    alpha = Image.eval(mask, lambda v: 0 if v >= 128 else 255)
    img.putalpha(ImageChops.multiply(img.getchannel("A"), alpha))

    aa = img.getchannel("A")
    hist = aa.histogram()
    out["after_transparent_pct"] = round(100.0 * hist[0] / (aa.size[0] * aa.size[1]), 1)
    out["after_opaque_pct"] = round(100.0 * hist[255] / (aa.size[0] * aa.size[1]), 1)

    if path.suffix.lower() == ".png":
        img.save(path, "PNG")
    else:
        img.save(path, "WEBP", quality=92, method=6)
    out["result"] = "fix"
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--tol", type=int, default=28, help="tolerancia por canal contra el fondo")
    ap.add_argument("--grow", type=int, default=2, help="pixeles a comer del borde anti-aliaseado")
    ap.add_argument("--check", action="store_true", help="solo informar, no escribir")
    ap.add_argument("--auto-green", action="store_true", help="tonos de fondo = verdes dominantes (croma)")
    ap.add_argument("--auto-light", action="store_true", help="tonos de fondo = claros neutros dominantes")
    ap.add_argument("--from-transparent", action="store_true",
                    help="las zonas ya transparentes cuentan como fondo (terminar cromas a medias)")
    args = ap.parse_args()

    code = 0
    for f in args.files:
        p = Path(f)
        if not p.is_absolute():
            p = ROOT / f
        if not p.exists():
            print(f"  FALTA {f}")
            code = 1
            continue
        r = process(p, args.tol, args.grow, args.check, args)
        print(
            f"  {r.get('result','?'):22s} {r['path']}"
            + (f"  fondo={r.get('bg_pct')}%" if "bg_pct" in r else "")
            + (f"  -> alfa: {r.get('after_transparent_pct')}% transp / {r.get('after_opaque_pct')}% opaco" if "after_transparent_pct" in r else "")
            + (f"  tonos={r['colors']}" if r.get("colors") else "")
        )
    return code


if __name__ == "__main__":
    sys.exit(main())
