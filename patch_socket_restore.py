import sys

file_path = "public/js/tv/socket.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

orig = """socket.on('connect', () => {
  const saved = loadSavedGame();
  if (saved) {
    state.gameMode = saved.gameMode;"""

new = """socket.on('connect', () => {
  const saved = loadSavedGame();
  if (saved) {
    state.gameMode = saved.gameMode;
    if (typeof applyModeTheme === 'function') applyModeTheme();"""

if orig in content:
    content = content.replace(orig, new)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("socket.js patched for restore applyModeTheme")
else:
    print("Could not find restore block in socket.js")
