import codecs

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

replacements = [
    (
        "pedColor:'linear-gradient(to top,#7c2d12,#f97316)'",
        "pedColor:'#f97316'"
    ),
    (
        "pedColor:'linear-gradient(to top,#164e63,#06b6d4)'",
        "pedColor:'#06b6d4'"
    ),
    (
        "row.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:10px;background:'+(isTop?'rgba(250,204,21,0.1)':'rgba(30,41,59,0.4)')+';border:1px solid '+(isTop?'rgba(250,204,21,0.3)':'rgba(51,65,85,0.4)')+';';",
        "row.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:0;background:'+(isTop?'#facc15':'#334155')+';border:4px solid #111827;box-shadow:4px 4px 0 #111827;';"
    )
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        print("Replaced:", old[:30])
    else:
        print("Not found:", old[:30])

with codecs.open('public/tv.html', 'w', 'utf-8') as f:
    f.write(content)
