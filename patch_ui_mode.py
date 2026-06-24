import sys

file_path = "public/js/tv/ui.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_func = """
// Apply Mode Theme based on gameMode
window.applyModeTheme = function() {
  if (typeof state !== 'undefined' && state.gameMode) {
    if (state.gameMode === 'clasico') {
      document.body.removeAttribute('data-mode');
    } else {
      document.body.setAttribute('data-mode', state.gameMode);
    }
  }
};
"""

if "window.applyModeTheme =" not in content:
    content += new_func
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("applyModeTheme added to ui.js")
else:
    print("applyModeTheme already exists in ui.js")
