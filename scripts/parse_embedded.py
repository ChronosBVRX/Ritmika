with open("scripts/raw_embedded.html", "r", encoding="utf-8") as f:
    html = f.read()

id_to_find = "1C0xiCa_K_FD-kSfVy8uCOvVPbFu1rpb4"
pos = html.find(id_to_find)
if pos != -1:
    print(html[pos-100:pos+1000])
