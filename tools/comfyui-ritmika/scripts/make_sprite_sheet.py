#!/usr/bin/env python3
"""Build a sprite sheet (plus companion JSON) from a frame sequence or video.

Usage:
    python make_sprite_sheet.py --frames-dir out/frames --output sheet.png
    python make_sprite_sheet.py --input clip.webm --output sheet.webp --columns 8

The JSON companion contains: frameWidth, frameHeight, columns, rows, frameCount, fps.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]


def list_frames(frames_dir: Path) -> list[Path]:
    frames = [
        p for p in sorted(frames_dir.iterdir())
        if p.is_file() and p.suffix.lower() in (".png", ".webp", ".jpg", ".jpeg")
    ]
    if not frames:
        raise FileNotFoundError(f"No frames found in {frames_dir}")
    return frames


def extract_video_frames(video: Path, workdir: Path) -> list[Path]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to extract frames from a video")
    out_pattern = workdir / "frame_%05d.png"
    subprocess.run(
        [ffmpeg, "-y", "-i", str(video), "-vsync", "0", str(out_pattern)],
        check=True, capture_output=True,
    )
    return sorted(workdir.glob("frame_*.png"))


def build_sprite_sheet(frames: list[Path], output: Path, columns: int | None = None,
                       padding: int = 0, background: tuple = (0, 0, 0, 0),
                       fps: float = 24.0, max_frame_dimension: int = 0) -> dict[str, Any]:
    if Image is None:
        raise RuntimeError("Pillow is required to build sprite sheets")

    images = [Image.open(frame).convert("RGBA") for frame in frames]
    frame_w, frame_h = images[0].size
    if max_frame_dimension and max(frame_w, frame_h) > max_frame_dimension:
        scale = max_frame_dimension / max(frame_w, frame_h)
        frame_w, frame_h = max(1, int(frame_w * scale)), max(1, int(frame_h * scale))
        images = [image.resize((frame_w, frame_h), Image.LANCZOS) for image in images]
    count = len(images)
    columns = columns or max(1, math.ceil(math.sqrt(count)))
    columns = min(columns, count)
    rows = math.ceil(count / columns)

    sheet_w = columns * frame_w + (columns - 1) * padding
    sheet_h = rows * frame_h + (rows - 1) * padding
    sheet = Image.new("RGBA", (sheet_w, sheet_h), background)

    for index, image in enumerate(images):
        if image.size != (frame_w, frame_h):
            image = image.resize((frame_w, frame_h), Image.LANCZOS)
        row, col = divmod(index, columns)
        sheet.paste(image, (col * (frame_w + padding), row * (frame_h + padding)), image)

    output.parent.mkdir(parents=True, exist_ok=True)
    save_kwargs: dict[str, Any] = {}
    if output.suffix.lower() == ".webp":
        save_kwargs = {"lossless": True, "quality": 100}
    sheet.save(output, **save_kwargs)

    metadata = {
        "source": str(output),
        "frameWidth": frame_w,
        "frameHeight": frame_h,
        "columns": columns,
        "rows": rows,
        "frameCount": count,
        "fps": fps,
        "padding": padding,
        "sheetWidth": sheet_w,
        "sheetHeight": sheet_h,
    }
    return metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frames-dir", help="Directory of ordered frame images")
    parser.add_argument("--input", help="Video file to extract frames from")
    parser.add_argument("--output", required=True, help="Output sprite sheet path")
    parser.add_argument("--columns", type=int, default=None)
    parser.add_argument("--padding", type=int, default=0)
    parser.add_argument("--fps", type=float, default=24.0)
    args = parser.parse_args()

    if not args.frames_dir and not args.input:
        parser.error("Provide --frames-dir or --input")

    output = Path(args.output)
    tmp_ctx = None
    try:
        if args.frames_dir:
            frames = list_frames(Path(args.frames_dir))
        else:
            tmp_ctx = tempfile.TemporaryDirectory(prefix="ritmika_sheet_")
            frames = extract_video_frames(Path(args.input), Path(tmp_ctx.name))
        metadata = build_sprite_sheet(frames, output, columns=args.columns,
                                      padding=args.padding, fps=args.fps)
    finally:
        if tmp_ctx is not None:
            tmp_ctx.cleanup()

    json_path = output.with_suffix(output.suffix + ".json")
    common.write_json(json_path, metadata)
    print(f"Sprite sheet: {output} ({metadata['columns']}x{metadata['rows']}, {metadata['frameCount']} frames)")
    print(f"Metadata:     {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
