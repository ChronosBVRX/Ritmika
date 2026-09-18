#!/usr/bin/env python3
"""Audit the locally installed ComfyUI instance used for Rítmika asset production.

Read-only. Never installs, upgrades or downloads anything. Produces
``reports/comfyui-environment.json`` with enough detail to reproduce and debug
the asset pipeline.

Usage:
    python audit_comfyui.py [--host 127.0.0.1] [--port 8188] [--hash-models]
"""

from __future__ import annotations

import argparse
import json
import platform
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import common  # noqa: E402

CANDIDATE_ROOTS = [
    "~/ComfyUI",
    "~/comfyui",
    "~/Comfy",
    "~/Escritorio/Comfy",
    "~/Escritorio/ComfyUI",
    "~/Desktop/Comfy",
    "~/Desktop/ComfyUI",
    "~/Documents/ComfyUI",
    "~/Documentos/ComfyUI",
    "/opt/ComfyUI",
    "/opt/comfyui",
]

CANDIDATE_PORTS = [8188, 8189, 8190, 8000, 8080, 3000]

# capability -> regex fragments looked up in ComfyUI's /object_info node classes
CAPABILITIES = {
    "animatediff": ["ADE_", "AnimateDiff", "MotionModel"],
    "video_helper_suite": ["VHS_"],
    "controlnet_aux": ["ControlNetPreprocessorSelector", "AIO_Preprocessor", "DWPreprocessor"],
    "advanced_controlnet": ["ControlNetApplyAdvanced", "ControlNetLoader"],
    "ipadapter": ["IPAdapter", "IPAdapterAdvanced", "IPAdapterUnifiedLoader"],
    "rife_interpolation": ["FrameInterpolate", "FrameInterpolationModelLoader"],
    "background_removal": ["RemoveBackground", "LoadBackgroundRemovalModel", "BRIA"],
    "liveportrait": ["LivePortrait"],
    "batch_iteration": ["VHS_LoadImagesPath", "LoadImageDataSetFromFolder", "RepeatImageBatch"],
    "save_animated": ["SaveAnimatedWEBP", "SaveAnimatedPNG", "SaveWEBM", "VHS_VideoCombine"],
}


def detect_comfy_root(config: dict[str, Any]) -> str | None:
    configured = (config.get("comfyui") or {}).get("root")
    candidates = ([configured] if configured else []) + CANDIDATE_ROOTS
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).expanduser()
        if (path / "main.py").exists() and (path / "comfyui_version.py").exists():
            return str(path.resolve())
    return None


def get_json(url: str, timeout: float = 20.0) -> Any:
    import urllib.request

    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def probe_server(host: str, port: int, timeout: float = 3.0) -> dict[str, Any] | None:
    import urllib.error
    import urllib.request

    url = f"http://{host}:{port}/system_stats"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            stats = json.loads(response.read().decode("utf-8"))
        return {"host": host, "port": port, "url": url, "system_stats": stats}
    except (urllib.error.URLError, OSError, TimeoutError):
        return None


def detect_server(config: dict[str, Any]) -> dict[str, Any] | None:
    comfy = config.get("comfyui") or {}
    host = comfy.get("host", "127.0.0.1")
    configured_port = int(comfy.get("port", 8188))
    ports = [configured_port] + [p for p in CANDIDATE_PORTS if p != configured_port]
    for port in ports:
        result = probe_server(host, port)
        if result:
            return result
    return None


def git_info(path: Path) -> dict[str, Any] | None:
    if not (path / ".git").exists():
        return None
    try:
        commit = subprocess.run(
            ["git", "-C", str(path), "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=10,
        ).stdout.strip()
        date = subprocess.run(
            ["git", "-C", str(path), "log", "-1", "--format=%cI"],
            capture_output=True, text=True, timeout=10,
        ).stdout.strip()
        subject = subprocess.run(
            ["git", "-C", str(path), "log", "-1", "--format=%s"],
            capture_output=True, text=True, timeout=10,
        ).stdout.strip()
        return {"commit": commit, "date": date, "subject": subject}
    except Exception as exc:  # noqa: BLE001 - audit must never crash
        return {"error": str(exc)}


def scan_custom_nodes(root: Path) -> list[dict[str, Any]]:
    nodes_dir = root / "custom_nodes"
    if not nodes_dir.is_dir():
        return []
    entries: list[dict[str, Any]] = []
    for child in sorted(nodes_dir.iterdir()):
        if not child.is_dir() or child.name.startswith("__"):
            continue
        if not (child / "__init__.py").exists():
            continue
        entries.append({
            "name": child.name,
            "path": str(child),
            "has_requirements": (child / "requirements.txt").exists(),
            "git": git_info(child),
        })
    return entries


def scan_models(root: Path, hash_models: bool = False) -> dict[str, list[dict[str, Any]]]:
    models_dir = root / "models"
    result: dict[str, list[dict[str, Any]]] = {}
    if not models_dir.is_dir():
        return result
    for folder in sorted(models_dir.iterdir()):
        if not folder.is_dir():
            continue
        files: list[dict[str, Any]] = []
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path.name.startswith("put_"):
                continue
            if path.suffix.lower() not in {".safetensors", ".ckpt", ".pth", ".pt", ".bin", ".onnx", ".yaml", ".json"}:
                continue
            info: dict[str, Any] = {
                "name": path.name,
                "size_bytes": path.stat().st_size,
                "relative": str(path.relative_to(models_dir)).replace("\\", "/"),
            }
            if hash_models and path.stat().st_size < 2 * 1024**3:
                info["sha256"] = common.sha256_file(path)
            files.append(info)
        if files:
            result[folder.name] = files
    return result


def capability_report(object_info: dict[str, Any]) -> dict[str, Any]:
    classes = set(object_info.keys())
    report: dict[str, Any] = {}
    for capability, needles in CAPABILITIES.items():
        matches = sorted(
            cls for cls in classes
            if any(needle.lower() in cls.lower() for needle in needles)
        )
        report[capability] = {"available": bool(matches), "nodes": matches[:20]}
    return report


def pipeline_installs() -> list[dict[str, Any]]:
    return common.read_json(common.REPORTS_DIR / "pipeline-installs.json", []) or []


def nvidia_smi() -> dict[str, Any]:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,driver_version,compute_cap",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=15,
        )
        gpus = []
        for line in out.stdout.strip().splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 5:
                gpus.append({
                    "name": parts[0], "memory_total_mib": parts[1],
                    "memory_used_mib": parts[2], "driver": parts[3], "compute_cap": parts[4],
                })
        return {"gpus": gpus}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    config = common.load_config()
    root = detect_comfy_root(config)
    server = detect_server(config)

    report: dict[str, Any] = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "host_platform": {
            "os": platform.platform(),
            "python": platform.python_version(),
            "machine": platform.machine(),
        },
        "comfyui": {
            "root": root,
            "version": None,
            "server": None,
            "object_info_node_count": None,
            "queue": None,
        },
        "custom_nodes": [],
        "capabilities": {},
        "models": {},
        "pipeline_installed": pipeline_installs(),
        "nvidia_smi": nvidia_smi(),
    }

    if root:
        version_file = Path(root) / "comfyui_version.py"
        if version_file.exists():
            namespace: dict[str, Any] = {}
            exec(version_file.read_text(encoding="utf-8"), namespace)  # noqa: S102
            report["comfyui"]["version"] = namespace.get("__version__")
        report["comfyui"]["git"] = git_info(Path(root))
        report["custom_nodes"] = scan_custom_nodes(Path(root))
        report["models"] = scan_models(Path(root), hash_models=args.hash_models)

    if server:
        report["comfyui"]["server"] = {
            "host": server["host"],
            "port": server["port"],
            "url": server["url"],
            "system": server["system_stats"].get("system"),
            "devices": server["system_stats"].get("devices"),
        }
        try:
            object_info = get_json(f"http://{server['host']}:{server['port']}/object_info", timeout=60)
            report["comfyui"]["object_info_node_count"] = len(object_info)
            report["capabilities"] = capability_report(object_info)
        except Exception as exc:  # noqa: BLE001
            report["comfyui"]["object_info_error"] = str(exc)
        try:
            report["comfyui"]["queue"] = get_json(f"http://{server['host']}:{server['port']}/queue", timeout=20)
        except Exception as exc:  # noqa: BLE001
            report["comfyui"]["queue_error"] = str(exc)

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", help="ComfyUI host (default from config)")
    parser.add_argument("--port", type=int, help="ComfyUI port (default from config)")
    parser.add_argument("--hash-models", action="store_true", help="Also SHA-256 model files under 2GB")
    parser.add_argument("--output", help="Output JSON path")
    args = parser.parse_args()

    # Allow CLI host/port to override probing by writing them into a temp config view.
    if args.host or args.port:
        config = common.load_config()
        if args.host:
            config.setdefault("comfyui", {})["host"] = args.host
        if args.port:
            config.setdefault("comfyui", {})["port"] = args.port
        original_loader = common.load_config
        common.load_config = lambda: config  # type: ignore[assignment]
        try:
            report = build_report(args)
        finally:
            common.load_config = original_loader  # type: ignore[assignment]
    else:
        report = build_report(args)

    output = Path(args.output) if args.output else common.REPORTS_DIR / "comfyui-environment.json"
    common.write_json(output, report)

    server = report["comfyui"].get("server")
    if server:
        print(f"ComfyUI {report['comfyui']['version']} at http://{server['host']}:{server['port']}")
    else:
        print("ComfyUI server NOT reachable (report still written)")
    print(f"Report: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
