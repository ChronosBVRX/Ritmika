#!/usr/bin/env python3
"""Run one Rítmika asset animation end to end against the local ComfyUI.

    asset -> preprocess -> upload -> queue API workflow -> wait -> interpolate
          -> apply source alpha -> loop -> export (webm/webp/sprite sheet)
          -> validate -> metadata -> manifest

This module is also imported by ``batch_generate.py``.

Usage:
    python run_workflow.py --asset public/assets/tio_axolo_vignette_neutral.webp \
        --animation idle --preset axolo
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_manifest  # noqa: E402
import common  # noqa: E402
import comfy_client  # noqa: E402
import inventory_assets  # noqa: E402
import make_sprite_sheet  # noqa: E402
import validate_output  # noqa: E402

try:
    from PIL import Image, ImageFilter
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]
    ImageFilter = None  # type: ignore[assignment]

LOG = common.setup_logging("ritmika.run_workflow")


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------


def load_preset(name: str) -> dict[str, Any]:
    path = common.PRESETS_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Preset not found: {path}")
    return common.read_json(path, {}) or {}


def load_workflow(workflow_id: str) -> tuple[dict[str, Any], Path]:
    meta_path = common.WORKFLOWS_DIR / workflow_id / "workflow.meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"Workflow not found: {meta_path}")
    meta = common.read_json(meta_path, {}) or {}
    template_path = common.WORKFLOWS_DIR / workflow_id / meta.get("workflowFile", "workflow.api.json")
    return meta, template_path


def merge_settings(preset: dict[str, Any], meta: dict[str, Any],
                   overrides: dict[str, Any]) -> dict[str, Any]:
    settings = dict(meta.get("defaults", {}))
    settings.update(preset.get("generation", {}))
    settings.update({k: v for k, v in overrides.items() if v is not None})
    return settings


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------


def _round_to(value: int, multiple: int, minimum: int) -> int:
    value = max(minimum, value)
    return max(multiple, int(round(value / multiple)) * multiple)


def preprocess_image(source: Path, settings: dict[str, Any], preset: dict[str, Any],
                     run_dir: Path, use_alpha: bool) -> dict[str, Any]:
    if Image is None:
        raise RuntimeError("Pillow is required for preprocessing")
    resolution = preset.get("resolution", {})
    max_dim = int(settings.get("maxDimension") or resolution.get("maxDimension", 512))
    min_dim = int(resolution.get("minDimension", 256))
    multiple = int(resolution.get("multipleOf", 8))

    with Image.open(source) as raw:
        image = raw.convert("RGBA")
    width, height = image.size
    scale = min(1.0, max_dim / max(width, height))
    new_w = _round_to(int(width * scale), multiple, min_dim)
    new_h = _round_to(int(height * scale), multiple, min_dim)
    if (new_w, new_h) != (width, height):
        image = image.resize((new_w, new_h), Image.LANCZOS)

    run_dir.mkdir(parents=True, exist_ok=True)
    alpha_path = None
    if use_alpha:
        alpha = image.getchannel("A")
        if settings.get("featherAlpha"):
            alpha = alpha.filter(ImageFilter.GaussianBlur(float(settings["featherAlpha"])))
        alpha_path = run_dir / "alpha.png"
        alpha.save(alpha_path)

    background = preset.get("alpha", {}).get("compositeBackground", "#808080")
    background_rgb = _hex_to_rgb(background)
    composited = Image.new("RGB", image.size, background_rgb)
    composited.paste(image, (0, 0), image)

    input_path = run_dir / "input.png"
    composited.save(input_path)

    return {
        "inputPath": input_path,
        "alphaPath": alpha_path,
        "width": image.size[0],
        "height": image.size[1],
        "sourceSize": (width, height),
    }


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Workflow rendering
# ---------------------------------------------------------------------------


def render_workflow(template_path: Path, values: dict[str, Any]) -> dict[str, Any]:
    text = template_path.read_text(encoding="utf-8")
    for key, value in values.items():
        token = f"__{key}__"
        if token not in text:
            continue
        if isinstance(value, str):
            text = text.replace(token, json.dumps(value)[1:-1])
        else:
            text = text.replace(token, json.dumps(value))
    leftover = re.findall(r"__[A-Z0-9_]+__", text)
    if leftover:
        raise ValueError(f"Unresolved placeholders: {sorted(set(leftover))}")
    return json.loads(text)


# ---------------------------------------------------------------------------
# Post-processing / export
# ---------------------------------------------------------------------------


def apply_loop(frames: list["Image.Image"], loop_mode: str) -> list["Image.Image"]:
    if loop_mode == "pingpong" and len(frames) > 2:
        return frames + frames[-2:0:-1]
    if loop_mode == "crossfade" and len(frames) > 4:
        blend = max(1, min(4, len(frames) // 4))
        out = list(frames)
        for offset in range(blend):
            end_index = len(frames) - blend + offset
            first = frames[offset]
            last = frames[end_index]
            weight = (offset + 1) / (blend + 1)
            out[end_index] = Image.blend(last, first, weight)
        return out
    return frames


def export_animation(frames: list["Image.Image"], rgb_frames: list["Image.Image"],
                     fps: float, run_dir: Path, outputs_config: dict[str, Any],
                     loop: bool) -> dict[str, Any]:
    frames_dir = run_dir / "frames"
    rgb_dir = run_dir / "frames_rgb"
    for directory in (frames_dir, rgb_dir):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True)
    for index, (frame, rgb) in enumerate(zip(frames, rgb_frames), start=1):
        frame.save(frames_dir / f"frame_{index:05d}.png")
        rgb.save(rgb_dir / f"frame_{index:05d}.png")

    outputs: dict[str, Any] = {"framesDir": str(frames_dir), "frameCount": len(frames)}
    if outputs_config.get("previewPng", True):
        preview = run_dir / "preview.png"
        frames[0].save(preview)
        outputs["preview"] = str(preview)

    if outputs_config.get("webp", True):
        webp_path = run_dir / "anim.webp"
        frames[0].save(
            webp_path, save_all=True, append_images=frames[1:],
            duration=int(round(1000 / fps)), loop=0, lossless=False, quality=90, method=6,
        )
        outputs["webp"] = str(webp_path)

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg and outputs_config.get("webm", True):
        webm_path = run_dir / "anim.webm"
        subprocess.run([
            ffmpeg, "-y", "-loglevel", "error", "-framerate", str(fps),
            "-i", str(frames_dir / "frame_%05d.png"),
            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-crf", "30", "-b:v", "0",
            "-auto-alt-ref", "0", "-row-mt", "1", str(webm_path),
        ], check=True)
        outputs["webm"] = str(webm_path)

    if ffmpeg and outputs_config.get("previewMp4", True):
        mp4_path = run_dir / "preview.mp4"
        subprocess.run([
            ffmpeg, "-y", "-loglevel", "error", "-framerate", str(fps),
            "-i", str(rgb_dir / "frame_%05d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", str(mp4_path),
        ], check=True)
        outputs["previewMp4"] = str(mp4_path)

    if outputs_config.get("spriteSheet", True):
        sheet_path = run_dir / "sheet.png"
        metadata = make_sprite_sheet.build_sprite_sheet(
            sorted(frames_dir.glob("frame_*.png")), sheet_path, fps=fps,
            max_frame_dimension=int(outputs_config.get("spriteSheetMaxDimension", 256) or 0),
        )
        common.write_json(sheet_path.with_suffix(".png.json"), metadata)
        outputs["spriteSheet"] = str(sheet_path)
        outputs["spriteSheetMeta"] = str(sheet_path.with_suffix(".png.json"))

    return outputs


def duration_of(frame_count: int, fps: float) -> float:
    return round(frame_count / fps, 3) if fps else 0.0


# ---------------------------------------------------------------------------
# Main generation
# ---------------------------------------------------------------------------


def generate_one(asset_path: str | Path, animation: str, preset_name: str,
                 overrides: dict[str, Any] | None = None, seed: int | None = None,
                 force: bool = False, dry_run: bool = False,
                 keep_frames: bool = True) -> dict[str, Any]:
    overrides = overrides or {}
    config = common.load_config()
    source = Path(asset_path)
    if not source.is_absolute():
        source = (common.REPO_ROOT / source).resolve()
    if not source.exists():
        raise FileNotFoundError(f"Asset not found: {source}")

    preset = load_preset(preset_name)
    workflow_id = build_manifest.WORKFLOW_FOR_ANIMATION.get(animation)
    if not workflow_id:
        raise ValueError(f"Unknown animation type: {animation}")
    meta, template_path = load_workflow(workflow_id)
    settings = merge_settings(preset, meta, overrides)

    asset_id = f"{build_manifest.slugify(source.stem)}-{animation}"
    category = preset.get("category", "other")
    if not category or category == "*":
        category = inventory_assets.infer_category(common.relative_to_repo(source))
    generated_root = common.generated_dir(config)
    run_dir = generated_root / category / asset_id
    metadata_path = run_dir / "metadata.json"

    if metadata_path.exists() and not force and not dry_run:
        existing = common.read_json(metadata_path, {}) or {}
        if existing.get("status") == "ok":
            LOG.info("skip (already generated): %s", asset_id)
            return {"id": asset_id, "status": "skipped", "metadata": existing}

    use_alpha = bool(meta.get("alphaRequired")) and bool(preset.get("alpha", {}).get("required", True))
    if use_alpha:
        from PIL import Image as _Image  # noqa: F401

    # Resolve seed
    seed = int(seed if seed is not None else settings.get("seed", 123456789))
    frames = int(settings.get("frames", 16))
    fps = float(settings.get("fps", 8))
    interp_multiplier = int(settings.get("interpMultiplier", 2))
    output_fps = float(settings.get("outputFps", fps * interp_multiplier))
    loop = bool(meta.get("loop", False))
    loop_mode = settings.get("loopMode", "pingpong" if loop else "none")

    positive = ", ".join(filter(None, [preset.get("prompt", {}).get("subject", ""), meta.get("positive", "")]))
    negative = ", ".join(filter(None, [meta.get("negative", ""), preset.get("prompt", {}).get("negative", "")]))

    plan_entry = {
        "id": asset_id,
        "source": common.relative_to_repo(source),
        "sourceSha256": common.sha256_file(source),
        "category": category,
        "type": f"character-{animation}" if animation != "background" else "background-loop",
        "workflow": workflow_id,
        "preset": preset_name,
        "seed": seed,
        "positive": positive,
        "negative": negative,
        "settings": settings,
        "alpha": use_alpha,
        "loop": loop,
        "loopMode": loop_mode,
        "frames": frames,
        "fps": output_fps,
    }

    if dry_run:
        LOG.info("dry-run: %s", json.dumps(plan_entry, indent=2))
        return {"id": asset_id, "status": "dry-run", "plan": plan_entry}

    # --- preprocess + connect -------------------------------------------
    pre = preprocess_image(source, settings, preset, run_dir, use_alpha)

    comfy = config.get("comfyui", {})
    root = comfy.get("root") or _detect_root(config)
    client = comfy_client.ComfyClient(
        host=comfy.get("host", "127.0.0.1"),
        port=int(comfy.get("port", 8188)),
        comfy_root=root,
        timeout=float(config.get("runtime", {}).get("timeout_seconds", 1800)),
        poll_interval=float(config.get("runtime", {}).get("poll_interval", 1.0)),
    )
    if not client.ping():
        raise comfy_client.ComfyError(
            f"ComfyUI not reachable at {client.base_url}. Start it with the launcher/script first."
        )

    uploaded = client.upload_image(pre["inputPath"], overwrite=True)
    uploaded_name = uploaded["name"]
    if uploaded.get("subfolder"):
        uploaded_name = f"{uploaded['subfolder']}/{uploaded_name}"

    prefix = f"ritmika/{asset_id}-{int(time.time())}"
    values = {
        "CHECKPOINT": preset.get("model", {}).get("checkpoint", settings.get("checkpoint", "v1-5-pruned-emaonly.safetensors")),
        "MOTION_MODEL": preset.get("model", {}).get("motionModel", settings.get("motionModel", "mm_sd_v15_v2.ckpt")),
        "INTERP_MODEL": preset.get("model", {}).get("interpModel", settings.get("interpModel", "rife_v4.26.safetensors")),
        "INPUT_IMAGE": uploaded_name,
        "POSITIVE": positive,
        "NEGATIVE": negative,
        "SEED": seed,
        "STEPS": int(settings.get("steps", 20)),
        "CFG": float(settings.get("cfg", 7.0)),
        "SAMPLER": settings.get("sampler", "euler"),
        "SCHEDULER": settings.get("scheduler", "karras"),
        "DENOISE": float(settings.get("denoise", 0.42)),
        "FRAMES": frames,
        "CONTEXT_LENGTH": int(settings.get("contextLength", 16)),
        "CONTEXT_OVERLAP": int(settings.get("contextOverlap", 4)),
        "CLOSED_LOOP": bool(settings.get("closedLoop", loop)),
        "MOTION_SCALE": float(settings.get("motionScale", 1.0)),
        "INTERP_MULTIPLIER": interp_multiplier,
        "PREFIX": prefix,
    }
    workflow = render_workflow(template_path, values)

    LOG.info("queue %s (seed=%s frames=%s denoise=%s)", asset_id, seed, frames, values["DENOISE"])
    started = time.time()
    vram = {"peakMiB": 0, "lastSample": 0.0}

    def on_progress(_data: dict) -> None:
        now = time.time()
        if now - vram["lastSample"] < 1.0:
            return
        vram["lastSample"] = now
        try:
            stats = client.system_stats()
            device = stats.get("devices", [{}])[0]
            used_bytes = device.get("vram_total", 0) - device.get("vram_free", 0)
            vram["peakMiB"] = max(vram["peakMiB"], used_bytes / (1024 * 1024))
        except Exception:  # noqa: BLE001
            pass

    prompt_id = client.queue_prompt(workflow)
    entry = client.wait(prompt_id, timeout=float(config.get("runtime", {}).get("timeout_seconds", 1800)),
                        on_progress=on_progress)
    elapsed = round(time.time() - started, 2)
    outputs = client.collect_outputs(entry)
    image_outputs = sorted(
        (o for o in outputs if o.get("outputType") == "images" and o.get("path")),
        key=lambda o: o["filename"],
    )
    if not image_outputs:
        raise comfy_client.ComfyError(f"No image outputs produced for {asset_id}")

    # --- post-process ---------------------------------------------------
    generated_frames = [Image.open(o["path"]).convert("RGBA") for o in image_outputs]
    rgb_frames = generated_frames
    alpha_image = None
    if use_alpha and pre["alphaPath"]:
        alpha_image = Image.open(pre["alphaPath"]).convert("L")

    if use_alpha and alpha_image is not None:
        frames = []
        rgb_frames = []
        for frame in generated_frames:
            if frame.size != alpha_image.size:
                alpha_resized = alpha_image.resize(frame.size, Image.NEAREST)
            else:
                alpha_resized = alpha_image
            rgba = frame.copy()
            rgba.putalpha(alpha_resized)
            frames.append(rgba)
            rgb_frames.append(frame.convert("RGB"))
    else:
        frames = [f.convert("RGBA") for f in generated_frames]
        rgb_frames = [f.convert("RGB") for f in generated_frames]

    frames = apply_loop(frames, loop_mode)
    rgb_frames = apply_loop(rgb_frames, loop_mode)

    outputs_config = preset.get("outputs", {})
    exported = export_animation(frames, rgb_frames, output_fps, run_dir, outputs_config, loop)
    if not keep_frames:
        shutil.rmtree(run_dir / "frames", ignore_errors=True)
        shutil.rmtree(run_dir / "frames_rgb", ignore_errors=True)

    # --- metadata + validation -----------------------------------------
    metadata: dict[str, Any] = {
        "id": asset_id,
        "status": "ok",
        "source": common.relative_to_repo(source),
        "sourceSha256": plan_entry["sourceSha256"],
        "type": plan_entry["type"],
        "category": category,
        "workflow": workflow_id,
        "workflowHash": common.sha256_text(template_path.read_text(encoding="utf-8")),
        "preset": preset_name,
        "model": values["CHECKPOINT"],
        "motionModel": values["MOTION_MODEL"],
        "interpModel": values["INTERP_MODEL"],
        "seed": seed,
        "prompt": positive,
        "negativePrompt": negative,
        "steps": values["STEPS"],
        "cfg": values["CFG"],
        "sampler": values["SAMPLER"],
        "scheduler": values["SCHEDULER"],
        "denoise": values["DENOISE"],
        "motionScale": values["MOTION_SCALE"],
        "resolution": {"width": pre["width"], "height": pre["height"]},
        "width": pre["width"],
        "height": pre["height"],
        "generatedFrames": len(generated_frames),
        "frames": len(frames),
        "fps": output_fps,
        "interpMultiplier": interp_multiplier,
        "loop": loop,
        "loopMode": loop_mode,
        "alpha": use_alpha,
        "alphaSource": "original" if use_alpha else "none",
        "alphaMethod": "source-alpha-reapply" if use_alpha else "none",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "processSeconds": elapsed,
        "comfyPromptId": prompt_id,
        "vramPeakMiB": vram["peakMiB"] or None,
        "duration": duration_of(len(frames), output_fps),
        "outputs": exported,
        "sha256": {},
    }

    for key in ("webm", "webp", "preview", "previewMp4", "spriteSheet"):
        path_value = exported.get(key)
        if path_value and Path(path_value).exists():
            metadata["sha256"][key] = common.sha256_file(path_value)

    validation = validate_output.validate_file(
        Path(exported["webm"]) if exported.get("webm") else Path(exported["preview"]),
        {
            "requireAlpha": use_alpha,
            "loop": loop,
            "fps": output_fps,
            "width": pre["width"],
            "height": pre["height"],
            "frameCount": len(frames),
        },
    )
    metadata["validation"] = validation
    common.write_json(run_dir / "validation.json", validation)
    common.write_json(metadata_path, metadata)
    LOG.info("done %s in %.1fs -> %s", asset_id, elapsed, run_dir)
    return {"id": asset_id, "status": "ok", "metadata": metadata}


def _detect_root(config: dict[str, Any]) -> str | None:
    import audit_comfyui

    return audit_comfyui.detect_comfy_root(config)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", required=True)
    parser.add_argument("--animation", required=True, choices=sorted(build_manifest.WORKFLOW_FOR_ANIMATION))
    parser.add_argument("--preset", required=True)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--frames", type=int)
    parser.add_argument("--steps", type=int)
    parser.add_argument("--cfg", type=float)
    parser.add_argument("--denoise", type=float)
    parser.add_argument("--output-fps", type=float)
    parser.add_argument("--interp-multiplier", type=int)
    parser.add_argument("--loop-mode", choices=["none", "pingpong", "crossfade"])
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--drop-frames", action="store_true", help="Delete raw frame dumps after export")
    args = parser.parse_args()

    overrides = {
        "steps": args.steps,
        "cfg": args.cfg,
        "denoise": args.denoise,
        "frames": args.frames,
        "outputFps": args.output_fps,
        "interpMultiplier": args.interp_multiplier,
        "loopMode": args.loop_mode,
    }
    result = generate_one(
        args.asset, args.animation, args.preset,
        overrides=overrides, seed=args.seed, force=args.force, dry_run=args.dry_run,
        keep_frames=not args.drop_frames,
    )
    print(json.dumps({"id": result["id"], "status": result["status"]}, ensure_ascii=False))
    return 0 if result["status"] in ("ok", "skipped", "dry-run") else 1


if __name__ == "__main__":
    raise SystemExit(main())
