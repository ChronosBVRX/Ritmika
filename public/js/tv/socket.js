// Helper: run callback when DOM is ready
function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

// ════════════════════════════════════════════
//  SOCKET.IO
// ════════════════════════════════════════════
let socket;
onReady(() => {
  socket = io();

  socket.on('connect', () => {
  console.log('[TV] Conectado. Preparando sala...');
  boot.step(1, 'done');
  boot.step(2, 'done', 'Esperando selección de modo');
  loadCatalog();
  // Check FFmpeg via health endpoint (step 4)
  fetch('/api/health', { signal: AbortSignal.timeout(5000) })
    .then(r => r.json())
    .then(h => {
      boot.step(4, 'done', h.ffmpeg ? 'FFmpeg disponible' : 'Sin FFmpeg (MP4 nativo OK)');
    })
    .catch(() => {
      boot.step(4, 'done', 'no verificado');
    });
});

socket.on('connect_error', () => {
  boot.fail(1, 'Sin conexión al servidor');
  updateTicker('No se puede conectar al servidor. ¿Está encendido?');
});

socket.on('tv:room_created', ({ roomCode, mode, localIP, hotspotSSID, hotspotPassword }) => {
  state.roomCode = roomCode;
  state.gameMode = mode || 'clasico';
  state.localIP = localIP || window.location.hostname;
  state.hotspotSSID = hotspotSSID || 'Ritmika';
  state.hotspotPassword = hotspotPassword || 'Ritmika2026';
  if (typeof applyModeTheme === 'function') applyModeTheme();
  renderRoomCode(roomCode);
  inicializarQRConexion();
  const st = document.getElementById('status-text');
  st.textContent = 'Esperando jugadores';
  anime({ targets: st, scale: [0.9, 1], opacity: [0.5, 1], duration: 300, easing: 'easeOutBack' });

  const saved = loadSavedGame();
  if (saved && !state.isRestored) {
    document.getElementById('restore-banner').classList.remove('hidden');
    document.getElementById('restore-players-count').textContent = `${saved.players.length} jugadores, Ronda ${saved.round}`;
  } else {
    document.getElementById('restore-banner').classList.add('hidden');
    const rrChoice = ROOM_READY_PHRASES[Math.floor(Math.random() * ROOM_READY_PHRASES.length)];
    window.pendingLobbyAudio = rrChoice;
  }
  updateTicker(`Sala ${roomCode} creada. ¡Comparte el código!`);

  // animateLobbyWelcome() is called by bootloader after transition
});

function syncReconnectedPlayer(player) {
  if (state.round === 0) return;

  const isAssign = !document.getElementById('round2-assignment-screen').classList.contains('hidden');
  const isVideo = !document.getElementById('video-screen').classList.contains('hidden');
  const isRoulette = !document.getElementById('roulette-screen').classList.contains('hidden');
  const podiumScreen = document.getElementById('podium-screen');
  const isPodium = podiumScreen && !podiumScreen.classList.contains('hidden');

  if (isPodium) {
    socket.emit('tv:send_to_player', {
      targetSocketId: player.socketId,
      event: 'GAME_OVER',
      data: { players: state.players }
    });
    return;
  }

  if (isAssign) {
    socket.emit('tv:send_to_player', {
      targetSocketId: player.socketId,
      event: 'ROUND_2_ASSIGN',
      data: {
        players: state.players.filter(p => !p.disconnected).map(p => ({
          socketId: p.socketId,
          name: p.name,
          avatarId: p.avatarId,
          genres: p.genres || [],
          artists: p.artists || [],
        })),
        songs: window.round2Songs || FALLBACK_CATALOG,
      }
    });
    return;
  }

  const singer = state.singerQueue[state.currentSingerIdx] || {};
  const song = state.currentSong;

  if (isRoulette) {
    const spinBtnHidden = document.getElementById('spin-btn').style.display === 'none';
    if (!spinBtnHidden) {
      socket.emit('tv:send_to_player', {
        targetSocketId: player.socketId,
        event: 'ROULETTE_START',
        data: {}
      });
    } else {
      socket.emit('tv:send_to_player', {
        targetSocketId: player.socketId,
        event: 'SINGER_SELECTED',
        data: { socketId: singer.socketId, name: singer.name, song }
      });
    }
    return;
  }

  if (isVideo) {
    const isVoting = !document.getElementById('voting-overlay').classList.contains('hidden');
    if (isVoting) {
      socket.emit('tv:send_to_player', {
        targetSocketId: player.socketId,
        event: 'VOTE_PHASE_START',
        data: { performerSocketId: singer.socketId }
      });
    } else {
      socket.emit('tv:send_to_player', {
        targetSocketId: player.socketId,
        event: 'KARAOKE_START',
        data: { socketId: singer.socketId, name: singer.name, song }
      });
    }
    return;
  }
}

socket.on('tv:player_joined', ({ player, players }) => {
  const saved = state.isRestored ? loadSavedGame() : null;
  const matchedNames = new Set();
  state.players = players.map(p => {
    const existing = state.players.find(s => s.socketId === p.socketId);
    if (existing) {
      return { ...existing, ...p, score: existing.score ?? p.score ?? 0 };
    }
    // Check if this player was disconnected (reconnection by name)
    const pending = state.players.find(s => s.disconnected && s.name === p.name && !matchedNames.has(p.name));
    if (pending) {
      matchedNames.add(p.name);
      return { ...p, ...pending, socketId: p.socketId, disconnected: false };
    }
    // En modo restauración: buscar por nombre (una sola vez por nombre)
    if (saved) {
      if (!matchedNames.has(p.name)) {
        const restored = saved.players.find(s => s.name === p.name);
        if (restored) {
          matchedNames.add(p.name);
          return { ...p, ...restored, socketId: p.socketId };
        }
      }
    }
    return { ...p, score: 0, genres: [], artists: [], tomatazos: 0 };
  });
  // Preserve unmatched pending entries (disconnected players who haven't rejoined yet)
  const previousPending = state.players.filter(s => s.disconnected && !matchedNames.has(s.name));
  previousPending.forEach(pp => state.players.push(pp));
  // Si todos los jugadores se reconectaron, salir del modo restauración
  if (state.isRestored && saved) {
    const allBack = saved.players.every(sp => state.players.some(p => p.name === sp.name));
    if (allBack) {
      state.isRestored = false;
      clearSavedGame();
      document.getElementById('restore-banner')?.classList.add('hidden');
      if (state.round > 0) {
        startRoulette();
      }
    }
  }
  renderPlayerList();
  updatePlayerCount(player);
  saveGameState();
  UISounds.chime();
  animatePlayerJoin(player);
  const joinLines = [
    { text: "¡El nuevo jugador llegó a echar el grito! 🎤", file: "lobby_join_0.mp3" },
    { text: "¡Órale, otro valiente se apuntó a sufrir! 😈", file: "lobby_join_1.mp3" },
    { text: "¡Bienvenido al ruedo! ¡Espero que afines! 🎵", file: "lobby_join_2.mp3" },
    { text: "¡Uno más al escenario! ¡El micrófono ya tiembla! 🎙️", file: "lobby_join_3.mp3" },
    { text: "¡Eso es todo! Entrando con todo el estilo del palenque. 😎", file: "lobby_join_4.mp3" },
    { text: "¡Cuidado que ahí viene la verdadera competencia! 🌟", file: "lobby_join_5.mp3" },
    { text: "¡Ya llegó por quien lloraban! Prepárense para el show. 🎭", file: "lobby_join_6.mp3" },
    { text: "¡Le dio clic al peligro! Bienvenido a la fiesta, compa. 💥", file: "lobby_join_7.mp3" },
    { text: "¡Qué valor el tuyo de venir a cantar frente a todos! 👏", file: "lobby_join_8.mp3" },
    { text: "¡Pásale, pásale! Que hay lugar para un desafinado más. 🥳", file: "lobby_join_9.mp3" }
  ];
  const choice = joinLines[Math.floor(Math.random() * joinLines.length)];
  const activeCount = state.players.filter(p => !p.disconnected).length;
  updateTicker(`¡${player.name} se unió! Ya somos ${activeCount} 🎉`);
  const now = Date.now();
  if (!window.lastLobbyVoice || now - window.lastLobbyVoice > 3500) {
    window.lastLobbyVoice = now;
    axoloSay(choice.text, choice.file);
  }
  if (activeCount >= 1) {
    document.getElementById('start-btn').classList.remove('hidden');
    RitmikaStyleFX.popIn('#start-btn', { duration: 700 });
  }

  // Sync state if game has already started
  if (state.round > 0) {
    syncReconnectedPlayer(player);
  }
});

socket.on('tv:player_left', ({ socketId, name, players }) => {
  // Keep disconnected player's state for potential reconnection
  const disconnectedPlayer = state.players.find(s => s.socketId === socketId);
  state.players = players.map(p => ({
    ...p,
    score:     state.players.find(s => s.socketId === p.socketId)?.score ?? 0,
    genres:    state.players.find(s => s.socketId === p.socketId)?.genres  ?? [],
    artists:   state.players.find(s => s.socketId === p.socketId)?.artists ?? [],
    tomatazos: state.players.find(s => s.socketId === p.socketId)?.tomatazos ?? 0,
  }));
  // Preserve disconnected player's data with flag for reconnection (avoid duplicates)
  if (disconnectedPlayer && !state.players.some(s => s.disconnected && s.name === disconnectedPlayer.name)) {
    state.players.push({
      name: disconnectedPlayer.name,
      avatarId: disconnectedPlayer.avatarId,
      socketId: 'pending_' + disconnectedPlayer.name,
      score: disconnectedPlayer.score ?? 0,
      genres: disconnectedPlayer.genres ?? [],
      artists: disconnectedPlayer.artists ?? [],
      tomatazos: disconnectedPlayer.tomatazos ?? 0,
      disconnected: true,
    });
  }
  // Filtrar singerQueue y ajustar índice si el que se fue era el actual o estaba pendiente
  const oldLen = state.singerQueue.length;
  state.singerQueue = state.singerQueue.filter(p => p.socketId !== socketId);
  if (state.singerQueue.length < oldLen && state.currentSingerIdx >= state.singerQueue.length) {
    state.currentSingerIdx = Math.max(0, state.singerQueue.length - 1);
  }
  renderPlayerList(); updatePlayerCount();
  updateTicker(`${name} abandonó la sala 👋`);
  saveGameState();

  // Sync mobile clients with updated player list
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'PLAYER_LEFT',
    data: { players: state.players },
  });

  if (state.players.filter(p => !p.disconnected).length < 1) document.getElementById('start-btn').classList.add('hidden');
});

socket.on('tv:player_genres', ({ socketId, genres }) => {
  const p = state.players.find(x => x.socketId === socketId);
  if (p) p.genres = genres;
  const name = p?.name || 'Alguien';
  updateTicker(`${name} eligió géneros: ${genres.join(', ')} 🎵`);
});

socket.on('tv:player_artists', ({ socketId, artists }) => {
  const p = state.players.find(x => x.socketId === socketId);
  if (p) p.artists = artists;
  const name = p?.name || 'Alguien';
  updateTicker(`${name} eligió artistas: ${artists.slice(0,3).join(', ')} 🎸`);
});

socket.on('tv:tomatazo', ({ attackerName, targetName, attackerSocketId }) => {
  const attacker = state.players.find(p => p.socketId === attackerSocketId);
  const cost = TOMATAZO_COST;
  if (attacker && attacker.score !== undefined) {
    if ((attacker.score || 0) < cost) {
      // Not enough points — send rejection to player
      socket.emit('tv:send_to_player', {
        targetSocketId: attackerSocketId,
        event: 'TOMATAZO_REJECTED',
        data: { reason: 'Puntos insuficientes', cost },
      });
      return;
    }
    attacker.score = Math.max(0, (attacker.score || 0) - cost);
    updateAllPlayerCardScores();
    socket.emit('tv:broadcast', {
      roomCode: state.roomCode,
      event: 'SCORE_UPDATE',
      data: { players: state.players.map(p => ({ socketId: p.socketId, score: p.score || 0, name: p.name })) },
    });
  }
  fireTomatazo(attackerName, targetName, cost);
  updateTicker(`🍅 ¡${attackerName} tomatazó a ${targetName} (-${cost} pts)!`);
  const target = state.players.find(p => p.name === targetName);
  if (target) target.tomatazos = (target.tomatazos || 0) + 1;
});

socket.on('tv:emoji', ({ senderName, emoji }) => {
  floatEmoji(emoji);
  updateTicker(`${senderName} reaccionó con ${emoji}`);
});

socket.on('tv:sabotage_audio', () => {
  state.audioSabotageCount++;
  const pct = Math.round((state.audioSabotageCount / state.AUDIO_SABOTAGE_THRESHOLD) * 100);
  updateTicker(`🔇 Sabotaje: ${pct}% (${state.audioSabotageCount}/${state.AUDIO_SABOTAGE_THRESHOLD})`);
  if (state.audioSabotageCount >= state.AUDIO_SABOTAGE_THRESHOLD) {
    triggerAudioSabotage();
    state.audioSabotageCount = 0;
  }
});

socket.on('tv:vote', ({ voterName, performerSocketId, score, voterSocketId }) => {
  state.votes.push({ voterName, performerSocketId, score });
  updateTicker(`${voterName} votó: ${score} pts 🗳️`);
  
  state.votedBy = state.votedBy || new Set();
  if (voterSocketId) state.votedBy.add(voterSocketId);
  
  // Broadcast vote count to mobiles
  const expectedCount = state.players.filter(p => p.socketId !== performerSocketId).length;
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'VOTE_COUNT',
    data: { count: state.votedBy.size, total: expectedCount },
  });
  
  // Check if all votes are in
  checkAllVotesSubmitted(performerSocketId);
});

function checkAllVotesSubmitted(performerSocketId) {
  const expectedVoters = state.players.filter(p => p.socketId !== performerSocketId);
  const expectedCount = expectedVoters.length;
  state.votedBy = state.votedBy || new Set();

  if (votePhaseActive && state.votedBy.size >= expectedCount) {
    if (votePhaseTimeout) clearTimeout(votePhaseTimeout);
    votePhaseActive = false;
    songEnded = false;
    const performer = state.players.find(p => p.socketId === performerSocketId) || state.players[0];
    endSong(performer);
  }
}

socket.on('tv:song_assigned', ({ attackerName, attackerSocketId, targetSocketId, songId }) => {
  state.assignedSongs[targetSocketId] = { attackerName, attackerSocketId, songId };
  updateTicker(`⚔️ ${attackerName} asignó una canción a su rival`);
  
  if (state.round === 2) {
    state.assignedBy = state.assignedBy || new Set();
    state.assignedBy.add(attackerSocketId);
    
    // Update visual status indicator on the player chip
    const statusEl = document.getElementById(`astatus-${attackerSocketId}`);
    if (statusEl) {
      statusEl.textContent = '✅';
      statusEl.className = 'assignment-status done';
    }
    
    // Update progress text
    const progEl = document.getElementById('roulette-assign-progress');
    if (progEl) {
      const activeR2Players = state.players.filter(p => !p.disconnected);
      const doneCount = [...state.assignedBy].filter(id => activeR2Players.some(p => p.socketId === id)).length;
      progEl.textContent = `Asignaciones: ${doneCount}/${activeR2Players.length}`;
    }
    
    // Check if all active players have submitted
    if (state.assignedBy.size >= state.players.filter(p => !p.disconnected).length) {
      console.log("[AUTO-FLOW] ¡Todos los jugadores asignaron canción! Girando ruleta...");
      if (rouletteAutoSpinTimeout) clearTimeout(rouletteAutoSpinTimeout);
      // Show spin button briefly before spinning
      document.getElementById('spin-btn').style.display = 'block';
      document.getElementById('roulette-heading').textContent = '¡Todas las asignaciones recibidas!';
      setTimeout(() => { spinRoulette(); }, 1200);
    }
  }
});

socket.on('tv:start_game_trigger', () => {
  const btn = document.getElementById('start-btn');
  if (btn && !btn.classList.contains('hidden')) {
    btn.click();
  }
});

socket.on('tv:start_song_trigger', () => {
  const btn = document.getElementById('go-karaoke-btn');
  if (btn) {
    btn.click();
  }
});

socket.on('tv:next_turn_trigger', () => {
  const btn = document.getElementById('continue-btn');
  if (btn) {
    btn.click();
  }
});

socket.on('tv:new_game_trigger', () => {
  const btn = document.getElementById('restart-btn-final');
  if (btn) {
    btn.click();
  }
});
});

// START GAME BUTTON
document.getElementById('start-btn').addEventListener('click', () => {
  if (!state.roomCode) return;
  UISounds.stinger();
  clearSavedGame();
  state.round = 1;
  state.singerQueue = [...state.players].sort(() => Math.random() - 0.5);
  state.currentSingerIdx = 0;
  if (idleInterval) { clearInterval(idleInterval); idleInterval = null; }
  socket.emit('tv:start_game', { roomCode: state.roomCode });
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'ROUND_INFO',
    data: { round: state.round },
  });
  startRoulette();
});

// DEBUG: Add bot player
// Toggle Debug Panel (Ctrl + B) or Click on JUGADORES
document.addEventListener('keydown', (e) => {
  if (e.key === 'F9') {
    e.preventDefault();
    const debugPanel = document.getElementById('secret-debug-panel');
    if (debugPanel) debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
  }
});

const secretTrigger = document.getElementById('secret-debug-trigger');
if (secretTrigger) {
  secretTrigger.addEventListener('dblclick', () => {
    const debugPanel = document.getElementById('secret-debug-panel');
    if (debugPanel) debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
  });
}


document.getElementById('btn-debug-add-bot').addEventListener('click', () => {
  if (!state.roomCode) return;
  socket.emit('tv:add_bot', { roomCode: state.roomCode });
});

// DEBUG: Quick start game (forces adding bot if 0 players)
document.getElementById('btn-debug-start-game').addEventListener('click', () => {
  if (!state.roomCode) return;
  if (state.players.filter(p => !p.disconnected).length === 0) {
    socket.emit('tv:add_bot', { roomCode: state.roomCode });
    setTimeout(() => {
      document.getElementById('start-btn').click();
    }, 1200);
  } else {
    document.getElementById('start-btn').click();
  }
});

document.getElementById('btn-restore').addEventListener('click', () => {
  UISounds.click();
  const saved = loadSavedGame();
  if (!saved) return;
  state.isRestored = true;
  document.getElementById('restore-banner').classList.add('hidden');
  // Cargar datos guardados al lobby
  state.players = saved.players.map(sp => ({
    name: sp.name, avatarId: sp.avatarId,
    score: sp.score, genres: sp.genres, artists: sp.artists, tomatazos: sp.tomatazos,
    socketId: null, // se llenará cuando se reconecten
  }));
  state.round = saved.round;
  state.currentSingerIdx = saved.currentSingerIdx;
  state.songQueue = saved.songQueue || [];
  renderPlayerList();
  updatePlayerCount();
  if (state.players.filter(p => !p.disconnected).length >= 1) {
    document.getElementById('start-btn').classList.remove('hidden');
  }
  updateTicker(`Partida restaurada. Pídele a los jugadores que vuelvan a unirse con el nuevo código.`);
  axoloSay('¡Partida restaurada! Los jugadores deben unirse de nuevo con el mismo nombre para recuperar sus puntos.', 'lobby_welcome.mp3');
});

document.getElementById('btn-dismiss-restore').addEventListener('click', () => {
  clearSavedGame();
  document.getElementById('restore-banner').classList.add('hidden');
  const rrChoice = ROOM_READY_PHRASES[Math.floor(Math.random() * ROOM_READY_PHRASES.length)];
  axoloSay(rrChoice.text, rrChoice.file);
});



