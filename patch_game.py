import sys

file_path = "public/js/tv/game.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update /api/songs?genres=...
content = content.replace(
    "const url = '/api/songs?genres=' + encodeURIComponent([...allPlayerGenres].join(',')) + '&limit=60&random=true';",
    "const url = '/api/songs?genres=' + encodeURIComponent([...allPlayerGenres].join(',')) + '&limit=60&random=true' + (typeof getModeQueryParam === 'function' ? getModeQueryParam() : '');"
)

# 2. Update /api/songs?limit=60...
content = content.replace(
    "const url = '/api/songs?limit=60&random=true';",
    "const url = '/api/songs?limit=60&random=true' + (typeof getModeQueryParam === 'function' ? getModeQueryParam() : '');"
)

# 3. Update /api/songs?random=true&limit=1
content = content.replace(
    "const res = await fetch('/api/songs?random=true&limit=1');",
    "const res = await fetch('/api/songs?random=true&limit=1' + (typeof getModeQueryParam === 'function' ? getModeQueryParam() : ''));"
)

# 4. Update /api/songs?artists=...
content = content.replace(
    "let url = '/api/songs?artists=' + encodeURIComponent(playerArtists.join(',')) + '&random=true&limit=1';",
    "let url = '/api/songs?artists=' + encodeURIComponent(playerArtists.join(',')) + '&random=true&limit=1' + (typeof getModeQueryParam === 'function' ? getModeQueryParam() : '');"
)

# 5. Update /api/songs?genres=... in priority 2
content = content.replace(
    "let url = '/api/songs?genres=' + encodeURIComponent(playerGenres.join(',')) + '&random=true&limit=1';",
    "let url = '/api/songs?genres=' + encodeURIComponent(playerGenres.join(',')) + '&random=true&limit=1' + (typeof getModeQueryParam === 'function' ? getModeQueryParam() : '');"
)

# 6. Update round badges
content = content.replace(
    "  const badges = ['Ronda 1 — Tu Elección, Tu Condena', 'Ronda 2 — Fuego Cruzado', 'Ronda 3 — Apagón Mental'];\n  document.getElementById('roulette-round-badge').querySelector('span:last-child').textContent = badges[state.round - 1] || 'Ronda Final';\n  const headings = ['¿Quién canta primero?', 'Asignen canciones a sus rivales...', '¿Quién sobrevive al apagón?'];\n  document.getElementById('roulette-heading').textContent = headings[state.round - 1] || '¿Quién sigue?';",
    "  const labels = typeof getModeRoundLabels === 'function' ? getModeRoundLabels() : null;\n  const badges = labels ? labels.badges : ['Ronda 1 — Tu Elección, Tu Condena', 'Ronda 2 — Fuego Cruzado', 'Ronda 3 — Apagón Mental'];\n  document.getElementById('roulette-round-badge').querySelector('span:last-child').textContent = badges[state.round - 1] || 'Ronda Final';\n  const headings = labels ? labels.headings : ['¿Quién canta primero?', 'Asignen canciones a sus rivales...', '¿Quién sobrevive al apagón?'];\n  document.getElementById('roulette-heading').textContent = headings[state.round - 1] || '¿Quién sigue?';"
)

# 7. Update rStartText in startRoulette
start_text_replace = """    let rStartText = '';
    let barkFile = `round_${state.round}_start_${rStartIdx}.mp3`;
    if (state.gameMode === 'emo') {
      if (state.round === 1) {
        rStartText = "¡Bienvenidos a Fiesta Emo! Hoy no se canta, se sangra emocionalmente. 🖤";
        barkFile = 'emo_intro_0.mp3';
      } else if (state.round === 2) {
        rStartText = "Elige a quién vas a destruir emocionalmente. 💔";
        barkFile = 'emo_intro_1.mp3';
      } else {
        rStartText = "Cuando la pantalla se apague, canta como si todavía doliera. 🌑";
        barkFile = 'emo_blackout_0.mp3';
      }
    } else {
      if (state.round === 1) {
        rStartText = rStartIdx === 0 ? "&#161;Ronda 1 iniciando! Prep&#225;rense para cantar." : "&#161;Arranca la Ronda 1! Escojan sus mejores rolas y demuestren talento.";
      } else if (state.round === 2) {
        rStartText = rStartIdx === 0 ? "&#161;Fuego cruzado activado! Asignen canciones a sus rivales" : "&#161;Ronda 2: Fuego Cruzado! Es hora de vengarse y darles la peor canci&#243;n posible.";
      } else {
        rStartText = rStartIdx === 0 ? "&#161;Ronda 3 iniciando! Se viene el apag&#243;n mental." : "&#161;Ronda 3! El Apag&#243;n Mental. Canten sin letra o queden en el olvido.";
      }
    }
    axoloSay(rStartText, barkFile);
    return;"""

start_text_orig = """    let rStartText = '';
    if (state.round === 1) {
      rStartText = rStartIdx === 0 ? "&#161;Ronda 1 iniciando! Prep&#225;rense para cantar." : "&#161;Arranca la Ronda 1! Escojan sus mejores rolas y demuestren talento.";
    } else if (state.round === 2) {
      rStartText = rStartIdx === 0 ? "&#161;Fuego cruzado activado! Asignen canciones a sus rivales" : "&#161;Ronda 2: Fuego Cruzado! Es hora de vengarse y darles la peor canci&#243;n posible.";
    } else {
      rStartText = rStartIdx === 0 ? "&#161;Ronda 3 iniciando! Se viene el apag&#243;n mental." : "&#161;Ronda 3! El Apag&#243;n Mental. Canten sin letra o queden en el olvido.";
    }
    axoloSay(rStartText, `round_${state.round}_start_${rStartIdx}.mp3`);
    return;"""

content = content.replace(start_text_orig, start_text_replace)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("game.js updated!")
