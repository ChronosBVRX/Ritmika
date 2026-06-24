import sys

file_path = "public/js/tv/ui.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_funcs = """
// --- MODE THEME HELPERS ---
window.getModeRoundLabels = function() {
  if (typeof state !== 'undefined' && state.gameMode === 'emo') {
    return {
      round1: "Tu Diario de Depresión",
      round2: "Trauma Compartido",
      round3: "Apagón Emocional"
    };
  }
  return null; // Fallback a clasico
};

window.getModeQueryParam = function() {
  if (typeof state !== 'undefined' && state.gameMode && state.gameMode !== 'clasico') {
    return `&mode=${state.gameMode}`;
  }
  return '';
};
"""

if "window.getModeRoundLabels" not in content:
    content += new_funcs
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added getModeRoundLabels and getModeQueryParam to ui.js")
else:
    print("getModeRoundLabels already in ui.js")

# And patch tv.html to call applyModeTheme right when selecting mode to prevent flicker
tv_path = "public/tv.html"
with open(tv_path, "r", encoding="utf-8") as f:
    tv_content = f.read()

orig_create_room = "if (typeof state !== 'undefined') state.gameMode = selectedMode;"
new_create_room = "if (typeof state !== 'undefined') { state.gameMode = selectedMode; if (typeof applyModeTheme === 'function') applyModeTheme(); }"

if orig_create_room in tv_content:
    tv_content = tv_content.replace(orig_create_room, new_create_room)
    with open(tv_path, "w", encoding="utf-8") as f:
        f.write(tv_content)
    print("Patched tv.html mode selection")
