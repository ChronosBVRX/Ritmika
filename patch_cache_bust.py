import sys
import re
import time

def bust_cache(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # We will use the current timestamp to ensure a fresh load
    v = str(int(time.time()))

    # Find src="/js/..." or src="./js/..."
    # Replace with src="/js/... ?v=TIMESTAMP"
    # But carefully handle if they already have ?v=
    content = re.sub(r'src="(/js/[^"]+?)(?:\?v=\d+)?"', rf'src="\1?v={v}"', content)
    content = re.sub(r'src="(\./js/[^"]+?)(?:\?v=\d+)?"', rf'src="\1?v={v}"', content)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Cache busted in {file_path} with v={v}")

bust_cache("public/tv.html")
bust_cache("public/mobile.html")
