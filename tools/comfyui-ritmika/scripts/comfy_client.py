#!/usr/bin/env python3
"""Minimal, dependency-light client for the local ComfyUI HTTP API.

Features
--------
* Upload input images (``/upload/image``).
* Queue API-format workflows (``/prompt``).
* Wait for completion using WebSocket progress *and* a ``/history`` polling
  fallback, so a flaky WebSocket can never hang a job.
* Detect execution errors from the history entry instead of trusting a 200 OK.
* Collect output files and resolve them to local paths (or download via
  ``/view`` when ComfyUI runs on another machine).

The client never imports torch or any ComfyUI module: it is pure HTTP.
"""

from __future__ import annotations

import json
import mimetypes
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

try:  # optional accelerator
    import websocket  # type: ignore
except ImportError:  # pragma: no cover
    websocket = None  # type: ignore


class ComfyError(RuntimeError):
    pass


class ComfyTimeout(ComfyError):
    pass


class ComfyExecutionError(ComfyError):
    pass


@dataclass
class ComfyClient:
    host: str = "127.0.0.1"
    port: int = 8188
    timeout: float = 60.0
    poll_interval: float = 1.0
    client_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    comfy_root: str | None = None

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    # -- low level ---------------------------------------------------------

    def _request(self, path: str, data: bytes | None = None, headers: dict | None = None,
                 method: str | None = None, timeout: float | None = None) -> bytes:
        url = f"{self.base_url}{path}"
        request = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
        with urllib.request.urlopen(request, timeout=timeout or self.timeout) as response:
            return response.read()

    def _get_json(self, path: str, timeout: float | None = None) -> Any:
        return json.loads(self._request(path, timeout=timeout).decode("utf-8"))

    def _post_json(self, path: str, payload: dict) -> Any:
        body = json.dumps(payload).encode("utf-8")
        raw = self._request(path, data=body, headers={"Content-Type": "application/json"}, method="POST")
        return json.loads(raw.decode("utf-8"))

    # -- endpoints ---------------------------------------------------------

    def ping(self) -> bool:
        try:
            self.system_stats()
            return True
        except Exception:  # noqa: BLE001
            return False

    def system_stats(self) -> dict:
        return self._get_json("/system_stats", timeout=10)

    def object_info(self) -> dict:
        return self._get_json("/object_info", timeout=120)

    def queue(self) -> dict:
        return self._get_json("/queue", timeout=20)

    def history(self, prompt_id: str | None = None) -> dict:
        path = "/history" if not prompt_id else f"/history/{prompt_id}"
        return self._get_json(path, timeout=30)

    def interrupt(self) -> None:
        try:
            self._request("/interrupt", method="POST")
        except Exception:  # noqa: BLE001
            pass

    def upload_image(self, filepath: str | Path, subfolder: str = "", overwrite: bool = True) -> dict:
        filepath = Path(filepath)
        boundary = "----RitmikaBoundary" + uuid.uuid4().hex
        mime = mimetypes.guess_type(filepath.name)[0] or "application/octet-stream"
        parts: list[bytes] = []

        def add_field(name: str, value: str) -> None:
            parts.append(
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
            )

        add_field("overwrite", "true" if overwrite else "false")
        add_field("subfolder", subfolder)
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{filepath.name}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n".encode()
        )
        parts.append(filepath.read_bytes())
        parts.append(f"\r\n--{boundary}--\r\n".encode())
        body = b"".join(parts)

        raw = self._request(
            "/upload/image",
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        return json.loads(raw.decode("utf-8"))

    def queue_prompt(self, workflow: dict, extra_data: dict | None = None) -> str:
        payload = {"prompt": workflow, "client_id": self.client_id}
        if extra_data:
            payload["extra_data"] = extra_data
        response = self._post_json("/prompt", payload)
        if "prompt_id" not in response:
            raise ComfyError(f"ComfyUI rejected the prompt: {response}")
        return response["prompt_id"]

    # -- waiting -----------------------------------------------------------

    def wait(self, prompt_id: str, timeout: float = 1800.0,
             on_progress: Callable[[dict], None] | None = None) -> dict:
        """Block until ``prompt_id`` finishes. Returns its history entry."""

        started = time.time()
        ws_thread = None
        if websocket is not None:
            ws_thread = self._start_ws_listener(prompt_id, on_progress, timeout)

        try:
            while True:
                entry = self.history(prompt_id).get(prompt_id)
                if entry is not None:
                    status = entry.get("status", {})
                    if status.get("completed") or status.get("status_str") in ("success", "error"):
                        self._raise_on_error(entry)
                        return entry
                if time.time() - started > timeout:
                    raise ComfyTimeout(f"Timed out after {timeout:.0f}s waiting for prompt {prompt_id}")
                if on_progress:
                    try:
                        on_progress({"state": "waiting", "elapsed": round(time.time() - started, 1)})
                    except Exception:  # noqa: BLE001
                        pass
                time.sleep(self.poll_interval)
        finally:
            if ws_thread is not None:
                ws_thread.stop()

    def _raise_on_error(self, entry: dict) -> None:
        status = entry.get("status", {})
        if status.get("status_str") == "error":
            messages = status.get("messages", [])
            detail = ""
            for message in messages:
                if isinstance(message, (list, tuple)) and len(message) > 1 and message[0] == "execution_error":
                    detail = json.dumps(message[1], ensure_ascii=False)
            raise ComfyExecutionError(f"ComfyUI execution error: {detail or messages}")

    def _start_ws_listener(self, prompt_id: str, on_progress: Callable[[dict], None] | None,
                           timeout: float):
        client = self
        ws_url = f"ws://{self.host}:{self.port}/ws?clientId={self.client_id}"

        class _Listener:
            def __init__(self) -> None:
                import threading
                self._stop = threading.Event()
                self._thread = threading.Thread(target=self._run, daemon=True)
                self._thread.start()

            def _run(self) -> None:
                try:
                    connection = websocket.create_connection(ws_url, timeout=min(timeout, 30))
                except Exception:  # noqa: BLE001 - fall back silently to polling
                    return
                try:
                    connection.settimeout(2.0)
                    while not self._stop.is_set():
                        try:
                            raw = connection.recv()
                        except websocket.WebSocketTimeoutException:
                            continue
                        except Exception:  # noqa: BLE001
                            break
                        if not raw or not isinstance(raw, str):
                            continue
                        try:
                            message = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        if message.get("type") == "progress" and on_progress:
                            try:
                                on_progress(message.get("data", {}))
                            except Exception:  # noqa: BLE001
                                pass
                finally:
                    try:
                        connection.close()
                    except Exception:  # noqa: BLE001
                        pass

            def stop(self) -> None:
                self._stop.set()

        return _Listener()

    # -- outputs -----------------------------------------------------------

    def output_path(self, item: dict) -> Path | None:
        if not self.comfy_root:
            return None
        subfolder = item.get("subfolder") or ""
        kind = item.get("type") or "output"
        if kind == "temp":
            base = Path(self.comfy_root) / "temp"
        elif kind == "input":
            base = Path(self.comfy_root) / "input"
        else:
            base = Path(self.comfy_root) / "output"
        return base / subfolder / item["filename"]

    def download_view(self, item: dict, destination: Path) -> Path:
        query = urllib.parse.urlencode({
            "filename": item["filename"],
            "subfolder": item.get("subfolder", ""),
            "type": item.get("type", "output"),
        })
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(self._request(f"/view?{query}", timeout=120))
        return destination

    def collect_outputs(self, history_entry: dict, destination_dir: Path | None = None,
                        copy: bool = False) -> list[dict]:
        """Return output file records, resolving to local paths when possible."""

        results: list[dict] = []
        for node_id, node_output in (history_entry.get("outputs") or {}).items():
            for key, items in node_output.items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    if not isinstance(item, dict) or "filename" not in item:
                        continue
                    record = {
                        "nodeId": node_id,
                        "outputType": key,
                        "filename": item["filename"],
                        "subfolder": item.get("subfolder", ""),
                        "type": item.get("type", "output"),
                    }
                    local = self.output_path(item)
                    if local and local.exists():
                        record["path"] = str(local)
                    elif destination_dir is not None:
                        target = Path(destination_dir) / item["filename"]
                        self.download_view(item, target)
                        record["path"] = str(target)
                    results.append(record)
        return results
