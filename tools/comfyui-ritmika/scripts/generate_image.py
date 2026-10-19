#!/usr/bin/env python3
"""Genera una imagen con ComfyUI (txt2img, SDXL/SD1.5) via API.

Pensado para producir assets nuevos de Rítmika (fondos de escenario, placas,
texturas) de forma reproducible: el workflow se arma en Python y se encola en
el ComfyUI local.

Uso:
    python scripts/generate_image.py --prompt "..." --negative "..." \
        --width 1344 --height 768 --steps 30 --cfg 6 --seed 12345 \
        --checkpoint juggernautXL_v9Rundiffusion.safetensors \
        --out /ruta/salida.png

    # variantes: --count 4 (semillas seed, seed+1, ...)
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

HOST = os.environ.get("COMFYUI_HOST", "127.0.0.1")
PORT = int(os.environ.get("COMFYUI_PORT", "8188"))
BASE = f"http://{HOST}:{PORT}"


def post(path: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def get(path: str) -> bytes:
    with urllib.request.urlopen(BASE + path, timeout=120) as r:
        return r.read()


def build_workflow(a) -> dict:
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": a.checkpoint},
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": a.prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": a.negative, "clip": ["1", 1]},
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": a.width, "height": a.height, "batch_size": 1},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": a.seed,
                "steps": a.steps,
                "cfg": a.cfg,
                "sampler_name": a.sampler,
                "scheduler": a.scheduler,
                "denoise": 1.0,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {
            "class_type": "SaveImage",
            "inputs": {"images": ["6", 0], "filename_prefix": a.prefix},
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--negative", default="text, watermark, logo, letters, low quality, blurry")
    ap.add_argument("--width", type=int, default=1344)
    ap.add_argument("--height", type=int, default=768)
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--cfg", type=float, default=6.0)
    ap.add_argument("--sampler", default="dpmpp_2m")
    ap.add_argument("--scheduler", default="karras")
    ap.add_argument("--seed", type=int, default=-1)
    ap.add_argument("--count", type=int, default=1)
    ap.add_argument("--checkpoint", default="juggernautXL_v9Rundiffusion.safetensors")
    ap.add_argument("--prefix", default="ritmika_gen")
    ap.add_argument("--out", required=True, help="archivo de salida (o prefijo si --count>1)")
    args = ap.parse_args()

    if args.seed < 0:
        args.seed = int.from_bytes(os.urandom(4), "big")

    client_id = str(uuid.uuid4())
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    for i in range(args.count):
        args.seed = args.seed + i
        args.prefix = f"ritmika_gen/{args.seed}"
        wf = build_workflow(args)
        res = post("/prompt", {"prompt": wf, "client_id": client_id})
        pid = res.get("prompt_id")
        print(f"[{i+1}/{args.count}] seed={args.seed} prompt_id={pid}")
        if res.get("node_errors"):
            print("errores:", json.dumps(res["node_errors"])[:400])

        deadline = time.time() + 600
        images = []
        while time.time() < deadline:
            time.sleep(2)
            hist = json.loads(get(f"/history/{pid}") or b"{}")
            if pid in hist:
                outputs = hist[pid].get("outputs", {})
                for node in outputs.values():
                    images.extend(node.get("images", []))
                break
        if not images:
            print("  sin imagen (timeout)")
            continue

        img = images[-1]
        q = urllib.parse.urlencode({
            "filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output"),
        })
        data = get("/view?" + q)
        target = out if args.count == 1 else out.with_name(f"{out.stem}_{args.seed}{out.suffix}")
        target.write_bytes(data)
        print(f"  -> {target} ({len(data)//1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
