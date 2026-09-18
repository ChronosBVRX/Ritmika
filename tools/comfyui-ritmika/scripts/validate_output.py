#!/usr/bin/env python3
"""Validate generated animation outputs.

Never trusts "ComfyUI exited 0": checks the actual file, decodes frames and runs
simple heuristics for flicker, identity drift and loop discontinuity.

Usage:
    python validate_output.py --file out/clip.webm --require-alpha --expected-fps 24
    python validate_output.py --manifest ../../manifests/output-manifest.json
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None  # type: ignore[assignment]

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]

VIDEO_EXTENSIONS = {".webm", ".mp4", ".mov", ".mkv", ".gif"}


def ffprobe(path: Path) -> dict[str, Any] | None:
    ffprobe_bin = shutil.which("ffprobe")
    if not ffprobe_bin:
        return None
    out = subprocess.run(
        [ffprobe_bin, "-v", "error", "-print_format", "json",
         "-show_streams", "-show_format", str(path)],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        return None
    return json.loads(out.stdout)


def extract_frames(path: Path, workdir: Path, cap: int = 64) -> list[Path]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return []
    out_pattern = workdir / "v_%05d.png"
    command = [ffmpeg, "-y"]
    if path.suffix.lower() == ".webm":
        # Native ffmpeg VP9 decoder drops the alpha plane; libvpx preserves it.
        command += ["-c:v", "libvpx-vp9"]
    command += ["-i", str(path), "-frames:v", str(cap), "-vsync", "0", str(out_pattern)]
    subprocess.run(command, check=True, capture_output=True)
    return sorted(workdir.glob("v_*.png"))


def load_frames(path: Path) -> list["np.ndarray"]:
    if np is None or Image is None:
        return []
    frames: list[np.ndarray] = []
    if path.suffix.lower() in VIDEO_EXTENSIONS:
        with tempfile.TemporaryDirectory(prefix="ritmika_val_") as tmp:
            extracted = extract_frames(path, Path(tmp))
            for frame_path in extracted:
                with Image.open(frame_path) as image:
                    frames.append(np.asarray(image.convert("RGBA"), dtype=np.float32))
    else:
        with Image.open(path) as image:
            if getattr(image, "is_animated", False):
                for index in range(min(getattr(image, "n_frames", 1), 64)):
                    image.seek(index)
                    frames.append(np.asarray(image.convert("RGBA"), dtype=np.float32))
            else:
                frames.append(np.asarray(image.convert("RGBA"), dtype=np.float32))
    return frames


def _mean_abs_diff(a: "np.ndarray", b: "np.ndarray") -> float:
    if a.shape != b.shape:
        from PIL import Image as _Image
        b_img = _Image.fromarray(b.astype("uint8")).resize((a.shape[1], a.shape[0]))
        b = np.asarray(b_img, dtype=np.float32)

    diff = np.abs(a - b)
    # If the frames carry alpha, only compare pixels that are opaque in both,
    # otherwise large transparent areas dilute the metric to near zero.
    if a.ndim == 3 and a.shape[2] == 4:
        mask = (a[..., 3] > 8) & (b[..., 3] > 8)
        if mask.any():
            diff = diff[..., :3][mask]
            return float(np.mean(diff) / 255.0) if diff.size else 0.0
        return 0.0
    return float(np.mean(diff) / 255.0)


def heuristics(frames: list["np.ndarray"]) -> dict[str, Any]:
    if np is None or len(frames) < 2:
        return {"available": False}
    diffs = [_mean_abs_diff(frames[i], frames[i + 1]) for i in range(len(frames) - 1)]
    drift = [_mean_abs_diff(frames[0], frames[i]) for i in range(1, len(frames))]
    return {
        "available": True,
        "flicker": round(sum(diffs) / len(diffs), 5),
        "maxConsecutiveDiff": round(max(diffs), 5),
        "identityDrift": round(sum(drift) / len(drift), 5),
        "maxIdentityDrift": round(max(drift), 5),
        "loopGap": round(_mean_abs_diff(frames[0], frames[-1]), 5),
    }


def validate_file(path: Path, expected: dict[str, Any] | None = None) -> dict[str, Any]:
    expected = expected or {}
    report: dict[str, Any] = {
        "file": str(path),
        "exists": path.exists(),
        "errors": [],
        "warnings": [],
        "metrics": {},
        "ok": False,
    }
    if not path.exists():
        report["errors"].append("file does not exist")
        return report

    size = path.stat().st_size
    report["metrics"]["sizeBytes"] = size
    if size <= 0:
        report["errors"].append("file is empty")
        return report

    is_video = path.suffix.lower() in VIDEO_EXTENSIONS
    probe = ffprobe(path) if is_video else None

    if probe:
        stream = next((s for s in probe.get("streams", []) if s.get("codec_type") == "video"), None)
        if stream is None:
            report["errors"].append("no video stream found")
        else:
            tags = stream.get("tags", {}) or {}
            report["metrics"].update({
                "width": stream.get("width"),
                "height": stream.get("height"),
                "codec": stream.get("codec_name"),
                "pixFmt": stream.get("pix_fmt"),
                "fps": _parse_fraction(stream.get("avg_frame_rate") or stream.get("r_frame_rate")),
                "frameCount": int(stream.get("nb_frames")) if str(stream.get("nb_frames", "")).isdigit() else None,
                "duration": _parse_float(probe.get("format", {}).get("duration")),
            })
            # VP9/WebM stores alpha in a side channel: pix_fmt stays yuv420p but
            # the stream is tagged alpha_mode=1.
            report["metrics"]["hasAlpha"] = (
                "a" in (stream.get("pix_fmt") or "")
                or str(tags.get("alpha_mode", "")) == "1"
            )
    elif Image is not None and path.suffix.lower() not in (".json",):
        try:
            with Image.open(path) as image:
                report["metrics"].update({
                    "width": image.size[0],
                    "height": image.size[1],
                    "format": image.format,
                    "mode": image.mode,
                    "frameCount": int(getattr(image, "n_frames", 1)),
                    "hasAlpha": "A" in image.getbands() or "transparency" in image.info,
                    "duration": None,
                    "fps": expected.get("fps"),
                })
                if getattr(image, "is_animated", False):
                    duration_ms = image.info.get("duration")
                    if duration_ms:
                        report["metrics"]["duration"] = (
                            duration_ms * image.n_frames / 1000.0
                        )
        except Exception as exc:  # noqa: BLE001
            report["errors"].append(f"cannot open image: {exc}")

    # Expected checks
    checks = {
        "width": expected.get("width"),
        "height": expected.get("height"),
        "fps": expected.get("fps"),
        "frameCount": expected.get("frameCount"),
    }
    for key, value in checks.items():
        actual = report["metrics"].get(key)
        if value is not None and actual is not None:
            if key == "fps" and abs(float(actual) - float(value)) > 0.75:
                report["warnings"].append(f"fps {actual} != expected {value}")
            elif key in ("width", "height", "frameCount") and int(actual) != int(value):
                report["errors"].append(f"{key} {actual} != expected {value}")

    if expected.get("requireAlpha") and not report["metrics"].get("hasAlpha"):
        report["errors"].append("alpha required but not present")

    max_size = expected.get("maxSizeBytes")
    if max_size and size > max_size:
        report["warnings"].append(f"file larger than target ({size} > {max_size})")

    # Decode + heuristics
    frames = load_frames(path)
    report["metrics"]["decodedFrames"] = len(frames)
    if not frames:
        report["warnings"].append("could not decode frames for heuristic checks")
    else:
        report["metrics"]["heuristics"] = heuristics(frames)
        if report["metrics"]["heuristics"].get("available"):
            h = report["metrics"]["heuristics"]
            if h["flicker"] > 0.08:
                report["warnings"].append(f"high flicker ({h['flicker']})")
            if h["maxIdentityDrift"] > 0.35:
                report["warnings"].append(f"large identity drift ({h['maxIdentityDrift']})")
            if expected.get("loop") and h["loopGap"] > 0.12:
                report["warnings"].append(f"loop gap may be visible ({h['loopGap']})")

    report["ok"] = not report["errors"]
    return report


def _parse_fraction(value: str | None) -> float | None:
    if not value or value == "0/0":
        return None
    if "/" in value:
        num, den = value.split("/")
        return round(float(num) / float(den), 3) if float(den) else None
    return round(float(value), 3)


def _parse_float(value: Any) -> float | None:
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file")
    parser.add_argument("--manifest")
    parser.add_argument("--require-alpha", action="store_true")
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--expected-fps", type=float)
    parser.add_argument("--expected-width", type=int)
    parser.add_argument("--expected-height", type=int)
    parser.add_argument("--expected-frames", type=int)
    parser.add_argument("--report")
    args = parser.parse_args()

    reports: list[dict[str, Any]] = []
    if args.file:
        expected = {
            "requireAlpha": args.require_alpha,
            "loop": args.loop,
            "fps": args.expected_fps,
            "width": args.expected_width,
            "height": args.expected_height,
            "frameCount": args.expected_frames,
        }
        reports.append(validate_file(Path(args.file), expected))
    elif args.manifest:
        manifest = common.read_json(args.manifest, {}) or {}
        for item in manifest.get("items", []):
            for key, value in (item.get("outputs") or {}).items():
                if key in ("preview", "spriteSheet"):
                    continue
                reports.append(validate_file(Path(value), {
                    "requireAlpha": item.get("alpha", False),
                    "loop": item.get("loop", False),
                    "fps": item.get("fps"),
                    "width": item.get("width"),
                    "height": item.get("height"),
                }))
    else:
        parser.error("Provide --file or --manifest")

    failed = 0
    for report in reports:
        status = "OK " if report["ok"] else "FAIL"
        print(f"[{status}] {report['file']}")
        for error in report["errors"]:
            print(f"        error: {error}")
        for warning in report["warnings"]:
            print(f"        warn:  {warning}")
        if not report["ok"]:
            failed += 1

    if args.report:
        common.write_json(args.report, {"reports": reports, "failed": failed})

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
