#!/usr/bin/env python3
"""Genera diálogos con la voz clonada de Axolo usando Chatterbox (local, MIT).

Clona desde un clip de referencia del propio narrador (por defecto 9 s de
podium_intro_ceremony.mp3) y escribe MP3 en public/assets/audio.

Uso:
  ~/.venvs/ritmika-tts/bin/python scripts/generate_voice_chatterbox.py \
      --name vote_prompt_5 --text "¡Vamos a votar!" [--ref clip.mp3]
"""
import argparse, os, subprocess, tempfile
import perth

class _NoMark:
    def apply_watermark(self, wav, sample_rate=None, **kw):
        return wav

# El paquete perth opcional no expone la clase; Chatterbox la necesita.
perth.PerthImplicitWatermarker = _NoMark

import torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "public", "assets", "audio")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--ref", default=os.path.join(AUDIO, "podium_intro_ceremony.mp3"))
    ap.add_argument("--lang", default="es")
    ap.add_argument("--device", default="cuda")
    a = ap.parse_args()

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        ref = tmp.name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1", "-t", "9",
                    "-i", a.ref, "-ac", "1", "-ar", "24000", ref], check=True)

    model = ChatterboxMultilingualTTS.from_pretrained(device=a.device)
    wav = model.generate(a.text, language_id=a.lang, audio_prompt_path=ref)
    out_wav = ref + ".out.wav"
    ta.save(out_wav, wav.cpu(), model.sr)
    dst = os.path.join(AUDIO, a.name + ".mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out_wav,
                    "-codec:a", "libmp3lame", "-b:a", "192k", dst], check=True)
    os.unlink(ref); os.unlink(out_wav)
    print(f"{dst}  {os.path.getsize(dst)//1024} KB")

if __name__ == "__main__":
    main()
