import codecs

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'const song = pickSongForPlayer(player);' in line:
        if start_idx == -1: # Get the FIRST occurrence just in case
            start_idx = i
            print(f"Found start_idx at line {i+1}: {line.strip()}")
    # We want to find the NEXT occurrence of the start of KARAOKE PLAYER section
    if start_idx != -1 and i > start_idx:
        if 'let timerInterval   = null;' in line:
            # Wait, there are multiple `let timerInterval   = null;`?
            # Let's check for `challengeFired  = false;` right after it
            if i + 1 < len(lines) and 'challengeFired' in lines[i+1]:
                end_idx = i
                print(f"Found end_idx at line {i+1}: {line.strip()}")
                break

if start_idx != -1 and end_idx != -1:
    correct_code = """  state.currentSong = song;

  document.getElementById('selected-player-avatar-img').src = getAvatar(player.avatarId).img;
  document.getElementById('selected-player-name').textContent = player.name;
  document.getElementById('selected-song-info').textContent = song
    ? `Canción: "${song.title}" — ${song.artist}`
    : '🎲 Canción aleatoria de la noche';

  // Highlight winner chip
  document.querySelectorAll('.roulette-player-chip').forEach(c => c.classList.remove('is-winner'));
  const winnerChip = document.getElementById(`rchip-${player.socketId}`);
  if (winnerChip) {
    winnerChip.classList.add('is-winner');
  }

  const banner = document.getElementById('selected-player-banner');
  anime({
    targets: banner,
    opacity: [0, 1], scale: [0.8, 1],
    duration: 600, easing: 'easeOutBack',
  });

  const winMsgText = `¡${player.name} le toca cantar! ${state.currentSong ? `La canción es "${state.currentSong.title}"` : '¡La suerte eligió!'} ¡Que el palenque decida su destino! 🎤`;
  const winChoice = ROULETTE_WINS[Math.floor(Math.random() * ROULETTE_WINS.length)];
  axoloSay(winMsgText, winChoice.file);

  // Notify phones: singer was selected
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'SINGER_SELECTED',
    data: { socketId: player.socketId, name: player.name, song: state.currentSong },
  });
  // Private message to singer
  socket.emit('tv:send_to_player', {
    targetSocketId: player.socketId,
    event: 'YOUR_TURN',
    data: {},
  });

  // Auto-start karaoke after 8 seconds
  if (rouletteResultTimeout) clearTimeout(rouletteResultTimeout);
  rouletteResultTimeout = setTimeout(() => {
    startKaraoke(player, state.currentSong);
  }, 8000);
}

document.getElementById('go-karaoke-btn').addEventListener('click', () => {
  UISounds.click();
  if (rouletteResultTimeout) clearTimeout(rouletteResultTimeout);
  const player = state.singerQueue[state.currentSingerIdx % state.players.length] || state.players[0];
  startKaraoke(player, state.currentSong);
});

// ════════════════════════════════════════════
//  KARAOKE PLAYER
// ════════════════════════════════════════════
"""
    # So we replace from start_idx + 1 to end_idx - 1 (or just end_idx)
    # The start line `  const song = pickSongForPlayer(player);\n` stays.
    # The end line `let timerInterval   = null;\n` stays.
    
    # But wait, did I delete `let timerInterval` in my previous fix_leftover.py or fix_deleted_code.py?
    # No, we just saw `let timerInterval   = null;` in `tv.html`.
    
    new_lines = lines[:start_idx+1] + [correct_code] + lines[end_idx:]
    with codecs.open('public/tv.html', 'w', 'utf-8') as f:
        f.writelines(new_lines)
    print("Mangled code fixed!")
else:
    print("Could not find start or end markers for mangled block.")
