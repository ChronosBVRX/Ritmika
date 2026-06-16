import urllib.request
import re

url = "https://drive.google.com/embeddedfolderview?id=179yOuNE2_QzXU_IrKidVPXo7WJH11cHt"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
}
req = urllib.request.Request(url, headers=headers)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
    print("Embedded view fetched successfully!")
    print("HTML length:", len(html))
    
    # Check for folders in embedded view
    # Let's count occurrences of drive folder links
    # Standard format: class="folder-name" or href="/drive/folders/..."
    folder_links = re.findall(r'href="[^"]*drive/folders/([a-zA-Z0-9_-]+)"', html)
    print("Found folder links count:", len(folder_links))
    print("First 10 folder links:", folder_links[:10])
    
    # Let's check if names are present
    # We can write a raw regex to search for text or check if there is any pagination token
    print("Contains 'Bobby Pulido':", "Bobby Pulido" in html)
    print("Contains 'Caifanes':", "Caifanes" in html)
    print("Contains 'Mana':", "Mana" in html or "Maná" in html)
    print("Contains 'Shakira':", "Shakira" in html)
    
    with open("scripts/raw_embedded.html", "w", encoding="utf-8") as f:
        f.write(html)
        
except Exception as e:
    print("Error:", e)
