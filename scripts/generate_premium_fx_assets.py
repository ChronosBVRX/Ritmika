#!/usr/bin/env python3
"""Genera los assets premium de las fases de juego (ruleta, tomatazos).

Los PNG de staging quedan fuera del repo. Los assets de primer plano se
recortan con floodfill (croma verde) y se exportan como WebP con alfa real.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

TOOL_DIR = Path(__file__).resolve().parent
REPO = TOOL_DIR.parent
GENERATOR = REPO / "tools" / "comfyui-ritmika" / "scripts" / "generate_image.py"
ASSET_DIR = REPO / "public" / "assets"
STAGING = Path("/tmp/opencode/premium-staging")

NEGATIVE = (
    "text, letters, words, logo, watermark, signature, people, crowd, character, face, "
    "blurry, low quality, jpeg artifacts, frame, border, flat lighting, ugly, deformed, "
    "multiple objects, cropped"
)

JOBS = {
    "roulette_stage": {
        "seed": 220241,
        "size": (1920, 1080),
        "prompt": (
            "premium 3D cartoon game show stage background for a karaoke roulette "
            "mini-game, wide 16:9 composition, dark navy Mexican palenque theater, "
            "large empty circular golden marquee frame centered in the middle distance, "
            "neon magenta and cyan spotlights crossing from the sides, papel picado "
            "silhouettes, floating confetti, warm disco ball glow, polished wooden stage "
            "floor, soft volumetric haze, strong vignette, clean dark center area for UI "
            "overlays, no wheel, no people, no text, no letters, no logo, ultra detailed, "
            "cinematic lighting, vibrant, high contrast, octane render"
        ),
    },
    "tomato_projectile_hd": {
        "seed": 220242,
        "size": (1024, 1024),
        "transparent": True,
        "target": "tomato_projectile_hd.webp",
        "prompt": (
            "one single glossy 3D cartoon tomato, front view, floating, vibrant saturated "
            "red, bright green stem, chunky cartoon proportions, soft studio lighting, "
            "clean rim light, subtle specular highlight, centered, isolated on a completely "
            "flat pure chroma green background number 00ff00, no shadow, no floor, "
            "no text, no watermark, high detail, game asset"
        ),
    },
    "tomato_splat_hd": {
        "seed": 220243,
        "size": (1024, 1024),
        "transparent": True,
        "target": "tomato_splat_hd.webp",
        "prompt": (
            "one single glossy 3D cartoon tomato splat, thick red sauce splash with a few "
            "seeds and juice droplets, irregular impact shape, top-down view, centered, "
            "isolated on a completely flat pure chroma green background number 00ff00, "
            "no shadow, no floor, no text, no watermark, high detail, game asset"
        ),
    },
}


def generate(job: dict) -> Path:
    STAGING.mkdir(parents=True, exist_ok=True)
    out = STAGING / f"{job['seed']}.png"
    if out.exists():
        print(f"[skip] {out}")
        return out
    cmd = [
        sys.executable, str(GENERATOR),
        "--prompt", job["prompt"],
        "--negative", NEGATIVE,
        "--width", str(job["size"][0]),
        "--height", str(job["size"][1]),
        "--steps", "30",
        "--cfg", "6.5",
        "--seed", str(job["seed"]),
        "--checkpoint", "juggernautXL_v9Rundiffusion.safetensors",
        "--out", str(out),
    ]
    print(f"[gen] {job['seed']} {job['size'][0]}x{job['size'][1]}")
    subprocess.run(cmd, check=True)
    return out


def convert_opaque(source: Path, target: Path, size: tuple[int, int]) -> None:
    im = Image.open(source).convert("RGB")
    im = ImageOps.fit(im, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    im.save(target, "WEBP", quality=88, method=6)
    print(f"[webp] {target.relative_to(REPO)} {im.size} {target.stat().st_size // 1024} KB")


def convert_alpha(source: Path, target: Path) -> None:
    cache = REPO / ".cache"
    cache.mkdir(parents=True, exist_ok=True)
    staged = cache / f"premium-{source.stem}.png"
    staged.write_bytes(source.read_bytes())
    try:
        subprocess.run([
            sys.executable, str(REPO / "scripts" / "fix_asset_transparency.py"),
            "--auto-green", "--tol", "34", "--grow", "2", str(staged),
        ], check=True)
        im = Image.open(staged).convert("RGBA")
    finally:
        staged.unlink(missing_ok=True)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    if target.name == "tomato_projectile_hd.webp":
        # El modelo deja una sombra verde de piso al pie del tomate. Se limpia
        # solo la franja inferior para no tocar el tallo ni el brillo del cuerpo.
        px = im.load()
        w, h = im.size
        for y in range(int(h * 0.78), h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a and g > r - 18 and not (r > 150 and g < r * 0.55):
                    px[x, y] = (0, 0, 0, 0)
        bbox = im.getbbox()
        if bbox:
            im = im.crop(bbox)
    im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    im.save(target, "WEBP", quality=90, method=6)
    print(f"[webp] {target.relative_to(REPO)} {im.size} {target.stat().st_size // 1024} KB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=sorted(JOBS), action="append")
    ap.add_argument("--skip-generation", action="store_true")
    args = ap.parse_args()
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for name in (args.only or sorted(JOBS)):
        job = JOBS[name]
        source = STAGING / f"{job['seed']}.png"
        if not args.skip_generation:
            source = generate(job)
        if not source.exists():
            print(f"[error] falta {source}", file=sys.stderr)
            return 1
        if job.get("transparent"):
            convert_alpha(source, ASSET_DIR / job["target"])
        else:
            convert_opaque(source, ASSET_DIR / "roulette_bg_stage_wide.webp", job["size"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
