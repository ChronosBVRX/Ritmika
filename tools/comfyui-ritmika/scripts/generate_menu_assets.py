#!/usr/bin/env python3
"""Genera el arte del menú Palenque Arcade con el ComfyUI local.

Produce el fondo general y las cinco portadas de modo con SDXL
(Juggernaut XL), las convierte a WebP y las deja en public/assets/menu/.

Uso:
    python scripts/generate_menu_assets.py
    python scripts/generate_menu_assets.py --skip-generation   # solo convierte
    python scripts/generate_menu_assets.py --only ranchera

Los PNG originales quedan en un directorio de staging externo al repo.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

TOOL_DIR = Path(__file__).resolve().parent
REPO = TOOL_DIR.parents[2]
GENERATOR = TOOL_DIR / "generate_image.py"
ASSET_DIR = REPO / "public" / "assets" / "menu"
DEFAULT_STAGING = Path(os.environ.get("RITMIKA_GENERATED_DIR", "/tmp/ritmika-menu-assets")) / "menu"

BASE_HERO = (
    "premium stylized 3D video game key art background, vibrant symmetrical Mexican "
    "palenque karaoke stage, {theme}, colorful papel picado banners, neon marquee bulbs, "
    "velvet curtains, rich folk art textiles, deep navy shadows, cinematic lighting, "
    "central circular backdrop, clean areas for character and UI overlays, no people, "
    "no characters, no text, no letters, no logo, no watermark, ultra detailed, "
    "octane render, vibrant, high contrast"
)
NEGATIVE = (
    "text, letters, words, logo, watermark, signature, people, crowd, character, face, "
    "blurry, low quality, jpeg artifacts, frame, border, flat lighting, ugly, deformed"
)

JOBS = {
    "menu_bg": {
        "seed": 111301,
        "size": (1920, 1080),
        "target": "menu_bg_palenque.webp",
        "prompt": (
            "premium stylized 3D video game main menu background, dark navy abstract "
            "Mexican palenque neon mandala, colorful papel picado silhouettes around the "
            "border, marquee bulbs, magenta cyan and warm yellow rim light, symmetrical "
            "circular composition, strong vignette, clean dark center space for UI, no "
            "people, no characters, no text, no letters, no logo, no watermark, ultra "
            "detailed, octane render, high contrast"
        ),
    },
    "clasico": {
        "seed": 662002,
        "size": (1344, 896),
        "target": "hero_clasico.webp",
        "prompt": BASE_HERO.format(
            theme=(
                "neon karaoke club with a vintage microphone, vinyl records and a disco "
                "ball, electric magenta, cyan and yellow lights"
            )
        ),
    },
    "emo": {
        "seed": 662102,
        "size": (1344, 896),
        "target": "hero_emo.webp",
        "prompt": BASE_HERO.format(
            theme=(
                "dramatic emo karaoke stage with a broken neon heart, electric guitars, "
                "rain and purple fog, black, magenta and deep violet palette"
            )
        ),
    },
    "ranchera": {
        "seed": 881221,
        "size": (1344, 896),
        "target": "hero_ranchera.webp",
        "prompt": (
            "premium stylized 3D video game key art, dynamic three-quarter perspective of "
            "a Mexican palenque karaoke stage, asymmetrical composition, foreground stage "
            "edge, giant colorful papel picado banners, sombrero and guitarron props, neon "
            "marquee bulbs, warm golden god rays, magenta and cyan rim light, deep navy "
            "background, empty right side for character overlay, no people, no characters, "
            "no text, no letters, no logo, no watermark, ultra detailed, octane render, "
            "cinematic, vibrant, high contrast"
        ),
    },
    "nostalgia": {
        "seed": 662201,
        "size": (1344, 896),
        "target": "hero_nostalgia.webp",
        "prompt": BASE_HERO.format(
            theme=(
                "Y2K pop karaoke stage with giant CDs, CRT televisions, a boombox and "
                "glitter, pink, cyan and baby blue palette"
            )
        ),
    },
    "anime": {
        "seed": 662301,
        "size": (1344, 896),
        "target": "hero_anime.webp",
        "prompt": BASE_HERO.format(
            theme=(
                "anime karaoke stage with Japanese lanterns, cherry blossoms, torii arch "
                "and arcade screens, cyan, red and gold palette"
            )
        ),
    },
}


def generate(job: dict, staging: Path) -> Path:
    staging.mkdir(parents=True, exist_ok=True)
    out = staging / f"{job['seed']}.png"
    if out.exists():
        print(f"[skip] {out}")
        return out
    cmd = [
        sys.executable, str(GENERATOR),
        "--prompt", job["prompt"],
        "--negative", NEGATIVE,
        "--width", str(job["size"][0]),
        "--height", str(job["size"][1]),
        "--steps", "28",
        "--cfg", "6.5",
        "--seed", str(job["seed"]),
        "--checkpoint", "juggernautXL_v9Rundiffusion.safetensors",
        "--out", str(out),
    ]
    print(f"[gen] {out.name} seed={job['seed']}")
    subprocess.run(cmd, check=True)
    return out


def convert(source: Path, target: Path, size: tuple[int, int]) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(source).convert("RGB")
    im = ImageOps.fit(im, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    im.save(target, "WEBP", quality=84, method=6)
    print(f"[webp] {target.relative_to(REPO)} {im.size} {target.stat().st_size // 1024} KB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-generation", action="store_true")
    ap.add_argument("--staging", default=str(DEFAULT_STAGING))
    ap.add_argument("--only", choices=sorted(JOBS), action="append")
    args = ap.parse_args()

    staging = Path(args.staging)
    selected = args.only or sorted(JOBS)
    for name in selected:
        job = JOBS[name]
        source = staging / f"{job['seed']}.png"
        if not args.skip_generation:
            source = generate(job, staging)
        if not source.exists():
            print(f"[error] falta {source}; corre sin --skip-generation", file=sys.stderr)
            return 1
        convert(source, ASSET_DIR / job["target"], job["size"])

    # El papel picado es vectorial y se regenera aparte.
    ornaments = REPO / "scripts" / "generate_menu_ornaments.py"
    if ornaments.exists():
        subprocess.run([sys.executable, str(ornaments)], check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
