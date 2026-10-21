#!/usr/bin/env python3
"""Genera assets premium para la premiación de Rítmika.

- Escenario 1920x1080 sin personas ni texto.
- Trofeos 3D coleccionables para premios especiales y campeón.
- Fondo blanco, recorte rembg (u2netp), sin sombra de contacto.
- Los candidatos quedan en staging; no reemplazan los assets actuales
  hasta elegir el ganador.
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
STAGING = Path("/tmp/opencode/podium-staging")
ASSET_DIR = REPO / "public" / "assets"
REMBG = os.environ.get("REMBG_BIN") or shutil.which("rembg") or "/tmp/opencode/rembg-venv/bin/rembg"
REMBG_MODEL = os.environ.get("REMBG_MODEL", "u2netp")
CANVAS = 1024

NEGATIVE = (
    "text, letters, words, logo, watermark, signature, multiple objects, crowd, people, "
    "characters, frame, border, floor, ground, cast shadow, background scenery, "
    "realistic photo, photorealistic human, blurry, low quality, jpeg artifacts, "
    "floating objects, particles, colored background, dark background, vignette, duplicate"
)

STAGE_PROMPT = (
    "premium 3D cartoon awards ceremony stage background, wide 16:9 composition, "
    "empty Mexican palenque theater, central golden podium with three steps, deep navy "
    "background, neon magenta cyan and gold spotlights, papel picado banners, confetti, "
    "disco ball glow, polished stage floor, symmetrical composition, clean central area "
    "for UI overlays, no people, no characters, no text, no letters, no logo, no watermark, "
    "ultra detailed, cinematic, vibrant, high contrast, octane render"
)

STYLE = (
    "premium 3D collectible award trophy, glossy vinyl toy render, ornate black and gold "
    "pedestal, chunky stylized proportions, warm golden key light, cyan and magenta rim light, "
    "subtle specular highlights, high detail, octane render, game award asset, centered, "
    "full object visible, isolated on a pure white seamless studio background, "
    "e-commerce product photo, soft even lighting, no shadow, no floor, no background scenery"
)

JOBS = {
    "gallo": {
        "seed": 360100,
        "target": "award_gallo.webp",
        "prompt": "a golden rooster trophy, glossy gold rooster with a red comb holding a silver microphone, Mexican folk art details",
    },
    "tomate": {
        "seed": 360200,
        "target": "award_tomate.webp",
        "prompt": "a glossy red tomato trophy with a green stem and salsa splash details, gold accents",
    },
    "vengador": {
        "seed": 360300,
        "target": "award_vengador.webp",
        "prompt": "a mysterious purple and gold luchador mask trophy with a small cape collar, black and gold pedestal",
    },
    "corazon": {
        "seed": 360400,
        "target": "modes/emo/award_broken_heart.webp",
        "prompt": "a cracked black and gold heart trophy with glowing magenta fissures, dramatic",
    },
    "indirecta": {
        "seed": 360500,
        "target": "modes/emo/award_indirecta.webp",
        "prompt": "a black smartphone trophy with a cracked screen showing a neon message bubble, gold pedestal",
    },
    "sobreviviente": {
        "seed": 360600,
        "target": "modes/emo/award_blackout.webp",
        "prompt": "a vintage golden lamp trophy with a glowing white bulb and a small moon charm, black pedestal",
    },
    "campeon": {
        "seed": 360700,
        "target": "podium_trophy_ritmika.webp",
        "prompt": "a golden microphone trophy with a star and a small crown, black and gold pedestal, champion award",
    },
}


def generate(prompt: str, seed: int, width: int, height: int, out: Path, count: int = 2) -> list[Path]:
    STAGING.mkdir(parents=True, exist_ok=True)
    base = STAGING / f"{seed}.png"
    expected = [base.with_name(f"{base.stem}_{seed + i}{base.suffix}") for i in range(count)] if count > 1 else [base]
    if all(p.exists() for p in expected):
        print(f"[skip] {base.name}")
        return expected
    cmd = [
        sys.executable, str(GENERATOR),
        "--prompt", prompt,
        "--negative", NEGATIVE,
        "--width", str(width),
        "--height", str(height),
        "--steps", "32",
        "--cfg", "6.5",
        "--seed", str(seed),
        "--count", str(count),
        "--checkpoint", "juggernautXL_v9Rundiffusion.safetensors",
        "--out", str(base),
    ]
    print(f"[gen] {seed} {width}x{height} x{count}")
    subprocess.run(cmd, check=True)
    return [p for p in expected if p.exists()]


def cutout(source: Path, target: Path) -> dict:
    cache = REPO / ".cache"
    cache.mkdir(parents=True, exist_ok=True)
    staged = cache / f"podium-{source.stem}.png"
    cut = cache / f"podium-{source.stem}-cut.png"
    staged.write_bytes(source.read_bytes())
    try:
        if Path(REMBG).exists():
            subprocess.run(
                [REMBG, "i", "-m", REMBG_MODEL, str(staged), str(cut)],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            im = Image.open(cut).convert("RGBA")
        else:
            raise RuntimeError("rembg no disponible")
    finally:
        staged.unlink(missing_ok=True)
        cut.unlink(missing_ok=True)

    bbox = im.getbbox()
    if not bbox:
        return {"ok": False, "reason": "sin alfa"}
    # Limpieza de sombra gris de contacto en la base.
    bbox0 = im.getbbox()
    if bbox0:
        px = im.load()
        start_y = bbox0[3] - int((bbox0[3] - bbox0[1]) * 0.16)
        for y in range(max(bbox0[1], start_y), bbox0[3]):
            for x in range(bbox0[0], bbox0[2]):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                hi, lo = max(r, g, b), min(r, g, b)
                if 70 <= hi <= 235 and (hi - lo) <= 18:
                    px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    if not bbox:
        return {"ok": False, "reason": "sin alfa tras sombra"}

    im = im.crop(bbox)
    im.thumbnail((int(CANVAS * 0.92), int(CANVAS * 0.92)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((CANVAS - im.width) // 2, (CANVAS - im.height) // 2))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, "WEBP", quality=92, method=6)
    return {"ok": True, "path": str(target), "coverage_pct": round(100.0 * sum(1 for v in canvas.getchannel("A").getdata() if v > 0) / (CANVAS * CANVAS), 1)}


def sheet(items: list[dict], target: Path) -> None:
    cols = 2
    rows = len(items)
    cell_w, cell_h = 420, 460
    sh = Image.new("RGB", (cols * cell_w, rows * cell_h), (15, 23, 42))
    d = ImageDraw.Draw(sh)
    for row, item in enumerate(items):
        for col, cand in enumerate(item["candidates"]):
            y = row * cell_h + 30
            x = col * cell_w + 10
            if cand.get("ok"):
                im = Image.open(cand["path"]).convert("RGBA")
                im.thumbnail((cell_w - 20, cell_h - 70), Image.Resampling.LANCZOS)
                sh.paste(im, (x + (cell_w - 20 - im.width) // 2, y), im)
            else:
                d.text((x + 20, y + 100), "SIN ALFA", fill=(255, 80, 80))
            d.text((x + 8, row * cell_h + 8), f"{item['name']} · c{col + 1}", fill=(255, 255, 255))
    target.parent.mkdir(parents=True, exist_ok=True)
    sh.save(target, "JPEG", quality=92)
    print(f"[sheet] {target}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--only", action="append", choices=sorted(JOBS))
    ap.add_argument("--skip-generation", action="store_true")
    args = ap.parse_args()

    items = []
    names = args.only or sorted(JOBS)
    for name in names:
        job = JOBS[name]
        prompt = f"{job['prompt']}, {STYLE}"
        if args.skip_generation:
            base = STAGING / f"{job['seed']}.png"
            sources = [base.with_name(f"{base.stem}_{job['seed'] + i}{base.suffix}") for i in range(args.count)]
            sources = [p for p in sources if p.exists()]
        else:
            sources = generate(prompt, job["seed"], CANVAS, CANVAS, STAGING / f"{job['seed']}.png", args.count)
        candidates = []
        for i, source in enumerate(sources):
            target = STAGING / "cut" / f"{name}_c{i + 1}.webp"
            meta = cutout(source, target) if source.exists() else {"ok": False}
            candidates.append(meta)
            print(f"  [{name}] c{i + 1}: {meta}")
        items.append({"name": name, "target": job["target"], "candidates": candidates})

    sheet(items, STAGING / "contact-sheet.jpg")
    (STAGING / "manifest.json").write_text(json.dumps(items, indent=2, ensure_ascii=False))

    # Escenario 16:9
    if not args.only or "stage" in args.only:
        stage_out = STAGING / "podium_bg_stage_wide.png"
        if not stage_out.exists() and not args.skip_generation:
            generate(STAGE_PROMPT, 360000, 1920, 1080, stage_out, 1)
        if stage_out.exists():
            im = Image.open(stage_out).convert("RGB")
            im.save(ASSET_DIR / "podium_bg_stage_wide.webp", "WEBP", quality=86, method=6)
            print("[stage] public/assets/podium_bg_stage_wide.webp")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
