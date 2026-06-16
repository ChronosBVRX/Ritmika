import sys, os
from PIL import Image

logo_path = sys.argv[1] if len(sys.argv) > 1 else 'public/assets/logo_ritmika.png'
out_dir = sys.argv[2] if len(sys.argv) > 2 else 'public/assets'

img = Image.open(logo_path)
print(f"Original: {img.size} {img.mode} ({os.path.getsize(logo_path)/1024:.1f}KB)")

# Resize logo — max 500px wide (TV displays at 72px height, this is more than enough)
w, h = img.size
new_w = 500
new_h = int(h * new_w / w)
logo_small = img.resize((new_w, new_h), Image.LANCZOS)

# Save optimized PNG (reduce palette to PNG-8 if possible, but keep RGBA for transparency)
logo_small.save(os.path.join(out_dir, 'logo_ritmika.png'), 'PNG', optimize=True)
print(f"Logo resized: {logo_small.size} ({os.path.getsize(os.path.join(out_dir, 'logo_ritmika.png'))/1024:.1f}KB)")

# Favicon 32x32
favicon_32 = img.resize((32, 32), Image.LANCZOS)
favicon_path = os.path.join(out_dir, 'favicon.png')
favicon_32.save(favicon_path, 'PNG', optimize=True)
print(f"Favicon 32x32: {os.path.getsize(favicon_path)/1024:.1f}KB")

# Also save a 64x64 version for retina
favicon_64 = img.resize((64, 64), Image.LANCZOS)
favicon_64.save(os.path.join(out_dir, 'favicon-64.png'), 'PNG', optimize=True)

# Favicon .ico (for browsers that need it)
# PIL can save ICO
favicon_32.save(os.path.join(out_dir, 'favicon.ico'), 'ICO', sizes=[(32, 32)])
favicon_path_ico = os.path.join(out_dir, 'favicon.ico')
if os.path.exists(favicon_path_ico):
    print(f"Favicon ICO: {os.path.getsize(favicon_path_ico)/1024:.1f}KB")

# Also save a 2x version for TV display (retina @ 200px display height)
logo_2x = img.resize((400, int(h * 400 / w)), Image.LANCZOS)
logo_2x_path = os.path.join(out_dir, 'logo_ritmika_hd.png')
logo_2x.save(logo_2x_path, 'PNG', optimize=True)
print(f"Logo HD: {logo_2x.size} ({os.path.getsize(logo_2x_path)/1024:.1f}KB)")
