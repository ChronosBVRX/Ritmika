import codecs

deleted_code = """
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

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

marker = "  state.currentSong = song;\n\n// ════════════════════════════════════════════\nlet timerInterval   = null;"

if marker in content:
    new_content = content.replace(
        "  state.currentSong = song;\n\n// ════════════════════════════════════════════\nlet timerInterval   = null;",
        "  state.currentSong = song;\n" + deleted_code + "let timerInterval   = null;"
    )
    with codecs.open('public/tv.html', 'w', 'utf-8') as f:
        f.write(new_content)
    print("Code successfully restored.")
else:
    print("Marker not found! Fallback search...")
    # fallback
    marker2 = "  state.currentSong = song;\r\n\r\n// ════════════════════════════════════════════\r\nlet timerInterval"
    if marker2 in content:
        new_content = content.replace(
            marker2,
            "  state.currentSong = song;\r\n" + deleted_code + "let timerInterval"
        )
        with codecs.open('public/tv.html', 'w', 'utf-8') as f:
            f.write(new_content)
        print("Code successfully restored (fallback).")
    else:
        print("Fallback marker not found.")
