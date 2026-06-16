import re
import json

filepath = r"C:\Users\Axel Rosete\.gemini\antigravity\brain\a769e4c1-6c10-40dd-a22d-24626a3ef8a1\.system_generated\steps\34\content.md"

with open(filepath, 'r', encoding='utf-8') as f:
    html = f.read()

# Let's search for "next" or "token" or "cursor" in the script tag contents
# Let's extract all script contents
script_contents = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
print(f"Found {len(script_contents)} script tags")

for idx, script in enumerate(script_contents):
    # Search for nextPageToken, pageToken, etc.
    for kw in ["nextPageToken", "pageToken", "page_token", "cursor"]:
        if kw in script:
            print(f"Script {idx}: contains keyword '{kw}'")
            # print surrounding 200 chars
            pos = script.find(kw)
            print(script[pos-100:pos+100])
            print("-" * 50)
            
# Also check if there are any long base64 strings or tokens in the HTML that could be the page token
# Let's search for the last folder Caifanes ID "1RUdh0y3tQSA3HyIAWhD-BsPpid6B8LXz" and print what follows in the script tag
# The script tag containing Caifanes has "1RUdh0y3tQSA3HyIAWhD-BsPpid6B8LXz"
for idx, script in enumerate(script_contents):
    if "1RUdh0y3tQSA3HyIAWhD-BsPpid6B8LXz" in script:
        print(f"Script {idx} contains 'Caifanes'")
        # Let's print the last 1000 characters of this script block
        print("Last 1000 chars of script:")
        print(script[-1000:])
