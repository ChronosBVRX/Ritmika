import os
from PIL import Image, ImageDraw

def remove_green(path):
    print(f"Fixing {path}...")
    img = Image.open(path).convert('RGBA')
    width, height = img.size
    
    # Define green threshold
    def is_green(pixel):
        r, g, b, a = pixel
        return g > 150 and r < 100 and b < 100

    pixels = img.load()
    
    # Create a mask using floodfill from corners
    mask = Image.new('L', img.size, 0)
    ImageDraw.floodfill(mask, (0, 0), 255, thresh=50)
    ImageDraw.floodfill(mask, (width-1, 0), 255, thresh=50)
    ImageDraw.floodfill(mask, (0, height-1), 255, thresh=50)
    ImageDraw.floodfill(mask, (width-1, height-1), 255, thresh=50)
    
    mask_pixels = mask.load()
    
    for y in range(height):
        for x in range(width):
            # If mask is 255 or pixel is very green, make transparent
            if mask_pixels[x, y] == 255 or is_green(pixels[x, y]):
                pixels[x, y] = (0, 0, 0, 0)

    img.save(path, 'WEBP')
    print(f"Saved {path}")

folder = "public/assets/modes/emo"
for f in os.listdir(folder):
    if "tio_axolo_vignette" in f and f.endswith(".webp"):
        remove_green(os.path.join(folder, f))
