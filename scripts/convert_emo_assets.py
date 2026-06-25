import os
import glob
from PIL import Image, ImageDraw

def process_image(img_path, out_path):
    print(f"Processing {img_path} -> {out_path}")
    img = Image.open(img_path).convert('RGBA')
    
    # Use floodfill to make background transparent
    ImageDraw.floodfill(img, (0,0), (0,0,0,0), thresh=20)
    ImageDraw.floodfill(img, (img.width-1, 0), (0,0,0,0), thresh=20)
    ImageDraw.floodfill(img, (0, img.height-1), (0,0,0,0), thresh=20)
    ImageDraw.floodfill(img, (img.width-1, img.height-1), (0,0,0,0), thresh=20)
    
    img.save(out_path, 'WEBP', quality=90)
    print(f"  Saved to {out_path}")

artifact_dir = r"C:\Users\Axel Rosete\.gemini\antigravity\brain\8837c9ca-4605-4083-a657-a3c518a2db33"
out_dir = r"C:\Users\Axel Rosete\Desktop\Ritmika\public\assets\modes\emo"

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

# Find all relevant pngs
pngs = glob.glob(os.path.join(artifact_dir, "*.png"))

for path in pngs:
    filename = os.path.basename(path)
    import re
    clean_name = re.sub(r'_\d+\.png$', '.webp', filename)
    if clean_name.endswith('.png'): 
        clean_name = clean_name.replace('.png', '.webp')
        
    out_path = os.path.join(out_dir, clean_name)
    process_image(path, out_path)
