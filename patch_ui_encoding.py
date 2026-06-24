import sys

file_path = "public/js/tv/ui.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("Depresin", "Depresión")
content = content.replace("Apagn", "Apagón")
content = content.replace("Tu Diario de Depresi\ufffdn", "Tu Diario de Depresión")
content = content.replace("Apag\ufffdn Emocional", "Apagón Emocional")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
