#!/usr/bin/env python3
"""Genera diálogos con la voz clonada de Axolo (Chatterbox local, MIT).

Configuración elegida para el estilo "ñero CDMX": referencia de ~15 s armada
con los barks más callejeros del propio narrador y exageración 1.4. El
post-proceso baja un semitono y comprime para dar esa cadencia de barrio.

Uso:
  ~/.venvs/ritmika-tts/bin/python scripts/generate_voice_chatterbox.py \
      --name vote_prompt_5 --text "¡Vamos a votar!"
"""
import argparse, os, subprocess, tempfile
import perth

class _NoMark:
    def apply_watermark(self, wav, sample_rate=None, **kw):
        return wav

perth.PerthImplicitWatermarker = _NoMark

import torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "public", "assets", "audio")
REF_PARTS = ["genre_reggaeton_0", "genre_reggaeton_1", "genre_reggaeton_3",
             "genre_reggaeton_6", "vote_30_1"]

def build_reference(dst):
    inputs = []
    for p in REF_PARTS:
        f = os.path.join(AUDIO, p + ".mp3")
        if os.path.exists(f):
            inputs += ["-i", f]
    n = len(inputs) // 2
    filt = "".join(f"[{i}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1,atempo=0.98"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", filt,
                    "-ac", "1", "-ar", "24000", dst], check=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--lang", default="es")
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--exaggeration", type=float, default=1.4)
    ap.add_argument("--cfg", type=float, default=0.25)
    ap.add_argument("--temperature", type=float, default=0.7)
    a = ap.parse_args()

    fd, ref = tempfile.mkstemp(suffix=".wav"); os.close(fd)
    build_reference(ref)

    model = ChatterboxMultilingualTTS.from_pretrained(device=a.device)
    wav = model.generate(a.text, language_id=a.lang, audio_prompt_path=ref,
                         exaggeration=a.exaggeration, cfg_weight=a.cfg,
                         temperature=a.temperature)
    out_wav = ref + ".out.wav"
    ta.save(out_wav, wav.cpu(), model.sr)
    dst = os.path.join(AUDIO, a.name + ".mp3")
    post = ("asetrate=%d*0.944,aresample=%d,atempo=1.0593,"
            "acompressor=threshold=-18dB:ratio=2.5:attack=5:release=120,"
            "alimiter=limit=0.97") % (model.sr, model.sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out_wav, "-af", post,
                    "-codec:a", "libmp3lame", "-b:a", "192k", dst], check=True)
    os.unlink(ref); os.unlink(out_wav)
    print(f"{dst}  {os.path.getsize(dst)//1024} KB")

if __name__ == "__main__":
    main()
