from PIL import Image
import numpy as np

img_path = r'C:\Users\Axel Rosete\Desktop\Ritmika\public\assets\roulette_stars_decoration.png'
img = Image.open(img_path).convert('RGBA')
data = np.array(img)

r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

# Checkerboard grays: both dark (~51) and light (~119)
# Any pixel that is gray (R≈G≈B) and NOT part of an icon should be removed
# Icons are neon-colored: cyan, magenta, yellow, pink - none are neutral gray

# A pixel is "checkerboard gray" if:
# 1. R ≈ G ≈ B (within 10 of each other)
# 2. Its brightness is in the gray range (not too dark to be a black outline, not too bright)
gray_diff1 = np.abs(r.astype(int) - g.astype(int))
gray_diff2 = np.abs(g.astype(int) - b.astype(int))
gray_diff3 = np.abs(r.astype(int) - b.astype(int))
is_neutral_gray = (gray_diff1 < 12) & (gray_diff2 < 12) & (gray_diff3 < 12)

# Brightness
brightness = r.astype(int)  # since R≈G≈B, any channel works

# Checkerboard squares are typically in the range ~40-140
# Icons have neon outlines (dark, ~0-30) or bright fills
# Black outlines of icons are also dark but they're NOT gray - they have color
is_checker_brightness = (brightness >= 35) & (brightness <= 145)

checkerboard_mask = is_neutral_gray & is_checker_brightness & (a > 0)

print(f"Total pixels: {data.shape[0]*data.shape[1]}")
print(f"Neutral gray pixels in checker range: {checkerboard_mask.sum()}")

# Show what we're removing vs keeping
removed = data[checkerboard_mask][:,:3]
kept = data[~checkerboard_mask & (a > 0)][:,:3]
print(f"Removed pixels RGB sample: {removed[::max(1,len(removed)//10)]}")
print(f"Kept pixels RGB sample: {kept[::max(1,len(kept)//10)]}")

# Make checkerboard transparent
data[checkerboard_mask, 3] = 0

# Save
result = Image.fromarray(data)
result.save(img_path, 'PNG')

# Verify
vdata = np.array(Image.open(img_path))
opaque = vdata[:,:,3] > 0
print(f"\nRemaining opaque pixels: {opaque.sum()} / {vdata.shape[0]*vdata.shape[1]} ({100*opaque.sum()/(vdata.shape[0]*vdata.shape[1]):.1f}%)")
print("Done!")
