import os
import re
import urllib.request
import urllib.parse

def download_fonts():
    css_url = "https://fonts.googleapis.com/css2?family=Paytone+One&family=Fredoka:wght@300;400;600;700&family=Outfit:wght@300;400;600;700;900&display=swap"
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    
    # Paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    fonts_dir = os.path.join(base_dir, "public", "assets", "fonts")
    os.makedirs(fonts_dir, exist_ok=True)
    
    print(f"[Fonts] Downloading CSS from Google Fonts...")
    req = urllib.request.Request(css_url, headers={"User-Agent": user_agent})
    try:
        with urllib.request.urlopen(req) as response:
            css_content = response.read().decode('utf-8')
    except Exception as e:
        print(f"[Fonts] ERROR fetching CSS: {e}")
        return False
        
    # Find all font URLs
    urls = re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css_content)
    urls = list(set(urls)) # unique URLs
    print(f"[Fonts] Found {len(urls)} font files to download.")
    
    url_map = {}
    for idx, url in enumerate(urls, 1):
        parsed_url = urllib.parse.urlparse(url)
        filename = os.path.basename(parsed_url.path)
        dest_path = os.path.join(fonts_dir, filename)
        
        print(f"[{idx}/{len(urls)}] Downloading {filename}...")
        try:
            # Download font file
            font_req = urllib.request.Request(url, headers={"User-Agent": user_agent})
            with urllib.request.urlopen(font_req) as font_res:
                with open(dest_path, "wb") as f:
                    f.write(font_res.read())
            url_map[url] = f"./{filename}"
        except Exception as e:
            print(f"[Fonts] Failed to download {url}: {e}")
            return False
            
    # Replace URLs in CSS content
    for original_url, local_path in url_map.items():
        css_content = css_content.replace(original_url, local_path)
        
    # Save the CSS file
    css_path = os.path.join(fonts_dir, "fonts.css")
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(css_content)
        
    print(f"[Fonts] SUCCESS! Local fonts stylesheet created at {css_path}")
    return True

if __name__ == "__main__":
    download_fonts()
