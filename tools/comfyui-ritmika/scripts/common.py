"""Shared helpers for the Rítmika ComfyUI asset animation pipeline.

This module is intentionally dependency-light (stdlib + Pillow optional) so it can
be imported by every other script without side effects.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# scripts/common.py -> scripts -> comfyui-ritmika -> tools -> <repo root>
REPO_ROOT = Path(__file__).resolve().parents[3]
TOOL_DIR = REPO_ROOT / "tools" / "comfyui-ritmika"
SCRIPTS_DIR = TOOL_DIR / "scripts"
WORKFLOWS_DIR = TOOL_DIR / "workflows"
PRESETS_DIR = TOOL_DIR / "presets"
MANIFESTS_DIR = TOOL_DIR / "manifests"
REPORTS_DIR = TOOL_DIR / "reports"

ASSETS_DIR = REPO_ROOT / "public" / "assets"

CONFIG_PATH = TOOL_DIR / "config.json"
CONFIG_EXAMPLE_PATH = TOOL_DIR / "config.example.json"

IMAGE_EXTENSIONS = {".png", ".webp", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff"}


def repo_root() -> Path:
    return REPO_ROOT


def load_config() -> dict[str, Any]:
    """Load config.json, falling back to config.example.json.

    Environment variables always win so CI/other machines can override without
    editing tracked files.
    """

    base: dict[str, Any] = {}
    if CONFIG_EXAMPLE_PATH.exists():
        base = json.loads(CONFIG_EXAMPLE_PATH.read_text(encoding="utf-8"))
    if CONFIG_PATH.exists():
        user = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        base = deep_merge(base, user)

    comfy = base.setdefault("comfyui", {})
    if os.environ.get("COMFYUI_HOST"):
        comfy["host"] = os.environ["COMFYUI_HOST"]
    if os.environ.get("COMFYUI_PORT"):
        comfy["port"] = int(os.environ["COMFYUI_PORT"])
    if os.environ.get("COMFYUI_ROOT"):
        comfy["root"] = os.environ["COMFYUI_ROOT"]

    return base


def deep_merge(a: dict, b: dict) -> dict:
    out = dict(a)
    for key, value in b.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def generated_dir(config: dict[str, Any] | None = None) -> Path:
    """Directory for all generated (heavy) outputs.

    Never inside the repo by default, so the migration branch and Git stay clean.
    """

    env = os.environ.get("RITMIKA_GENERATED_DIR")
    if env:
        path = Path(env).expanduser().resolve()
    else:
        config = config or load_config()
        configured = (config.get("paths") or {}).get("generated_dir")
        if configured:
            path = Path(configured).expanduser()
            if not path.is_absolute():
                path = (REPO_ROOT / path).resolve()
        else:
            path = (REPO_ROOT.parent / "Ritmika-generated-assets").resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------


def setup_logging(name: str, verbose: bool = False) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    return logger


# ---------------------------------------------------------------------------
# Hashing / filesystem
# ---------------------------------------------------------------------------


def sha256_file(path: Path | str, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def relative_to_repo(path: Path | str) -> str:
    path = Path(path).resolve()
    try:
        return str(path.relative_to(REPO_ROOT)).replace(os.sep, "/")
    except ValueError:
        return str(path)


def read_json(path: Path | str, default: Any = None) -> Any:
    path = Path(path)
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path | str, data: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run_command(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, **kwargs)
