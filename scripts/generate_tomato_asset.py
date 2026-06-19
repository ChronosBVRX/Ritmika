"""
Genera assets premium de tomate con fondo verde + floodfill a transparencia.
Pipeline: IA simulada con Pillow -> floodfill RGBA -> PNG.
Sigue la convención de AGENTS.md para generacion de assets.
"""
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W = 400
H = 400
GREEN = (0, 255, 0)

def create_base_green():
    img = Image.new('RGBA', (W, H), GREEN)
    return img, ImageDraw.Draw(img)

def draw_tomato_projectile():
    img, draw = create_base_green()

    # Shadow ellipse
    draw.ellipse([140, 340, 270, 370], fill=(0, 0, 0, 60))

    # Main body - multiple overlapping ellipses for organic shape
    body_color = (180, 20, 20, 255)
    draw.ellipse([80, 60, 320, 330], fill=body_color)

    # Highlight
    draw.ellipse([110, 80, 200, 180], fill=(220, 60, 60, 180))
    draw.ellipse([120, 95, 180, 160], fill=(240, 100, 100, 120))

    # Secondary highlight (bottom reflection)
    draw.ellipse([160, 270, 260, 310], fill=(140, 15, 15, 80))

    # Stem
    draw.polygon([(195, 58), (200, 20), (210, 22), (215, 60)], fill=(30, 120, 40, 255))

    # Leaves (calyx)
    draw.polygon([(195, 58), (160, 40), (165, 55), (195, 62)], fill=(50, 180, 50, 220))
    draw.polygon([(215, 58), (250, 38), (248, 55), (215, 62)], fill=(50, 180, 50, 220))
    draw.polygon([(195, 58), (175, 35), (185, 50), (200, 60)], fill=(40, 150, 40, 200))
    draw.polygon([(215, 58), (240, 32), (235, 48), (210, 60)], fill=(40, 150, 40, 200))

    # Subtle blur for realism
    img = img.filter(ImageFilter.GaussianBlur(radius=1.5))

    return img

def draw_tomato_splat():
    img, draw = create_base_green()

    colors = [
        (200, 25, 25), (180, 20, 20), (220, 40, 40),
        (160, 15, 15), (210, 30, 30), (190, 25, 25)
    ]

    # Central splat mass
    cx, cy = 200, 180
    for r in range(6):
        offset_x = int(20 * math.sin(r * 1.2))
        offset_y = int(15 * math.cos(r * 0.9))
        draw.ellipse([
            cx - 80 + offset_x, cy - 60 + offset_y,
            cx + 80 + offset_x, cy + 60 + offset_y
        ], fill=colors[r % len(colors)] + (255,))

    # Outer splatter drops
    rng = random.Random(42)
    for _ in range(30):
        angle = rng.uniform(0, 2 * math.pi)
        dist = rng.uniform(60, 160)
        size = rng.uniform(6, 22)
        x = cx + int(dist * math.cos(angle))
        y = cy + int(dist * math.sin(angle))
        if x < 10 or x > W - 10 or y < 10 or y > H - 10:
            continue
        col = colors[rng.randint(0, len(colors) - 1)] + (255,)
        draw.ellipse([x - size / 2, y - size / 2, x + size / 2, y + size / 2], fill=col)

        # Tiny secondary drops
        if size > 12:
            for _ in range(3):
                sa = rng.uniform(0, 2 * math.pi)
                sd = rng.uniform(5, 15)
                sx = x + int(sd * math.cos(sa))
                sy = y + int(sd * math.sin(sa))
                if 10 <= sx <= W - 10 and 10 <= sy <= H - 10:
                    draw.ellipse([sx - 3, sy - 3, sx + 3, sy + 3], fill=col)

    # Drip trails
    for _ in range(8):
        dx = cx + rng.randint(-50, 50)
        dy = cy + 50 + rng.randint(0, 30)
        length = rng.randint(30, 80)
        for i in range(length):
            yp = dy + i
            if yp >= H:
                break
            alpha = max(0, int(200 * (1 - i / length)))
            w = max(1, int(5 * (1 - i / length)))
            draw.ellipse([dx - w / 2, yp - w / 2, dx + w / 2, yp + w / 2], fill=(180, 20, 20, alpha))

    # Blur for organic feel
    img = img.filter(ImageFilter.GaussianBlur(radius=2))

    return img

def floodfill_to_transparent(img):
    """Floodfill green background from all 4 corners to transparent."""
    img = img.convert('RGBA')
    w, h = img.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    for corner in corners:
        try:
            ImageDraw.floodfill(img, corner, (0, 0, 0, 0), thresh=50)
        except Exception:
            pass
    # Also remove any remaining green pixels
    pix = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if g > 180 and r < 100 and b < 100:
                pix[x, y] = (0, 0, 0, 0)
    return img

def main():
    print("Generando tomato_projectile.png...")
    proj = draw_tomato_projectile()
    proj = floodfill_to_transparent(proj)
    proj.save('public/assets/tomato_projectile.png', 'PNG')
    print("OK - tomato_projectile.png")

    print("Generando tomato_splat.png...")
    splat = draw_tomato_splat()
    splat = floodfill_to_transparent(splat)
    splat.save('public/assets/tomato_splat.png', 'PNG')
    print("OK - tomato_splat.png")

    print("¡Assets generados exitosamente!")

if __name__ == '__main__':
    main()
