#!/usr/bin/env python3
"""Build the animation plan and the runtime-independent output manifest.

* ``--plan``    (default) reads ``manifests/source-assets.json`` and writes
  ``manifests/animation-plan.json``: what should be animated, with which
  workflow, preset and priority.
* ``--outputs`` scans the external generated directory for per-asset metadata
  and writes ``manifests/output-manifest.json``: the contract Rítmika will
  consume later (not wired into the game yet).

Usage:
    python build_manifest.py
    python build_manifest.py --outputs
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def animation_specs_for(asset: dict[str, Any]) -> list[dict[str, Any]]:
    """Return which animations make sense for a given asset."""

    category = asset["category"]
    name = asset["name"].lower()
    alpha = bool(asset.get("hasAlpha"))

    if category == "axolo":
        if "vignette" in name:
            return [
                {"animation": "idle", "priority": "high", "preset": "axolo"},
                {"animation": "reaction", "priority": "high", "preset": "reaction"},
                {"animation": "talking", "priority": "medium", "preset": "axolo"},
            ]
        return [{"animation": "idle", "priority": "medium", "preset": "axolo"}]

    if category == "avatar":
        return [
            {"animation": "idle", "priority": "high", "preset": "avatar"},
            {"animation": "reaction", "priority": "medium", "preset": "reaction"},
        ]

    if category in ("background", "lobby", "podium", "roulette"):
        if not alpha or "bg" in name or "lobby_bg" in name or "stage" in name or "stadium" in name:
            return [{"animation": "background", "priority": "medium", "preset": "background"}]
        return [{"animation": "idle", "priority": "low", "preset": "axolo"}]

    if category == "fx":
        return [{"animation": "background", "priority": "low", "preset": "background"}]

    return []


WORKFLOW_FOR_ANIMATION = {
    "idle": "character_idle",
    "reaction": "character_reaction",
    "talking": "character_talking",
    "background": "background_loop",
}

LOOP_FOR_ANIMATION = {"idle": True, "talking": True, "background": True, "reaction": False}
DURATION_TARGET = {"idle": 2.0, "reaction": 1.4, "talking": 2.0, "background": 4.0}


def build_plan(inventory: dict[str, Any]) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    for asset in inventory.get("assets", []):
        if "error" in asset:
            continue
        for spec in animation_specs_for(asset):
            animation = spec["animation"]
            stem = Path(asset["name"]).stem
            entry = {
                "id": f"{slugify(stem)}-{animation}",
                "source": asset["path"],
                "sourceSha256": asset["sha256"],
                "category": asset["category"],
                "animationType": animation,
                "priority": spec["priority"],
                "loop": LOOP_FOR_ANIMATION[animation],
                "alphaRequired": bool(asset.get("hasAlpha")),
                "durationTarget": DURATION_TARGET[animation],
                "preferredWorkflow": WORKFLOW_FOR_ANIMATION[animation],
                "preset": spec["preset"],
                "width": asset.get("width"),
                "height": asset.get("height"),
                "status": "pending",
            }
            entries.append(entry)

    priority_order = {"high": 0, "medium": 1, "low": 2}
    entries.sort(key=lambda e: (priority_order.get(e["priority"], 9), e["category"], e["id"]))
    return {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "source": "manifests/source-assets.json",
        "count": len(entries),
        "byAnimation": _count_by(entries, "animationType"),
        "byPriority": _count_by(entries, "priority"),
        "entries": entries,
    }


def _count_by(entries: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in entries:
        counts[entry[key]] = counts.get(entry[key], 0) + 1
    return dict(sorted(counts.items()))


def _portable_path(value: Any, generated_dir: Path) -> Any:
    if not isinstance(value, str) or not value:
        return value
    path = Path(value)
    try:
        return str(path.relative_to(generated_dir)).replace("\\", "/")
    except ValueError:
        return value


def build_output_manifest(generated_dir: Path) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for metadata_path in sorted(generated_dir.glob("**/metadata.json")):
        metadata = common.read_json(metadata_path, {}) or {}
        if not metadata.get("id"):
            continue
        outputs = {
            key: _portable_path(value, generated_dir)
            for key, value in (metadata.get("outputs") or {}).items()
        }
        item = {
            "id": metadata["id"],
            "source": metadata.get("source"),
            "sourceSha256": metadata.get("sourceSha256"),
            "type": metadata.get("type"),
            "outputs": outputs,
            "width": metadata.get("width"),
            "height": metadata.get("height"),
            "fps": metadata.get("fps"),
            "duration": metadata.get("duration"),
            "loop": metadata.get("loop"),
            "alpha": metadata.get("alpha"),
            "sha256": metadata.get("sha256"),
            "metadata": str(metadata_path.relative_to(generated_dir)).replace("\\", "/"),
        }
        items.append(item)

    items.sort(key=lambda i: i["id"])
    return {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "generatedDir": str(generated_dir),
        "count": len(items),
        "items": items,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", action="store_true", help="Build animation-plan.json (default)")
    parser.add_argument("--outputs", action="store_true", help="Build output-manifest.json from generated dir")
    parser.add_argument("--inventory", default=str(common.MANIFESTS_DIR / "source-assets.json"))
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    if args.outputs:
        output = Path(args.output) if args.output else common.MANIFESTS_DIR / "output-manifest.json"
        manifest = build_output_manifest(common.generated_dir())
        common.write_json(output, manifest)
        print(f"Output manifest: {manifest['count']} items -> {output}")
        return 0

    inventory = common.read_json(args.inventory, None)
    if inventory is None:
        print(f"Inventory not found: {args.inventory}. Run inventory_assets.py first.", file=sys.stderr)
        return 2
    output = Path(args.output) if args.output else common.MANIFESTS_DIR / "animation-plan.json"
    plan = build_plan(inventory)
    common.write_json(output, plan)
    print(f"Animation plan: {plan['count']} entries -> {output}")
    for animation, count in plan["byAnimation"].items():
        print(f"  {animation:12} {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
