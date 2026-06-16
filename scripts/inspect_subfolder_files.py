import urllib.request
import re
import json

url = "https://drive.google.com/drive/folders/1RUdh0y3tQSA3HyIAWhD-BsPpid6B8LXz?usp=sharing"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
}
req = urllib.request.Request(url, headers=headers)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
except Exception as e:
    print("Error fetching folder:", e)
    exit(1)

# Let's search for file patterns
# We can search for the typical pattern of files:
# [[null,"FILE_ID"],null,null,null,"MIME_TYPE" ... [[["File Name"
# Let's write a regex that matches this
pattern = re.compile(r'\[\[null,"([a-zA-Z0-9_-]+)"\],null,null,null,"([^"]+)".*?\[\[\["([^"]+)"')
matches = pattern.findall(html)

files = []
for match in matches:
    # Filter out common folder types if they exist, or just keep everything
    files.append({
        "id": match[0],
        "mimeType": match[1],
        "name": match[2]
    })

print(f"Total entries found: {len(files)}")
print("First 10 entries:")
print(json.dumps(files[:10], indent=2))
