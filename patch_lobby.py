import sys

file_path = "public/js/tv/lobby.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

orig_logic = """  // 2. Load the vignette asset and change style
  portrait.src = `./assets/tio_axolo_vignette_${assetName}.webp`;
  bar.style.backgroundColor = bgColor;
  textBox.textContent = texto;"""

new_logic = """  // 2. Load the vignette asset and change style
  if (typeof state !== 'undefined' && state && state.gameMode === 'emo') {
    portrait.src = `./assets/modes/emo/tio_axolo_vignette_emo_${assetName}.webp`;
    // Override bgColor for EMO mode
    if (emocion === 'laughing') bgColor = '#db2777'; // Darker pink
    else if (emocion === 'mischievous') bgColor = '#4c1d95'; // Deep purple
    else if (emocion === 'sad') bgColor = '#0f172a'; // Very dark slate
    else if (emocion === 'angry') bgColor = '#991b1b'; // Dark red
    else if (emocion === 'singing') bgColor = '#164e63'; // Dark cyan
    else bgColor = '#1e293b'; // Slate for neutral/talking
  } else {
    portrait.src = `./assets/tio_axolo_vignette_${assetName}.webp`;
  }
  bar.style.backgroundColor = bgColor;
  textBox.textContent = texto;"""

if orig_logic in content:
    content = content.replace(orig_logic, new_logic)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("lobby.js patched")
else:
    print("Could not find the target code in lobby.js")
