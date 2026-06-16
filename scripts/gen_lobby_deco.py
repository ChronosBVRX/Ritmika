"""Generate neon decorative overlay for premium lobby background."""
import os, math
from PIL import Image, ImageDraw, ImageFilter

w, h = 1920, 1080
img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

colors = [
    (236, 72, 153, 20),    # neon-pink
    (0, 229, 255, 18),     # neon-cyan
    (168, 85, 247, 15),    # neon-purple
    (250, 204, 21, 12),    # neon-yellow
    (240, 4, 127, 15),     # magenta
]

# Diagonal neon lines
for i in range(14):
    y = i * 85 - 50
    color = colors[i % len(colors)]
    draw.line([(0, y), (w, y + 100)], fill=color, width=2)

    # Glow layers
    glow_color = (color[0], color[1], color[2], 8)
    draw.line([(0, y), (w, y + 100)], fill=glow_color, width=6)
    draw.line([(0, y), (w, y + 100)], fill=(color[0], color[1], color[2], 4), width=12)

# Cross-diagonal lines opposite direction
for i in range(12):
    y = i * 100 - 30
    color = colors[(i + 2) % len(colors)]
    draw.line([(w, y), (0, y + 80)], fill=(color[0], color[1], color[2], 12), width=1)
    glow_color = (color[0], color[1], color[2], 5)
    draw.line([(w, y), (0, y + 80)], fill=glow_color, width=4)

# Floating light orbs (subtle radial gradients)
orb_positions = [
    (150, 200, 300), (1700, 150, 200), (900, 800, 250),
    (300, 700, 180), (1600, 600, 220), (500, 400, 150),
]
for ox, oy, radius in orb_positions:
    for r in range(radius, 0, -20):
        t = r / radius
        alpha = int(6 * t)
        for idx, color in enumerate(colors):
            c = (color[0], color[1], color[2], max(0, alpha - idx*2))
            draw.ellipse([ox - r, oy - r, ox + r, oy + r], fill=c)

# Clean up: gentle gaussian blur to make everything glow
img = img.filter(ImageFilter.GaussianBlur(radius=4))

# Edge vignette: darken edges to keep focus on center
vignette = Image.new('RGBA', (w, h), (0, 0, 0, 0))
vd = ImageDraw.Draw(vignette)
for r in range(500, 0, -10):
    t = (500 - r) / 500
    alpha = int(t * 60)
    vd.ellipse([w//2 - r, h//2 - r, w//2 + r, h//2 + r], fill=(0, 0, 0, alpha))
img = Image.alpha_composite(img, vignette)

out_path = 'public/assets/lobby_deco_glow.png'
img.save(out_path, 'PNG', optimize=True)
print(f"Generated: {out_path} ({os.path.getsize(out_path)/1024:.1f}KB)")

# Also generate a smaller version
img_small = img.resize((480, 270), Image.LANCZOS)
out_small = 'public/assets/lobby_deco_glow_thumb.png'
img_small.save(out_small, 'PNG', optimize=True)
print(f"Thumbnail: {out_small} ({os.path.getsize(out_small)/1024:.1f}KB)")

import os
