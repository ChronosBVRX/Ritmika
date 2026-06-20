import os
import re
from PIL import Image

def convert_assets():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, "public", "assets")
    
    converted_files = []
    total_original_size = 0
    total_new_size = 0
    
    # 1. Convert PNG files to WebP
    for root, dirs, files in os.walk(assets_dir):
        for file in files:
            if file.lower().endswith('.png'):
                # Skip favicon images
                if "favicon" in file.lower():
                    print(f"[Assets] Skipping favicon: {file}")
                    continue
                    
                png_path = os.path.join(root, file)
                webp_name = os.path.splitext(file)[0] + ".webp"
                webp_path = os.path.join(root, webp_name)
                
                original_size = os.path.getsize(png_path)
                total_original_size += original_size
                
                print(f"[Assets] Converting {file} ({original_size / 1024 / 1024:.2f} MB)...")
                try:
                    # Open and save as WebP
                    with Image.open(png_path) as img:
                        # Convert RGBA to RGB if necessary (Pillow handles transparent WebP fine, so we keep format)
                        img.save(webp_path, "WEBP", quality=85)
                        
                    new_size = os.path.getsize(webp_path)
                    total_new_size += new_size
                    
                    # Delete original PNG
                    os.remove(png_path)
                    
                    # Store relative paths for replacing in HTML
                    rel_png_path = os.path.relpath(png_path, assets_dir).replace('\\', '/')
                    rel_webp_path = os.path.relpath(webp_path, assets_dir).replace('\\', '/')
                    converted_files.append((rel_png_path, rel_webp_path))
                    
                except Exception as e:
                    print(f"[Assets] ERROR converting {file}: {e}")
                    
    savings = total_original_size - total_new_size
    print(f"[Assets] Done converting images.")
    print(f"[Assets] Original Size: {total_original_size / 1024 / 1024:.2f} MB")
    print(f"[Assets] WebP Size: {total_new_size / 1024 / 1024:.2f} MB")
    print(f"[Assets] Total Saved: {savings / 1024 / 1024:.2f} MB ({savings / (total_original_size or 1) * 100:.1f}% reduction)")
    
    # 2. Update references in HTML files
    html_files = [
        os.path.join(base_dir, "public", "tv.html"),
        os.path.join(base_dir, "public", "mobile.html"),
        os.path.join(base_dir, "public", "tv.html.bak")
    ]
    
    for html_path in html_files:
        if not os.path.exists(html_path):
            continue
            
        print(f"[Assets] Updating references in {os.path.basename(html_path)}...")
        with open(html_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        original_content = content
        for rel_png, rel_webp in converted_files:
            # We replace references like:
            # - ./assets/tio_axolo_body.png -> ./assets/tio_axolo_body.webp
            # - assets/tio_axolo_body.png -> assets/tio_axolo_body.webp
            # - "/assets/tio_axolo_body.png" -> "/assets/tio_axolo_body.webp"
            content = content.replace(f"/{rel_png}", f"/{rel_webp}")
            content = content.replace(f"/{rel_png.replace('/', '\\')}", f"/{rel_webp}")
            
            # Match without leading slash (like in relative paths)
            png_filename = os.path.basename(rel_png)
            webp_filename = os.path.basename(rel_webp)
            # Find and replace filename-level references that might not start with '/'
            content = content.replace(rel_png, rel_webp)
            
        if content != original_content:
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[Assets] Updated references in {os.path.basename(html_path)}")
        else:
            print(f"[Assets] No references needed updates in {os.path.basename(html_path)}")

if __name__ == "__main__":
    convert_assets()
