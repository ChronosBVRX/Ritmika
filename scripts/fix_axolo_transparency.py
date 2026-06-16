from PIL import Image
import numpy as np
from collections import Counter

def remove_checkerboard(img_path):
    img = Image.open(img_path).convert('RGBA')
    data = np.array(img)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

    # Find neutral gray pixels (R≈G≈B)
    gray_diff1 = np.abs(r.astype(int) - g.astype(int))
    gray_diff2 = np.abs(g.astype(int) - b.astype(int))
    gray_diff3 = np.abs(r.astype(int) - b.astype(int))
    is_neutral_gray = (gray_diff1 < 15) & (gray_diff2 < 15) & (gray_diff3 < 15)

    # Sample corners to find the checkerboard color range
    corner_ys = [0, 1, 2, 1023, 1022, 1021]
    corner_xs = [0, 1, 2, 512, 1023, 1022, 1021]
    corner_grays = []
    for y in corner_ys:
        for x in corner_xs:
            if y < data.shape[0] and x < data.shape[1]:
                rr, gg, bb = int(data[y,x,0]), int(data[y,x,1]), int(data[y,x,2])
                if abs(rr-gg) < 15 and abs(gg-bb) < 15:
                    corner_grays.append(rr)
    
    if corner_grays:
        c_min = min(corner_grays) - 15
        c_max = max(corner_grays) + 15
    else:
        c_min, c_max = 30, 240
    
    print(f"  Checker gray range from corners: {c_min}-{c_max} (samples: {corner_grays[:8]})")

    brightness = r.astype(int)
    is_checker_brightness = (brightness >= c_min) & (brightness <= c_max)

    checkerboard_mask = is_neutral_gray & is_checker_brightness & (a > 0)

    # Show sample of what we're removing
    removed_pixels = data[checkerboard_mask]
    if len(removed_pixels) > 0:
        sample_idx = np.linspace(0, len(removed_pixels)-1, min(8, len(removed_pixels)), dtype=int)
        print(f"  Removing sample RGB: {removed_pixels[sample_idx][:,:3].tolist()}")

    removed = int(checkerboard_mask.sum())
    data[checkerboard_mask, 3] = 0

    Image.fromarray(data).save(img_path, 'PNG')

    vdata = np.array(Image.open(img_path))
    opaque = int((vdata[:,:,3] > 0).sum())
    total = vdata.shape[0] * vdata.shape[1]
    print(f"  Removed {removed} pixels, {opaque}/{total} opaque remain ({100*opaque/total:.1f}%)")

assets = [
    r'C:\Users\Axel Rosete\Desktop\Ritmika\public\assets\axolo_announcing.png',
]

for path in assets:
    name = path.split('\\')[-1]
    print(f"Fixing {name}...")
    remove_checkerboard(path)
    verify = Image.open(path)
    print(f"  Result: Mode={verify.mode}, Size={verify.size}")

print("\nDone!")
