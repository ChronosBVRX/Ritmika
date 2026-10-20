#!/usr/bin/env python3
"""Alinea una letra en texto plano contra el audio con CTC (MMS_FA).

Para las canciones que no tienen LRC: se escribe la letra correcta, línea por
línea, en `plain/<id>.txt`, y este paso calcula cuándo entra cada palabra.
La letra no se toca: es la fuente de verdad.
"""

import argparse
import json
import re
import subprocess
import unicodedata
from pathlib import Path

TOOL_DIR = Path(__file__).resolve().parent
ROOT = TOOL_DIR.parents[1]
BUILD = ROOT / "media" / "karaoke-build"


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


def emissions(model, wave, chunk=20.0, overlap=0.5, sr=16000):
    import torch

    step = int(chunk * sr)
    overlap_samples = int(overlap * sr)
    parts = []
    position = 0
    while position < len(wave):
        segment = wave[position:position + step + overlap_samples]
        with torch.inference_mode():
            out, _ = model(segment.unsqueeze(0).to("cuda"))
        out = out[0].float().cpu()
        if position > 0:
            out = out[int(round(overlap_samples / 320)):]
        parts.append(out)
        position += step
        torch.cuda.empty_cache()
    return torch.cat(parts, 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--build", default=str(BUILD))
    parser.add_argument("--only", default=None)
    args = parser.parse_args()

    import torch
    from torchaudio.pipelines import MMS_FA as bundle
    from uroman import Uroman

    build = Path(args.build).expanduser().resolve()
    plain_dir = build / "plain"
    aligned_dir = build / "aligned"
    stems = build / "stems" / "htdemucs"
    aligned_dir.mkdir(parents=True, exist_ok=True)

    model = bundle.get_model().to("cuda").eval()
    aligner = bundle.get_aligner()
    tokenizer = bundle.get_tokenizer()
    rome = Uroman()

    wanted = set(args.only.split(",")) if args.only else None
    done = 0

    for path in sorted(plain_dir.glob("*.txt")):
        tid = path.stem
        if wanted and tid not in wanted:
            continue
        lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        if not lines:
            continue

        stem = next(stems.glob(f"{tid}__*/vocals.wav"), None)
        if not stem:
            print(f"  {tid:14s} sin stem")
            continue

        wave = load_audio(stem)
        emission = emissions(model, wave)
        ratio = len(wave) / emission.shape[0]

        words = []
        owners = []
        for index, line in enumerate(lines):
            for word in line.split():
                cleaned = roman(word)
                if cleaned:
                    words.append(cleaned)
                    owners.append(index)

        spans = aligner(emission, tokenizer(words))
        times = []
        for span in spans:
            if not span:
                times.append(None)
                continue
            times.append((span[0].start * ratio / 16000, span[-1].end * ratio / 16000))

        records = []
        cursor = 0
        for index, line in enumerate(lines):
            tokens = line.split()
            count = sum(1 for owner in owners if owner == index)
            line_times = times[cursor:cursor + count]
            cursor += count
            known = [t for t in line_times if t]
            if not known:
                continue
            records.append({
                "start": round(known[0][0], 3),
                "end": round(known[-1][1], 3),
                "words": [
                    {"w": token, "s": round(t[0], 3), "e": round(t[1], 3)}
                    for token, t in zip(tokens, line_times) if t
                ],
                "score": 1,
            })

        if not records:
            print(f"  {tid:14s} no se pudo alinear")
            continue

        for i in range(1, len(records)):
            if records[i]["start"] <= records[i - 1]["start"]:
                records[i]["start"] = records[i - 1]["start"] + 0.35

        aligned_dir.joinpath(f"{tid}.json").write_text(
            json.dumps({"lines": records, "source": "plain"}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        done += 1
        print(f"  {tid:14s} {len(records):3d} líneas alineadas")

    print(f"\n{done} pistas")


if __name__ == "__main__":
    main()
