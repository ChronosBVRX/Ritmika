#!/usr/bin/env python3
"""Genera avatares premium consistentes con el pipeline local de ComfyUI.

- 1024x1024, SDXL (Juggernaut XL).
- Fondo croma magenta plano; se recorta con floodfill y alfa real.
- Sin piso, sin sombra horneada, encuadre full-body y margen uniforme.
- Los candidatos quedan en staging; no reemplazan los avatares actuales
  hasta que se elija el ganador.

Requiere ComfyUI local y, para el recorte, un venv con `rembg[cpu,cli]`:
    python -m venv /tmp/opencode/rembg-venv
    /tmp/opencode/rembg-venv/bin/pip install "rembg[cpu,cli]"
También se puede apuntar a otro binario con REMBG_BIN y elegir el modelo con
REMBG_MODEL (por defecto u2netp).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

TOOL_DIR = Path(__file__).resolve().parent
REPO = TOOL_DIR.parent
GENERATOR = REPO / "tools" / "comfyui-ritmika" / "scripts" / "generate_image.py"
FIXER = REPO / "scripts" / "fix_asset_transparency.py"
ASSET_DIR = REPO / "public" / "assets" / "avatars"
REMBG = os.environ.get("REMBG_BIN") or shutil.which("rembg") or "/tmp/opencode/rembg-venv/bin/rembg"
REMBG_MODEL = os.environ.get("REMBG_MODEL", "u2netp")
STAGING = Path("/tmp/opencode/avatar-staging")
CANVAS = 1024
MARGIN = 0.06

STYLE = (
    "premium 3D collectible vinyl toy mascot, one single character, full body head to toe, "
    "front three-quarter view, chunky stylized proportions, glossy smooth surfaces, "
    "soft cel-shaded 3D render, thick clean silhouette, vibrant Mexican palenque karaoke "
    "party palette, warm golden key light from the right, cyan and magenta rim light from "
    "the left, subtle specular highlights, high detail, octane render, game character asset, "
    "centered composition, entire body visible, isolated on a pure white seamless studio "
    "background, e-commerce product photo, soft even lighting, no shadow, no floor, floating, "
    "no background scenery"
)

NEGATIVE = (
    "text, letters, words, logo, watermark, signature, multiple characters, crowd, "
    "cropped, cut off, out of frame, close-up, portrait only, frame, border, floor, "
    "ground, cast shadow, background scenery, base, pedestal, platform, display stand, "
    "stone base, rock base, realistic photo, photorealistic human, "
    "extra limbs, deformed hands, blurry, low quality, jpeg artifacts, floating objects, "
    "music notes, particles, sparkles, colored background, magenta background, green "
    "background, teal background, pink background, dark background, vignette, duplicate, "
    "toy packaging"
)

JOBS = {
    0: {
        "name": "taco_rockero",
        "seed": 350100,
        "prompt": "a premium party character with a giant crunchy taco head and a stylized humanoid body, black leather rock jacket with silver studs, dark sunglasses, red electric guitar, confident rock pose, one hand raising the horns",
    },
    1: {
        "name": "chile_enmascarado",
        "seed": 350200,
        "prompt": "a premium party character with a giant glossy red chili pepper head wearing an ornate green and gold luchador mask, stylized humanoid body in a red and green luchador suit, small heroic cape, championship belt, holding a silver microphone, powerful pose",
    },
    2: {
        "name": "tequila_fiestero",
        "seed": 350300,
        "prompt": "a premium party character with a giant tequila shot glass head, golden tequila, lime wedge and salt rim, stylized humanoid body in a colorful striped sarape and small sombrero, maracas in both hands, festive dancing pose",
    },
    3: {
        "name": "estrella_rock",
        "seed": 350400,
        "prompt": "a premium party character with a giant golden five-point star head, stylized humanoid body in a black leather rock jacket, star-shaped sunglasses, holding a microphone, confident rockstar pose",
    },
    4: {
        "name": "loro_cumbiambero",
        "seed": 350500,
        "prompt": "a premium party character with a giant colorful parrot head, bright green red and blue feathers, stylized humanoid body in a tropical guayabera shirt and straw sombrero, maracas, joyful cumbia dancing pose",
    },
    5: {
        "name": "guitarra_magica",
        "seed": 350900,
        "prompt": "a premium party character whose entire head is a giant glossy blue electric guitar, guitar body and neck forming the head, cheerful cartoon face on the guitar body, stylized humanoid body in a rock outfit, neon glowing strings, holding a microphone, magical rock pose, floating in mid-air, feet not touching any ground, not a figurine, no base, no pedestal",
    },
    6: {
        "name": "rey_palenque",
        "seed": 350700,
        "prompt": "a premium party character with a giant glossy rooster head wearing a golden crown and black mariachi sombrero with gold trim, stylized humanoid body in a royal red cape and mariachi suit, holding a microphone scepter, regal pose",
    },
    7: {
        "name": "pulpo_salsero",
        "seed": 350800,
        "prompt": "a premium party character with a giant blue octopus head, glossy blue skin, black fedora and dark sunglasses, stylized humanoid body in a ruffled salsa shirt, extra octopus arms holding maracas and a small conga drum, dynamic salsa pose",
    },
}


def generate(job: dict, count: int) -> list[Path]:
    STAGING.mkdir(parents=True, exist_ok=True)
    base = STAGING / f"{job['seed']}.png"
    if count == 1:
        expected = [base]
    else:
        expected = [base.with_name(f"{base.stem}_{job['seed'] + i}{base.suffix}") for i in range(count)]
    if all(p.exists() for p in expected):
        print(f"[skip] {job['name']}")
        return expected

    cmd = [
        sys.executable, str(GENERATOR),
        "--prompt", f"{job['prompt']}, {STYLE}",
        "--negative", NEGATIVE,
        "--width", str(CANVAS),
        "--height", str(CANVAS),
        "--steps", "32",
        "--cfg", "6.5",
        "--seed", str(job["seed"]),
        "--count", str(count),
        "--checkpoint", "juggernautXL_v9Rundiffusion.safetensors",
        "--out", str(base),
    ]
    print(f"[gen] {job['name']} x{count}")
    subprocess.run(cmd, check=True)
    return [p for p in expected if p.exists()]


def cutout(source: Path, target: Path) -> dict:
    cache = REPO / ".cache"
    cache.mkdir(parents=True, exist_ok=True)
    staged = cache / f"avatar-{source.stem}.png"
    cut = cache / f"avatar-{source.stem}-cut.png"
    staged.write_bytes(source.read_bytes())
    try:
        if Path(REMBG).exists():
            subprocess.run(
                [REMBG, "i", "-m", REMBG_MODEL, str(staged), str(cut)],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            im = Image.open(cut).convert("RGBA")
        else:
            subprocess.run([
                sys.executable, str(FIXER),
                "--auto-light", "--tol", "30", "--grow", "3", str(staged),
            ], check=True)
            im = Image.open(staged).convert("RGBA")
    finally:
        staged.unlink(missing_ok=True)
        cut.unlink(missing_ok=True)

    # Limpia la sombra gris de contacto que algunos renders dejan bajo los pies.
    bbox0 = im.getbbox()
    if bbox0:
        px = im.load()
        start_y = bbox0[3] - int((bbox0[3] - bbox0[1]) * 0.14)
        for y in range(max(bbox0[1], start_y), bbox0[3]):
            for x in range(bbox0[0], bbox0[2]):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                hi = max(r, g, b)
                lo = min(r, g, b)
                if 70 <= hi <= 235 and (hi - lo) <= 18:
                    px[x, y] = (0, 0, 0, 0)

    bbox = im.getbbox()
    if not bbox:
        return {"ok": False, "reason": "sin alfa"}
    left, top, right, bottom = bbox
    edge_touch = left <= 1 or top <= 1 or right >= im.width - 1 or bottom >= im.height - 1
    im = im.crop(bbox)

    limit = int(CANVAS * (1 - MARGIN * 2))
    im = ImageOps.contain(im, (limit, limit), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = (CANVAS - im.width) // 2
    y = (CANVAS - im.height) // 2
    canvas.alpha_composite(im, (x, y))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, "WEBP", quality=92, method=6)

    alpha = canvas.getchannel("A")
    opaque = sum(1 for v in alpha.getdata() if v > 0)
    return {
        "ok": True,
        "edge_touch": edge_touch,
        "bbox": [left, top, right, bottom],
        "coverage_pct": round(100.0 * opaque / (CANVAS * CANVAS), 1),
    }


def contact_sheet(items: list[dict], target: Path) -> None:
    cols = 2
    rows = len(items)
    cell_w, cell_h = 420, 460
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (15, 23, 42))
    draw = ImageDraw.Draw(sheet)
    for row, item in enumerate(items):
        for col, cand in enumerate(item["candidates"]):
            y = row * cell_h + 30
            x = col * cell_w + 10
            if cand.get("ok"):
                im = Image.open(cand["path"]).convert("RGBA")
                im.thumbnail((cell_w - 20, cell_h - 70), Image.Resampling.LANCZOS)
                sheet.paste(im, (x + (cell_w - 20 - im.width) // 2, y), im)
            else:
                draw.text((x + 20, y + 100), "SIN ALFA", fill=(255, 80, 80))
            label = f"{item['id']} {item['name']} · c{col + 1}"
            if cand.get("edge_touch"):
                label += " · BORDE"
            draw.text((x + 8, row * cell_h + 8), label, fill=(255, 255, 255))
            info = cand.get("coverage_pct")
            if info is not None:
                draw.text((x + 8, row * cell_h + cell_h - 20), f"cobertura {info}%", fill=(148, 163, 184))
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, "JPEG", quality=90)
    print(f"[sheet] {target}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--only", type=int, action="append")
    ap.add_argument("--skip-generation", action="store_true")
    args = ap.parse_args()

    items = []
    for idx in (args.only or sorted(JOBS)):
        job = JOBS[idx]
        if args.skip_generation:
            base = STAGING / f"{job['seed']}.png"
            if args.count == 1:
                sources = [base]
            else:
                sources = [base.with_name(f"{base.stem}_{job['seed'] + i}{base.suffix}") for i in range(args.count)]
            sources = [p for p in sources if p.exists()]
        else:
            sources = generate(job, args.count)
        candidates = []
        for i, source in enumerate(sources):
            target = STAGING / "cut" / f"avatar_{idx}_{job['name']}_c{i + 1}.webp"
            meta = cutout(source, target) if source.exists() else {"ok": False, "path": str(target)}
            meta["path"] = str(target)
            candidates.append(meta)
            print(f"  [{idx}/{job['name']}] c{i + 1}: {meta}")
        items.append({"id": idx, "name": job["name"], "candidates": candidates})

    contact_sheet(items, STAGING / "contact-sheet.jpg")
    (STAGING / "manifest.json").write_text(json.dumps(items, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
