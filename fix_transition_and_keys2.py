import codecs
import re

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

# 1. Add fade-in animation
css_pattern = r"(#bootloader-screen\s*\{[^}]*transition:\s*opacity\s*0\.6s\s*ease;\s*overflow:\s*hidden;\s*)(\})"
content = re.sub(css_pattern, r"\1  animation: fade-in-boot 0.8s ease-out;\n    }\n    @keyframes fade-in-boot {\n      0% { opacity: 0; }\n      100% { opacity: 1; }\n    }", content)

# 2. Wrap debug buttons
html_pattern = r"(<div class=\"flex flex-col gap-2 p-3 rounded-xl mt-2\" style=\"background:rgba\(239,68,68,0\.05\); border:1px solid rgba\(239,68,68,0\.2\);\">\s*<span class=\"text-\[10px\] font-black uppercase tracking-widest\" style=\"color:#ef4444;\">.*?Debug</span>\s*<div class=\"flex gap-2\">\s*<button id=\"btn-debug-add-bot\"[^>]*>.*?</div>\s*</div>)"

new_html = r'<div id="secret-debug-panel" style="display:none; margin-top:8px;">\n        \1\n      </div>'
content = re.sub(html_pattern, new_html, content, flags=re.DOTALL)

with codecs.open('public/tv.html', 'w', 'utf-8') as f:
    f.write(content)
print("Regex replacements executed.")
