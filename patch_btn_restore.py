import sys

file_path = "public/js/tv/socket.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

orig = """document.getElementById('btn-restore').addEventListener('click', () => {
  UISounds.click();
  const saved = loadSavedGame();
  if (!saved) return;
  state.isRestored = true;
  document.getElementById('restore-banner').classList.add('hidden');"""

new = """document.getElementById('btn-restore').addEventListener('click', () => {
  UISounds.click();
  const saved = loadSavedGame();
  if (!saved) return;
  state.isRestored = true;
  state.gameMode = saved.gameMode || 'clasico';
  if (typeof applyModeTheme === 'function') applyModeTheme();
  document.getElementById('restore-banner').classList.add('hidden');"""

if orig in content:
    content = content.replace(orig, new)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("socket.js patched for btn-restore")
else:
    print("Could not find btn-restore block in socket.js")
