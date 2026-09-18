# Rítmika · ComfyUI Asset Animation Pipeline

Offline **asset production** tool that turns the static Rítmika assets
(Tío Axolo, avatars, backgrounds, podium/lobby decorations, FX) into reusable
animated assets using the local ComfyUI installation.

> **Not part of the game runtime.** Rítmika never runs ComfyUI during a match.
> This tool only produces files. A future Rítmika build will consume the
> approved outputs described by `manifests/output-manifest.json`.

```
asset original (read-only)
      ↓
ComfyUI offline (AnimateDiff + SD1.5 + RIFE)
      ↓
asset animado aprobado
      ↓
optimización / export (webm · webp · sprite sheet)
      ↓
manifest  →  Rítmika (integración futura)
```

The pipeline is fully isolated from the `feat/desktop-local-online-relay`
migration branch: it lives under `tools/comfyui-ritmika/` and writes all heavy
outputs to an **external** directory (`RITMIKA_GENERATED_DIR`).

---

## 1. Requirements

* Local ComfyUI (tested with **0.36.0**) already installed and working.
* Python 3.10+ for this tool (`Pillow`, `requests`, `numpy`, `websocket-client`).
* `ffmpeg` / `ffprobe` on `PATH` (WebM/MP4 export + validation).
* GPU: tested on **RTX 3060 12 GB**. Presets are tuned for it.

```bash
python -m venv .venv && source .venv/bin/activate   # or reuse ComfyUI's venv
python -m pip install -r requirements.txt
```

Copy `config.example.json` to `config.json` only if you need to override
defaults (host/port, ComfyUI root, generated dir). `config.json` is gitignored.
Environment variables win over the file: `COMFYUI_HOST`, `COMFYUI_PORT`,
`COMFYUI_ROOT`, `RITMIKA_GENERATED_DIR`.

### External output directory

By default outputs go to a sibling of the repository:

```
../Ritmika-generated-assets/          # or $RITMIKA_GENERATED_DIR
```

Nothing heavy is ever written inside the repo.

---

## 2. ComfyUI detection

The tool probes `127.0.0.1:8188` first, then a small list of common ports.
The installation root is auto-detected from common locations (including
`~/Escritorio/Comfy`) or from `comfyui.root` in `config.json`. No changes are
made to ComfyUI by detection.

If ComfyUI is not running, start it with its own launcher/script before
generating; the pipeline will report a clear error otherwise.

---

## 3. Audit the environment

```bash
python scripts/audit_comfyui.py [--host 127.0.0.1] [--port 8188] [--hash-models]
```

Writes `reports/comfyui-environment.json` with: root, version, git commit,
server `/system_stats` (GPU/VRAM/RAM), node count, capability map
(AnimateDiff, VHS, ControlNet, IPAdapter, RIFE, background removal, …),
installed custom nodes with commits, model inventory and the models/nodes this
pipeline installed (`reports/pipeline-installs.json`).

`--hash-models` also SHA-256 hashes model files below 2 GB.

---

## 4. Inventory the assets (read-only)

```bash
python scripts/inventory_assets.py
```

Walks `public/assets/` and writes `manifests/source-assets.json`:
path, name, extension, dimensions, mode/channels, alpha presence, transparency
percentage, size, SHA-256 and an inferred category
(`axolo`, `avatar`, `background`, `podium`, `roulette`, `lobby`, `fx`,
`decoration`, `other`). Original files are **never modified**.

## 5. Build the animation plan

```bash
python scripts/build_manifest.py              # -> manifests/animation-plan.json
python scripts/build_manifest.py --outputs    # -> manifests/output-manifest.json
```

The plan assigns each candidate asset an animation type, workflow, preset,
priority, loop/alpha requirements and duration target. It is the queue used by
`batch_generate.py`.

---

## 6. Generate one asset

```bash
python scripts/run_workflow.py \
  --asset public/assets/tio_axolo_vignette_neutral.webp \
  --animation idle \
  --preset axolo
```

Options: `--seed`, `--frames`, `--steps`, `--cfg`, `--denoise`,
`--output-fps`, `--interp-multiplier`, `--loop-mode {none,pingpong,crossfade}`,
`--force` (regenerate), `--dry-run`, `--drop-frames`.

What it does automatically:

1. Preprocess the source (resize, composite over a neutral background, extract
   the original alpha mask).
2. Upload the input image to ComfyUI.
3. Render the API workflow with your parameters and queue it.
4. Wait via WebSocket progress **with `/history` polling fallback**.
5. Interpolate with RIFE (inside ComfyUI).
6. Re-apply the **original source alpha**, build the loop, export.
7. Validate, write metadata and refresh nothing in the game.

## 7. Batch generation

```bash
python scripts/batch_generate.py --category axolo --animation idle
python scripts/batch_generate.py --asset public/assets/avatars/avatar_0_taco_rockero.webp \
  --preset avatar --animation idle
python scripts/batch_generate.py --plan manifests/animation-plan.json --limit 3
```

* **Resume**: finished jobs are skipped unless `--force`.
* `--retry-errors` retries entries marked `error` in the plan.
* Deterministic seeds derived from the job id (`--seed` shifts the base).
* Per-job errors are captured; a batch report lands in `reports/batch-*.json`.
* `--dry-run` shows exactly what would run.

---

## 8. Outputs

For each asset, in `$RITMIKA_GENERATED_DIR/<category>/<id>/`:

| File | Description |
|------|-------------|
| `input.png` / `alpha.png` | Preprocessed diffusion input and extracted alpha |
| `frames/` | Final RGBA frames (loop applied) |
| `frames_rgb/` | Flattened RGB frames (diagnostic) |
| `anim.webm` | VP9 + alpha (`alpha_mode=1`), the primary character format |
| `anim.webp` | Animated WebP with alpha |
| `preview.mp4` | H.264 opaque preview for compatibility/diagnosis |
| `preview.png` | First frame |
| `sheet.png` + `sheet.png.json` | Sprite sheet and its metadata |
| `metadata.json` | Full reproducibility record |
| `validation.json` | Automatic validation report |

`metadata.json` records source + source hash, workflow + workflow hash, model,
motion model, interpolation model, seed, prompts, steps/CFG/sampler/scheduler,
resolution, generated frames, fps, interpolation, loop mode, alpha source/method,
date, process duration, peak VRAM and output hashes.

---

## 9. Validate

```bash
python scripts/validate_output.py --file out/anim.webm --require-alpha --loop \
  --expected-fps 24 --expected-width 640 --expected-height 640
python scripts/validate_output.py --manifest manifests/output-manifest.json
```

Checks existence, size, dimensions, frame count, fps, duration, codec, alpha
(including WebM `alpha_mode`), decode errors, first/last frame, and heuristics
for flicker, identity drift and loop discontinuity (computed over opaque pixels
only, so transparent backgrounds do not dilute the metrics).

## 10. Sprite sheets

```bash
python scripts/make_sprite_sheet.py --frames-dir out/frames --output sheet.png
python scripts/make_sprite_sheet.py --input clip.webm --output sheet.webp --columns 8
```

Produces a companion `.json` with `frameWidth`, `frameHeight`, `columns`,
`rows`, `frameCount`, `fps`. This enables future animated-video vs sprite-sheet
comparisons.

---

## 11. Presets and workflows

```
workflows/character_idle/     workflow.api.json + workflow.meta.json
workflows/character_reaction/ ...
workflows/character_talking/  ...
workflows/background_loop/    ...
presets/axolo.json avatar.json background.json reaction.json
```

* **Workflow meta** holds defaults, loop/alpha requirements and the
  motion/identity prompts.
* **Preset** holds the model selection, resolution budget, alpha strategy,
  subject prompt and output toggles.
* Merge order: `workflow.defaults` → `preset.generation` → CLI overrides.

Change a preset to retune without touching code. Add a new animation type by
creating `workflows/<name>/workflow.api.json` (API format, placeholders
`__LIKE_THIS__`) + `workflow.meta.json` and registering it in
`scripts/build_manifest.py` (`WORKFLOW_FOR_ANIMATION`).

### Transparency

Characters are never flattened to black. The pipeline composites the source
over a neutral gray for diffusion, then re-applies the **original alpha**
(`alphaSource: original`, `alphaMethod: source-alpha-reapply`). If a generation
ever needs true segmentation, ComfyUI's core BiRefNet `RemoveBackground` node is
available; it is intentionally not required for the first pass.

### Performance (RTX 3060 12 GB)

Presets generate 14–24 frames at 8 fps and interpolate ×2 with RIFE to 16–24
fps. Measured peak VRAM during the four smoke tests was ~4.8–6.6 GB. If OOM
occurs: lower `frames`, `contextLength`, `maxDimension` or `steps` before
reducing quality.

---

## 12. Models and Git hygiene

* Checkpoints, motion modules, ControlNet/IPAdapter weights and ComfyUI itself
  are **never** committed.
* Only scripts, workflows, presets, small manifests, docs and light reports are
  tracked. Generated media stays in `RITMIKA_GENERATED_DIR`.
* Local-only ignores live in `tools/comfyui-ritmika/.gitignore`; the root
  `.gitignore` is left untouched.

## 13. Installed for this pipeline

Documented in `reports/pipeline-installs.json`:

| Component | Version/commit | Why |
|-----------|----------------|-----|
| ComfyUI-AnimateDiff-Evolved | 1.6.0 / `9257651` | Temporal diffusion |
| `mm_sd_v15_v2.ckpt` | AnimateDiff v2 (Apache-2.0, 1.82 GB) | SD1.5 motion module |
| `rife_v4.26.safetensors` | RIFE v4.26 (22 MB) | Frame interpolation |

No duplicate implementations were added; existing VideoHelperSuite,
ControlNet Aux and LivePortrait nodes were left as-is.
