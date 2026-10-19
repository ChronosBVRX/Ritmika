#!/usr/bin/env python3
"""Sintetiza stings, loops y ambientes para Rítmika (sin modelos de audio).

Todo se genera por código (numpy) y se exporta a MP3 con ffmpeg, para que el
juego tenga una capa sonora propia: entradas de ronda, tensión de ruleta,
apagón, fanfarria de ganador y ambiente de público para el karaoke.

Uso:
    python scripts/synthesize_audio.py --out public/assets/audio
    python scripts/synthesize_audio.py --only sting_round_start
"""

import argparse
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100


# ── utilidades ───────────────────────────────────────────────
def t(sec):
    return np.arange(int(SR * sec)) / SR


def sine(freq, sec, phase=0.0):
    return np.sin(2 * np.pi * freq * t(sec) + phase)


def saw(freq, sec):
    x = (t(sec) * freq) % 1.0
    return 2 * x - 1


def square(freq, sec, duty=0.5):
    return np.where((t(sec) * freq) % 1.0 < duty, 1.0, -1.0)


def noise(sec, seed=0):
    return np.random.default_rng(seed).normal(0, 1, int(SR * sec))


def env(sec, a=0.01, d=0.1, s=0.0, r=0.2, sustain=0.7):
    n = int(SR * sec)
    e = np.zeros(n)
    ai = min(int(SR * a), n)
    ri = min(int(SR * r), n)
    di = min(int(SR * d), max(0, n - ai - ri))
    if ai:
        e[:ai] = np.linspace(0, 1, ai)
    if di:
        e[ai:ai + di] = np.linspace(1, sustain, di)
    si = n - ri
    if si > ai + di:
        e[ai + di:si] = sustain
    if ri:
        e[si:] = np.linspace(sustain, 0, n - si)
    return e


def expdecay(sec, tau):
    return np.exp(-t(sec) / tau)


def lowpass(x, cutoff, taps=101):
    if cutoff >= SR / 2:
        return x
    n = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * cutoff / SR * n) * np.hamming(taps)
    h /= h.sum()
    return np.convolve(x, h, mode="same")


def highpass(x, cutoff, taps=101):
    return x - lowpass(x, cutoff, taps)


def ir_reverb(sec=2.2, decay=3.0, seed=1):
    rng = np.random.default_rng(seed)
    n = int(SR * sec)
    ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / (SR * sec / decay))
    ir = lowpass(ir, 7000)
    ir[:int(SR * 0.02)] *= np.linspace(0, 1, int(SR * 0.02))
    ir /= np.sqrt((ir ** 2).sum())
    return ir


def reverb(x, wet=0.25, ir=None):
    ir = ir if ir is not None else ir_reverb()
    w = np.convolve(x, ir, mode="full")[:len(x)]
    return (1 - wet) * x + wet * w * 3.0


def stereo(x, width=0.0):
    if x.ndim == 1:
        return np.stack([x, x])
    return x


def pad_to(x, n):
    if len(x) >= n:
        return x[:n]
    return np.pad(x, (0, n - len(x)))


def place(buf, x, at):
    i = int(SR * at)
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i:i + n] += x[:n]
    return buf


def normalize_rms(x, target_db=-17.0):
    """Normaliza por RMS al nivel de los SFX del juego (evita que un sting tape
    la narracion)."""
    rms = np.sqrt((x ** 2).mean())
    if rms <= 0:
        return x
    x = x / rms * (10 ** (target_db / 20.0))
    peak = np.abs(x).max()
    if peak > 0.98:
        x = x * (0.98 / peak)
    return x


def normalize(x, peak=0.97):
    m = np.abs(x).max() if x.size else 1.0
    return x * (peak / m) if m > 0 else x


def limit(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


# ── piezas ───────────────────────────────────────────────────
def kick(sec=0.5, f0=110, f1=45, tau=0.16):
    tt = t(sec)
    f = f1 + (f0 - f1) * np.exp(-tt / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / tau)
    click = highpass(noise(sec, 3), 1500) * np.exp(-tt / 0.004) * 0.5
    return body + click


def clap(sec=0.35, seed=5):
    tt = t(sec)
    n = highpass(noise(sec, seed), 1200) * (np.exp(-tt / 0.05) + 0.6 * np.exp(-tt / 0.012))
    return n * 0.8


def hat(sec=0.09, open_=False, seed=7):
    tt = t(sec)
    n = highpass(noise(sec, seed), 7000)
    return n * np.exp(-tt / (0.07 if open_ else 0.018)) * 0.35


def bass(freq, sec, seed=0):
    e = env(sec, a=0.005, d=0.05, s=0.85, r=0.06, sustain=1.0)
    x = 0.6 * saw(freq, sec) + 0.4 * sine(freq, sec)
    return lowpass(x * e, 900) * 0.55


def supersaw(freqs, sec, detune=0.008, bright=2600):
    out = np.zeros(int(SR * sec))
    for f in freqs:
        for d in (-detune, 0.0, detune):
            out += saw(f * (1 + d), sec) * 0.12
    e = env(sec, a=0.03, d=0.15, s=0.7, r=0.25, sustain=0.75)
    return lowpass(out * e, bright)


def bell(freq, sec, tau=0.5):
    tt = t(sec)
    car = np.sin(2 * np.pi * freq * tt + 3.2 * np.exp(-tt / 0.09) * np.sin(2 * np.pi * freq * 2.01 * tt))
    return car * np.exp(-tt / tau) * 0.5


def riser(sec=2.0, seed=11):
    tt = t(sec)
    n = noise(sec, seed)
    # barrido de filtro en tres tramos (FIR por tramos para no ir lento)
    out = np.zeros_like(n)
    seg = 6
    for i in range(seg):
        a, b = int(len(n) * i / seg), int(len(n) * (i + 1) / seg)
        cut = 300 * (2 ** (i * 0.9))
        out[a:b] = lowpass(n[a:b], cut, 61)
    tone = saw(220, sec) * (tt / sec) ** 2
    return (out * (tt / sec) ** 1.6 * 0.8 + tone * 0.25)


def impact(sec=1.6):
    tt = t(sec)
    boom = np.sin(2 * np.pi * np.cumsum(45 + 60 * np.exp(-tt / 0.05)) / SR) * np.exp(-tt / 0.35)
    hit = lowpass(noise(sec, 13), 2500) * np.exp(-tt / 0.09) * 0.5
    return boom + hit


def crowd_loop(sec=14.0, seed=21):
    rng = np.random.default_rng(seed)
    n = int(SR * sec)
    base = lowpass(noise(sec, seed), 900) * 0.25
    mod = 0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * t(sec) + rng.random() * 6)
    base *= mod
    # aplausos sueltos
    for _ in range(46):
        at = rng.random() * (sec - 0.5)
        c = clap(0.3, int(rng.integers(0, 999)))
        place(base, c * (0.10 + rng.random() * 0.16), at)
    # silbidos
    for _ in range(5):
        at = rng.random() * (sec - 0.6)
        f = 900 + rng.random() * 700
        w = np.sin(2 * np.pi * f * t(0.3)) * np.exp(-t(0.3) / 0.12) * 0.05
        place(base, w, at)
    # crossfade de 1s para que el loop sea continuo
    xf = int(SR * 1.0)
    head, tail = base[:xf].copy(), base[-xf:].copy()
    base[:xf] = head * np.linspace(0, 1, xf) + tail * np.linspace(1, 0, xf)
    base = base[:-xf]
    return base * 1.6


def applause_tail(sec=3.0, seed=31):
    x = crowd_loop(sec + 1.4, seed)[:int(SR * sec)] * 0.9
    e = np.concatenate([np.ones(int(SR * 0.6)), np.linspace(1, 0, len(x) - int(SR * 0.6))])
    return x * e


# ── piezas compuestas ────────────────────────────────────────
def sting_round_start():
    dur = 2.6
    buf = np.zeros(int(SR * dur))
    place(buf, riser(1.7), 0.0)
    place(buf, impact(1.4) * 0.9, 1.55)
    root = 110.0
    for i, semi in enumerate([0, 7, 12]):
        place(buf, bell(root * 2 ** (semi / 12) * 2, 1.3, 0.5) * 0.5, 1.6 + i * 0.02)
    place(buf, supersaw([root * 2 ** (7 / 12), root * 2 ** (10 / 12), root * 2], 1.0) * 0.5, 1.6)
    return limit(reverb(buf, 0.22), 1.05)


def sting_roulette_spin():
    dur = 4.0
    buf = np.zeros(int(SR * dur))
    root = 87.31
    step = 0.125
    seq = [0, 3, 7, 10, 12, 10, 7, 3]
    for i in range(int(dur / step) - 4):
        f = root * 2 ** (seq[i % len(seq)] / 12)
        place(buf, bass(f, step * 0.9) * 0.5, i * step)
    for i in range(int(dur / step) - 4):
        place(buf, hat(0.07, i % 4 == 3, seed=40 + i), i * step + 0.05)
    for i in range(0, 8):
        place(buf, clap(0.3, 60 + i), i * 0.5)
    place(buf, riser(1.4) * 0.7, 2.4)
    return limit(reverb(buf, 0.18), 1.0)


def sting_blackout():
    dur = 3.4
    buf = np.zeros(int(SR * dur))
    drone = np.zeros(int(SR * dur))
    for f in (55.0, 82.41, 110.0):
        drone += sine(f, dur) * 0.3 + saw(f, dur) * 0.08
    e = np.concatenate([np.linspace(0, 1, int(SR * 0.8)), np.ones(int(SR * 1.6)), np.linspace(1, 0.15, int(SR * 1.0))])
    drone *= e[:len(drone)]
    buf += lowpass(drone, 700) * 0.8
    place(buf, impact(1.6) * 0.8, 0.0)
    place(buf, bell(440 * 2 ** (-5 / 12), 2.0, 0.9) * 0.35, 0.05)
    return limit(reverb(buf, 0.3), 1.0)


def sting_podium():
    dur = 4.2
    buf = np.zeros(int(SR * dur))
    root = 98.0
    chords = [(0, 4, 7), (0, 4, 7), (5, 9, 12), (7, 11, 14)]
    at = 0.0
    for ch in chords:
        freqs = [root * 2 ** (s / 12) for s in ch]
        place(buf, supersaw(freqs, 1.0, bright=2200) * 0.9, at)
        place(buf, impact(1.2) * 0.5, at)
        at += 0.95
    place(buf, riser(1.9) * 0.8, 0.0)
    for i, f in enumerate([root * 4, root * 6, root * 8]):
        place(buf, bell(f, 1.6, 0.7) * 0.4, 2.6 + i * 0.09)
    place(buf, applause_tail(2.6) * 0.5, 1.6)
    return limit(reverb(buf, 0.24), 1.02)


def sting_winner():
    dur = 5.0
    buf = np.zeros(int(SR * dur))
    root = 130.81
    for i, s in enumerate([0, 7, 12, 16, 19, 24]):
        place(buf, bell(root * 2 ** (s / 12), 2.2, 0.8) * 0.55, i * 0.11)
    place(buf, impact(2.0) * 1.0, 0.0)
    for ch, at in (((0, 4, 7), 0.05), ((5, 9, 12), 1.1), ((7, 11, 14), 2.2), ((0, 4, 7, 12), 3.3)):
        place(buf, supersaw([root / 2 * 2 ** (s / 12) for s in ch], 1.5, bright=2800) * 0.8, at)
    place(buf, applause_tail(2.4) * 0.55, 3.0)
    return limit(reverb(buf, 0.26), 1.02)


TARGETS_DB = {
    "sting_round_start": -17.0,
    "sting_roulette_spin": -18.0,
    "sting_blackout": -17.0,
    "sting_podium": -16.5,
    "sting_winner": -16.0,
    "loop_crowd_karaoke": -26.0,
}

PIECES = {
    "sting_round_start": sting_round_start,
    "sting_roulette_spin": sting_roulette_spin,
    "sting_blackout": sting_blackout,
    "sting_podium": sting_podium,
    "sting_winner": sting_winner,
    "loop_crowd_karaoke": crowd_loop,
}


def write_wav(path: Path, x, loop=False):
    x = np.atleast_2d(x)
    if x.shape[0] == 1:
        x = np.vstack([x, x])
    data = (np.clip(x, -1, 1) * 32767).astype("<i2").T
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/assets/audio")
    ap.add_argument("--only", default=None)
    ap.add_argument("--bitrate", default="192k")
    args = ap.parse_args()

    root = Path(__file__).resolve().parent.parent
    out = root / args.out
    out.mkdir(parents=True, exist_ok=True)

    names = [args.only] if args.only else list(PIECES)
    for name in names:
        fn = PIECES.get(name)
        if not fn:
            print("desconocido:", name)
            continue
        wav = out / f"{name}.wav"
        mp3 = out / f"{name}.mp3"
        x = fn()
        x = np.atleast_2d(x)
        x = np.stack([normalize_rms(ch, TARGETS_DB.get(name, -17.0)) for ch in x])
        write_wav(wav, x)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-codec:a", "libmp3lame",
             "-b:a", args.bitrate, "-ar", "44100", str(mp3)],
            check=True,
        )
        wav.unlink(missing_ok=True)
        print(f"  {name}.mp3  {mp3.stat().st_size // 1024} KB  ({len(np.atleast_2d(x)[0]) / SR:.1f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
