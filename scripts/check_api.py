import urllib.request
import json

url = 'https://script.google.com/macros/s/AKfycbxrTQu2KytHnN_uExsRIIX3h6lytkBwDcGo25zOFkXKcKN0vMUWhxpn1rkWrdobyucp/exec'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}
req = urllib.request.Request(url, headers=headers)

try:
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        data = json.loads(content)
        print("Success! Number of items in returned catalog:", len(data))
        print("First 3 items:")
        print(json.dumps(data[:3], indent=2))
except Exception as e:
    print("Error querying API:", e)
