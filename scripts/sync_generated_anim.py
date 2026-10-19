#!/usr/bin/env python3
"""Copia las animaciones aprobadas del pipeline a public/assets/anim/.

El pipeline escribe en $RITMIKA_GENERATED_DIR (fuera del repo). El juego solo
sirve lo que está en public/, así que este paso sincroniza el WebM (VP9 con
alfa) y el WebP animado, y reporta tamaños. Es re-ejecutable: solo copia lo que
está validado (validation.json ok) o lo que se pida con --force.

Uso:
    python scripts/sync_generated_anim.py [--dry-run] [--only tio-axolo]
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEN = Path.home() / "Ritmika-generated-assets"
DEST = ROOT / "public" / "assets" / "anim"


def validated(job_dir: Path) -> bool:
    v = job_dir / "validation.json"
    if not v.exists():
        return False
    try:
        return bool(json.loads(v.read_text()).get("ok"))
    except Exception:
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", default=None)
    ap.add_argument("--force", action="store_true", help="copiar aunque no este validado")
    ap.add_argument("--with-webp", action="store_true",
                    help="copiar tambien el WebP animado (pesa ~5 MB por clip: no usar en produccion)")
    args = ap.parse_args()

    if not GEN.exists():
        print("no existe", GEN)
        return 1
    DEST.mkdir(parents=True, exist_ok=True)

    total = 0
    copied = 0
    for job in sorted(GEN.rglob("*")):
        if not job.is_dir():
            continue
        webm = job / "anim.webm"
        if not webm.exists():
            continue
        job_id = job.name
        if args.only and args.only not in job_id:
            continue
        if not (validated(job) or args.force):
            print(f"  salta (sin validar) {job_id}")
            continue
        for ext in (("webm", "webp") if args.with_webp else ("webm",)):
            src = job / f"anim.{ext}"
            if not src.exists():
                continue
            dst = DEST / f"{job_id}.{ext}"
            size = src.stat().st_size
            total += size
            copied += 1
            if args.dry_run:
                print(f"  [{size // 1024:>5} KB] {dst.relative_to(ROOT)}")
            else:
                shutil.copy2(src, dst)
    if not args.dry_run:
        index = {"generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
                 "avatars": {}, "vignettes": {}, "backgrounds": {}, "misc": {}}
        for f in sorted(DEST.glob("*.webm")):
            key = f.stem
            m = re.match(r"avatar-(\d+)-", key)
            if m:
                index["avatars"][m.group(1)] = key
            elif key.startswith("tio-axolo-vignette-"):
                index["vignettes"][key.replace("tio-axolo-vignette-", "")] = key
            elif "bg" in key or "background" in key:
                index["backgrounds"][key] = key
            else:
                index["misc"][key] = key
        (DEST / "index.json").write_text(json.dumps(index, indent=1))
        print(f"index.json: {len(index['avatars'])} avatares, {len(index['vignettes'])} vinetas, "
              f"{len(index['backgrounds'])} fondos, {len(index['misc'])} otros")

    print(f"{'(dry-run) ' if args.dry_run else ''}archivos: {copied}  total: {total / 1024 / 1024:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
