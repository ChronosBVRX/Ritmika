#!/usr/bin/env python3
"""Refina con CTC los tiempos de palabra de las pistas que cayeron al LRC.

Cuando la transcripcion no da para emparejar (punk rapido, coros encimados),
el render reparte las palabras de cada linea por silabas. Eso deja el texto en
el lugar correcto pero el barrido aproximado. Este paso corre un alineador
fonetico (MMS_FA) sobre la ventana de cada linea y devuelve el tiempo real de
cada palabra.
"""

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

TOOL_DIR = Path(__file__).resolve().parent
ROOT = TOOL_DIR.parents[1]
BUILD = ROOT / "media" / "karaoke-build"
ALIGNED = BUILD / "aligned"
STEMS = BUILD / "stems" / "htdemucs"


def roman(text):
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z']", "", text) or "a"


def load_audio(path, sr=16000):
    import torch

    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
        capture_output=True,
    ).stdout
    return torch.frombuffer(bytearray(raw), dtype=torch.float32).clone()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    import torch
    from torchaudio.pipelines import MMS_FA as bundle
    from uroman import Uroman

    device = "cuda"
    model = bundle.get_model().to(device).eval()
    aligner = bundle.get_aligner()
    tokenizer = bundle.get_tokenizer()
    rome = Uroman()

    wanted = set(args.only.split(",")) if args.only else None
    files = sorted(ALIGNED.glob("*.json"))
    done = 0

    for path in files:
        tid = path.stem
        if wanted and tid not in wanted:
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        lines = data.get("lines") or []
        if not lines:
            continue
        if not args.force and any(line.get("score", 0) > 0 for line in lines):
            continue

        stem = next(STEMS.glob(f"{tid}__*/vocals.wav"), None)
        if not stem:
            print(f"  {tid:14s} sin stem")
            continue

        audio = load_audio(stem)
        changed = 0

        for line in lines:
            words = line["words"]
            tokens = [roman(word["w"]) for word in words]
            begin = max(0.0, line["start"] - 0.2)
            ending = min(len(audio) / 16000, line["end"] + 0.2)
            if ending - begin < 0.3:
                continue
            chunk = audio[int(begin * 16000):int(ending * 16000)]
            if len(chunk) < 16000 * 0.3:
                continue

            with torch.inference_mode():
                emission, _ = model(chunk.unsqueeze(0).to(device))
            spans = aligner(emission[0].float().cpu(), tokenizer(tokens))
            if not spans or any(not span for span in spans):
                continue

            ratio = len(chunk) / emission.shape[0]
            for word, span in zip(words, spans):
                start = begin + span[0].start * ratio / 16000
                end = begin + span[-1].end * ratio / 16000
                if end > start:
                    word["s"] = round(start, 3)
                    word["e"] = round(end, 3)
                    changed += 1

        if changed:
            for line in lines:
                line["start"] = round(line["words"][0]["s"], 3)
                line["end"] = round(line["words"][-1]["e"], 3)
            data["refined"] = "ctc"
            path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"  {tid:14s} {changed:4d} palabras refinadas")
            done += 1
        else:
            print(f"  {tid:14s} sin cambios")

    print(f"\n{done} pistas refinadas")


if __name__ == "__main__":
    main()
