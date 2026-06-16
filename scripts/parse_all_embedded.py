import re
import json

with open("scripts/raw_embedded.html", "r", encoding="utf-8") as f:
    html = f.read()

# Pattern to match:
# <a href="https://drive.google.com/drive/folders/FOLDER_ID" ...> ... <div class="flip-entry-title">FOLDER_NAME</div>
pattern = re.compile(r'href="https://drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)"[^>]*>.*?<div class="flip-entry-title">([^<]+)</div>', re.DOTALL)
matches = pattern.findall(html)

folders = []
for match in matches:
    folders.append({
        "id": match[0],
        "name": match[1]
    })

print(f"Parsed {len(folders)} folders from embedded view HTML!")
if len(folders) > 0:
    print("First 5 folders:")
    print(json.dumps(folders[:5], indent=2))
    print("Last 5 folders:")
    print(json.dumps(folders[-5:], indent=2))
    
# Save this folders list to a temporary JSON so we can use it in our crawler
with open("scripts/all_artist_folders.json", "w", encoding="utf-8") as f:
    json.dump(folders, f, indent=2, ensure_ascii=False)
