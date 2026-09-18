#!/usr/bin/env python3
"""Inventory every raster asset in ``public/assets`` (read-only).

Produces ``manifests/source-assets.json`` with dimensions, alpha statistics,
size, SHA-256 and an inferred category. The original files are never modified.

Usage:
    python inventory_assets.py [--assets-dir public/assets] [--output ...]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]


def infer_category(rel_path: str) -> str:
    lower = rel_path.lower()
    name = Path(lower).name

    if "axolo" in lower:
        return "axolo"
    if "/avatars/" in lower or name.startswith("avatar"):
        return "avatar"
    if name.startswith("podium") or "podium" in lower:
        return "podium"
    if "roulette" in lower:
        return "roulette"
    if "lobby" in lower:
        return "lobby"
    if name.startswith("bg_") or "background" in lower or "bg_neon" in lower or "loading_bg" in lower:
        return "background"
    if any(token in name for token in ("particle", "glow", "splat", "projectile", "feather", "sparkle", "star")):
        return "fx"
    if any(token in name for token in ("deco", "crown", "frame", "trophy", "award", "logo", "icon", "tomato", "qr")):
        return "decoration"
    return "other"


def alpha_stats(image: "Image.Image") -> dict[str, Any]:
    bands = image.getbands()
    has_alpha = "A" in bands or "transparency" in image.info
    if not has_alpha:
        return {
            "hasAlpha": False,
            "alphaBand": None,
            "fullyTransparentPct": 0.0,
            "semiTransparentPct": 0.0,
            "alphaCoveragePct": 100.0,
        }

    if "A" in bands:
        alpha = image.getchannel("A")
    else:
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")

    hist = alpha.histogram()
    total = max(1, sum(hist))
    fully = sum(hist[0:16])
    semi = sum(hist[16:250])
    return {
        "hasAlpha": True,
        "alphaBand": "A",
        "fullyTransparentPct": round(fully / total * 100, 3),
        "semiTransparentPct": round(semi / total * 100, 3),
        "alphaCoveragePct": round((total - fully) / total * 100, 3),
    }


def inspect_asset(path: Path) -> dict[str, Any]:
    rel = common.relative_to_repo(path)
    info: dict[str, Any] = {
        "path": rel,
        "name": path.name,
        "extension": path.suffix.lower(),
        "sizeBytes": path.stat().st_size,
        "sha256": common.sha256_file(path),
        "category": infer_category(rel),
    }
    if Image is None:
        info["error"] = "Pillow not installed"
        return info

    try:
        with Image.open(path) as image:
            width, height = image.size
            info.update({
                "width": width,
                "height": height,
                "aspectRatio": round(width / height, 4) if height else None,
                "mode": image.mode,
                "channels": len(image.getbands()),
                "format": image.format,
                "isAnimated": bool(getattr(image, "is_animated", False)),
                "frameCount": int(getattr(image, "n_frames", 1)),
            })
            info.update(alpha_stats(image))
    except Exception as exc:  # noqa: BLE001 - inventory must not crash
        info["error"] = str(exc)
    return info


def build_inventory(assets_dir: Path) -> dict[str, Any]:
    assets: list[dict[str, Any]] = []
    for path in sorted(assets_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in common.IMAGE_EXTENSIONS:
            continue
        assets.append(inspect_asset(path))

    by_category: dict[str, int] = {}
    for asset in assets:
        by_category[asset["category"]] = by_category.get(asset["category"], 0) + 1

    return {
        "generatedAt": __import__("time").strftime("%Y-%m-%dT%H:%M:%S%z"),
        "assetsRoot": common.relative_to_repo(assets_dir),
        "count": len(assets),
        "byCategory": dict(sorted(by_category.items())),
        "assets": assets,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-dir", default=str(common.ASSETS_DIR))
    parser.add_argument("--output", default=str(common.MANIFESTS_DIR / "source-assets.json"))
    args = parser.parse_args()

    assets_dir = Path(args.assets_dir)
    if not assets_dir.is_absolute():
        assets_dir = (common.REPO_ROOT / assets_dir).resolve()
    if not assets_dir.is_dir():
        print(f"Assets directory not found: {assets_dir}", file=sys.stderr)
        return 2

    inventory = build_inventory(assets_dir)
    common.write_json(args.output, inventory)
    print(f"Inventoried {inventory['count']} assets -> {args.output}")
    for category, count in inventory["byCategory"].items():
        print(f"  {category:12} {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
