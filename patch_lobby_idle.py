import sys

file_path = "public/js/tv/lobby.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

orig_idle = "const choice = idlePhrases[phraseIdx++ % idlePhrases.length];"
new_idle = """let currentPhrases = idlePhrases;
    if (typeof state !== 'undefined' && state && state.gameMode === 'emo' && typeof EMO_MODE_PHRASES !== 'undefined' && EMO_MODE_PHRASES.idle) {
      currentPhrases = EMO_MODE_PHRASES.idle;
    }
    const choice = currentPhrases[phraseIdx++ % currentPhrases.length];"""

if orig_idle in content:
    content = content.replace(orig_idle, new_idle)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("lobby.js idle phrases patched")
else:
    print("Could not find the target code in lobby.js for idle phrases")
