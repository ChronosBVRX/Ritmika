#!/usr/bin/env python3
"""Genera los ornamentos vectoriales del menú Palenque Arcade.

Por ahora produce el papel picado superior. Es vectorial para que se vea
nítido en 1080p y no pese como una imagen generada.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "menu" / "papel_picado.svg"

COLORS = [
    "#ffe600", "#00e5ff", "#f0047f", "#ec4899",
    "#a855f7", "#f97316", "#22c55e", "#38bdf8",
]

W, H = 1920, 240
FLAG_W, FLAG_H, GAP = 190, 160, 45
START_X = 40


def flag_body(x: int) -> str:
    return (
        f"M {x} 32 H {x + FLAG_W} V {32 + FLAG_H - 20} "
        f"L {x + FLAG_W // 2} {32 + FLAG_H + 26} L {x} {32 + FLAG_H - 20} Z"
    )


def cutouts(x: int, variant: int) -> str:
    cx = x + FLAG_W // 2
    top = 32
    if variant % 3 == 0:
        return (
            f'<circle cx="{cx}" cy="{top + 52}" r="24"/>'
            f'<circle cx="{x + 46}" cy="{top + 108}" r="14"/>'
            f'<circle cx="{x + FLAG_W - 46}" cy="{top + 108}" r="14"/>'
            f'<path d="M {cx} {top + 92} l 16 22 l -16 22 l -16 -22 Z"/>'
        )
    if variant % 3 == 1:
        return (
            f'<path d="M {cx} {top + 26} l 26 34 l -26 34 l -26 -34 Z"/>'
            f'<circle cx="{x + 44}" cy="{top + 112}" r="15"/>'
            f'<circle cx="{x + FLAG_W - 44}" cy="{top + 112}" r="15"/>'
            f'<circle cx="{cx}" cy="{top + 126}" r="10"/>'
        )
    return (
        f'<circle cx="{cx}" cy="{top + 48}" r="19"/>'
        f'<path d="M {x + 48} {top + 100} l 18 18 l -18 18 l -18 -18 Z"/>'
        f'<path d="M {x + FLAG_W - 48} {top + 100} l 18 18 l -18 18 l -18 -18 Z"/>'
        f'<circle cx="{cx}" cy="{top + 122}" r="9"/>'
    )


def build() -> str:
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Papel picado">',
        '<defs>',
    ]
    for i, color in enumerate(COLORS):
        x = START_X + i * (FLAG_W + GAP)
        parts.append(
            f'<mask id="m{i}" maskUnits="userSpaceOnUse">'
            f'<path d="{flag_body(x)}" fill="white"/>'
            f'<g fill="black">{cutouts(x, i)}</g>'
            f'</mask>'
        )
    parts.append('</defs>')
    # Cuerda con caída suave
    parts.append('<path d="M 0 26 Q 480 52 960 26 T 1920 26" fill="none" stroke="#111827" stroke-width="10"/>')
    parts.append('<path d="M 0 26 Q 480 52 960 26 T 1920 26" fill="none" stroke="#f8fafc" stroke-width="3" stroke-dasharray="10 9"/>')
    for i, color in enumerate(COLORS):
        x = START_X + i * (FLAG_W + GAP)
        parts.append(f'<path d="{flag_body(x)}" transform="translate(8 9)" fill="#111827"/>')
        parts.append(
            f'<path d="{flag_body(x)}" fill="{color}" stroke="#111827" '
            f'stroke-width="7" stroke-linejoin="round" mask="url(#m{i})"/>'
        )
    parts.append('</svg>')
    return "\n".join(parts)


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build(), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
