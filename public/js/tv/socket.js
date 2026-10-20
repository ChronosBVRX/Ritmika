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
let _hostToken = null;
let _relayConnected = false;
try { _hostToken = localStorage.getItem('ritmika_host_token'); } catch {}

function getSocketUrl() {
  const cfg = window.RITMIKA_CONFIG || {};
  if (cfg.CONNECTION_MODE === 'online' && cfg.RELAY_URL) return cfg.RELAY_URL;
  return undefined; // same origin (local)
}

function saveHostToken(token, code) {
  _hostToken = token;
  state.hostToken = token;
  try {
    if (token) localStorage.setItem('ritmika_host_token', token);
    if (code) localStorage.setItem('ritmika_room_code', code);
  } catch {}
}

function clearHostToken() {
  _hostToken = null;
  state.hostToken = null;
  try { localStorage.removeItem('ritmika_host_token'); localStorage.removeItem('ritmika_room_code'); } catch {}
}

function setupSocket(s) {
  socket = s;
  window._ritmikaSocket = s; // for debugging

  const setMenuStatus = (text, color) => {
    const strong = document.querySelector('.mm-status-copy strong');
    if (strong) strong.textContent = text;
    const dot = document.querySelector('.mm-status-dot');
    if (dot) {
      dot.style.background = color;
      dot.style.boxShadow = `0 0 0 4px ${color}22, 0 0 14px ${color}`;
    }
  };

  s.on('server_version', (v) => {
    const el = document.getElementById('mm-version');
    if (el) el.textContent = 'v' + v;
  });

  s.on('connect', () => {
    _relayConnected = true;
    setMenuStatus('TV LISTA', '#22c55e');
    console.log('[TV] Conectado a', s.io.uri || 'local', 'socket', s.id);
    const dot = document.getElementById('relay-status-dot');
    if (dot) dot.style.background = '#22c55e';
    const txt = document.getElementById('relay-status-text');
    if (txt) txt.textContent = 'Relay conectado';
    boot.step(1, 'done');
    boot.step(2, 'done', 'Esperando selección de modo');
    // Intentar reconexión de host si tenemos token y sala
    const savedCode = state.roomCode || (()=>{ try{return localStorage.getItem('ritmika_room_code');}catch{return null;}})();
    if (_hostToken && savedCode) {
      console.log('[TV] Intentando reconectar host a sala', savedCode);
      s.emit('tv:reconnect_host', { roomCode: savedCode, hostToken: _hostToken, mode: state.gameMode || 'clasico' });
    } else {
      // No hay reconexión, flujo normal
      loadCatalog();
    }
    fetch('/api/health', { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then(h => {
        boot.step(4, 'done', h.ffmpeg ? 'FFmpeg disponible' : 'Sin FFmpeg (MP4 nativo OK)');
        const lt=document.getElementById('local-status-text');
        if(lt) lt.textContent = 'Local: ' + (h.catalog ? h.catalogCount + ' canciones' : 'OK');
        if(lt) lt.style.color = h.catalog ? '#22c55e' : '#eab308';
      })
      .catch(() => {
        boot.step(4, 'done', 'no verificado');
        const lt=document.getElementById('local-status-text');
        if(lt){ lt.textContent='Local: fallo'; lt.style.color='#ef4444'; }
      });
  });

  s.on('disconnect', (reason) => {
    _relayConnected = false;
    setMenuStatus('RECONECTANDO', '#eab308');
    console.warn('[TV] Desconectado:', reason);
    const dot = document.getElementById('relay-status-dot');
    if (dot) dot.style.background = '#ef4444';
    const txt = document.getElementById('relay-status-text');
    if (txt) txt.textContent = 'Reconectando...';
    // No cerrar partida, esperar reconexión (tolerancia)
    updateTicker('Conexión al relay perdida. Reconectando... No se pierde la partida.');
  });

  s.on('connect_error', (err) => {
    setMenuStatus('SIN CONEXIÓN', '#ef4444');
    console.warn('[TV] connect_error', err && err.message);
    boot.fail(1, 'Sin conexión al relay/servidor');
    updateTicker('No se puede conectar al relay. Verifica Internet o RELAY_URL.');
    const dot = document.getElementById('relay-status-dot');
    if (dot) dot.style.background = '#eab308';
  });

  s.on('tv:reconnect_ack', ({ success, error, roomCode, mode }) => {
    if (success) {
      console.log('[TV] Reconexión exitosa sala', roomCode);
      state.roomCode = roomCode;
      state.gameMode = mode || state.gameMode || 'clasico';
      try{ localStorage.setItem('ritmika_room_code', roomCode);}catch{}
      renderRoomCode(roomCode);
      inicializarQRConexion();
      updateTicker('Reconectado a sala ' + roomCode + ' ✅');
      loadCatalog();
      if (typeof window.__ritmikaShellPush === 'function') window.__ritmikaShellPush();
    } else {
      console.warn('[TV] Reconexión falló:', error);
      clearHostToken();
      loadCatalog();
      // Self-heal: crear sala nueva para no dejar un código muerto en pantalla
      s.emit('tv:create_room', { mode: state.gameMode || 'clasico' });
    }
  });

  s.on('tv:room_created', ({ roomCode, mode, localIP, hotspotSSID, hotspotPassword, hostToken, relayUrl }) => {
    if (hostToken) saveHostToken(hostToken, roomCode);
    // relayUrl puede venir del relay para QR
    if (relayUrl) window.RITMIKA_CONFIG.RELAY_URL = relayUrl;
    state.roomCode = roomCode;
    state.gameMode = mode || 'clasico';
    state.localIP = localIP || window.location.hostname;
    state.hotspotSSID = hotspotSSID || 'Ritmika';
    state.hotspotPassword = hotspotPassword || 'Ritmika2026';
  if (typeof applyModeTheme === 'function') applyModeTheme();
  renderRoomCode(roomCode);
  inicializarQRConexion();
  if (state.round === 0) {
    FlowDirector.enter('lobby', { label: 'Sala de espera' });
  }
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
  if (typeof window.__ritmikaShellPush === 'function') window.__ritmikaShellPush();

  // animateLobbyWelcome() is called by bootloader after transition
});

function syncReconnectedPlayer(player) {
  if (state.round === 0) return;

  // El celular que se reconecta recibe el estado de fase actual para que sus
  // botones (girar / listo / siguiente) funcionen sin tocar la TV.
  FlowDirector.sendToPlayer(player.socketId);

  const phase = FlowDirector.getPhase();
  const isAssign = phase === 'roulette_wait' && state.round === 2;
  const isVideo = phase === 'karaoke_intro' || phase === 'karaoke' || phase === 'vote_pending' || phase === 'vote' || phase === 'scoreboard';
  const isRoulette = phase === 'roulette_wait' || phase === 'roulette_spin' || phase === 'singer_result';
  const podiumScreen = document.getElementById('podium-screen');
  const isPodium = phase === 'podium' || phase === 'podium_final' || !!podiumScreen;

  if (isPodium) {
    const sorted = [...state.players].sort((a, b) => (b.score || 0) - (a.score || 0));
    socket.emit('tv:send_to_player', { hostToken: _hostToken,
      targetSocketId: player.socketId,
      event: 'GAME_OVER',
      data: {
        results: sorted.map((p, i) => ({
          socketId: p.socketId,
          name: p.name,
          score: p.score || 0,
          award: i === 0 ? '👑 Rey del Palenque'
            : i === sorted.length - 1 ? '🐔 Gallo Supremo'
            : '🎤 Participante',
        })),
      }
    });
    return;
  }

  if (isAssign) {
    socket.emit('tv:send_to_player', { hostToken: _hostToken, 
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

  const queueSinger = state.singerQueue[state.currentSingerIdx] || {};
  const singer = (phase === 'roulette_wait' || phase === 'roulette_spin' || phase === 'singer_result')
    ? queueSinger
    : (currentSongPerformer || queueSinger);
  const song = state.currentSong;

  if (isRoulette) {
    const spinBtnHidden = document.getElementById('spin-btn').style.display === 'none';
    if (phase === 'singer_result' || spinBtnHidden) {
      socket.emit('tv:send_to_player', { hostToken: _hostToken,
        targetSocketId: player.socketId,
        event: 'SINGER_SELECTED',
        data: { socketId: singer.socketId, name: singer.name, song }
      });
    } else {
      socket.emit('tv:send_to_player', { hostToken: _hostToken,
        targetSocketId: player.socketId,
        event: 'ROULETTE_START',
        data: {}
      });
    }
    return;
  }

  if (isVideo) {
    let event = 'KARAOKE_START';
    let data = { socketId: singer.socketId, name: singer.name, song };
    if (phase === 'karaoke_intro') {
      event = 'KARAOKE_PREP';
    } else if (phase === 'vote' || phase === 'vote_pending') {
      event = 'VOTE_PHASE_START';
      data = { performerSocketId: singer.socketId, performerName: singer.name };
    } else if (phase === 'scoreboard') {
      event = 'SHOW_SCOREBOARD';
      data = { performerSocketId: singer.socketId, performerName: singer.name };
    }
    socket.emit('tv:send_to_player', { hostToken: _hostToken,
      targetSocketId: player.socketId,
      event,
      data
    });
    return;
  }
}

socket.on('tv:player_joined', ({ player, players }) => {
  console.log('[TV] player_joined', players ? players.length : 0, player && player.name);
  const saved = state.isRestored ? loadSavedGame() : null;
  const matchedNames = new Set();
  state.players = players.map(p => {
    // Match by playerId first (estable), then socketId
    const existing = state.players.find(s => (p.playerId && s.playerId === p.playerId) || s.socketId === p.socketId);
    if (existing) {
      return { ...existing, ...p, score: existing.score ?? p.score ?? 0, playerId: p.playerId || existing.playerId };
    }
    // Check if this player was disconnected (reconnection by playerId or name)
    const pending = state.players.find(s => s.disconnected && ((p.playerId && s.playerId === p.playerId) || s.name === p.name) && !matchedNames.has(p.name));
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
    return { ...p, score: 0, genres: [], artists: [], tomatazos: 0, playerId: p.playerId };
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
  if (typeof window.__ritmikaShellPush === 'function') window.__ritmikaShellPush();
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
  socket.emit('tv:broadcast', { roomCode: state.roomCode, hostToken: _hostToken,
    event: 'PLAYER_LEFT',
    data: { players: state.players },
  });

  if (state.players.filter(p => !p.disconnected).length < 1) document.getElementById('start-btn').classList.add('hidden');
  if (typeof window.__ritmikaShellPush === 'function') window.__ritmikaShellPush();
});

socket.on('tv:player_genres', ({ socketId, playerId, genres }) => {
  const p = state.players.find(x => (playerId && x.playerId === playerId) || x.socketId === socketId);
  if (p) p.genres = genres;
  const name = p?.name || 'Alguien';
  updateTicker(`${name} eligió géneros: ${genres.join(', ')} 🎵`);
});

socket.on('tv:player_artists', ({ socketId, playerId, artists }) => {
  const p = state.players.find(x => (playerId && x.playerId === playerId) || x.socketId === socketId);
  if (p) p.artists = artists;
  const name = p?.name || 'Alguien';
  updateTicker(`${name} eligió artistas: ${artists.slice(0,3).join(', ')} 🎸`);
});

socket.on('tv:tomatazo', ({ attackerName, targetName, attackerSocketId, attackerPlayerId }) => {
  const attacker = state.players.find(p => (attackerPlayerId && p.playerId === attackerPlayerId) || p.socketId === attackerSocketId);
  const cost = TOMATAZO_COST;
  if (attacker && attacker.score !== undefined) {
    if ((attacker.score || 0) < cost) {
      // Not enough points — send rejection to player
      socket.emit('tv:send_to_player', { hostToken: _hostToken, 
        targetSocketId: attackerSocketId,
        event: 'TOMATAZO_REJECTED',
        data: { reason: 'Puntos insuficientes', cost },
      });
      return;
    }
    attacker.score = Math.max(0, (attacker.score || 0) - cost);
    updateAllPlayerCardScores();
    socket.emit('tv:broadcast', { roomCode: state.roomCode, hostToken: _hostToken,
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

socket.on('tv:vote', ({ voterName, performerSocketId, performerPlayerId, score, voterSocketId, voterPlayerId }) => {
  // Resolve performer by playerId if needed
  let perfId = performerSocketId;
  if (performerPlayerId) {
    const perf = state.players.find(p => p.playerId === performerPlayerId);
    if (perf) perfId = perf.socketId;
  }
  state.votedBy = state.votedBy || new Set();
  const voterKey = voterPlayerId || voterSocketId;
  if (voterKey && state.votedBy.has(voterKey)) return;
  state.votes.push({ voterName, performerSocketId: perfId, score });
  updateTicker(`${voterName} votó: ${score} pts 🗳️`);

  if (voterKey) state.votedBy.add(voterKey);
  
  // Broadcast vote count to mobiles
  const expectedCount = state.players.filter(p => !p.disconnected && p.socketId !== performerSocketId).length;
  socket.emit('tv:broadcast', { roomCode: state.roomCode, hostToken: _hostToken,
    event: 'VOTE_COUNT',
    data: { count: state.votedBy.size, total: expectedCount },
  });
  
  // Check if all votes are in
  checkAllVotesSubmitted(performerSocketId);
});

function checkAllVotesSubmitted(performerSocketId) {
  const expectedVoters = state.players.filter(p => !p.disconnected && p.socketId !== performerSocketId);
  const expectedCount = expectedVoters.length;
  state.votedBy = state.votedBy || new Set();

  if (votePhaseActive && state.votedBy.size >= expectedCount) {
    // Ya votaron todos: se cierra la votación en cuanto Axolo termine de
    // hablar. Antes se cortaba el prompt de voto a la mitad.
    FlowDirector.hasten(2500, 500);
  }
}

socket.on('tv:song_assigned', ({ attackerName, attackerSocketId, attackerPlayerId, targetSocketId, targetPlayerId, songId }) => {
  const targetKey = targetPlayerId ? (state.players.find(p=>p.playerId===targetPlayerId)?.socketId || targetSocketId) : targetSocketId;
  state.assignedSongs[targetKey] = { attackerName, attackerSocketId, attackerPlayerId, songId };
  updateTicker(`⚔️ ${attackerName} asignó una canción a su rival`);
  
  if (state.round === 2) {
    state.assignedBy = state.assignedBy || new Set();
    state.assignedBy.add(attackerSocketId);

    // Actualizar indicadores solo si seguimos en la fase de asignación.
    const inAssignPhase = FlowDirector.getPhase() === 'roulette_wait' && !isSpinning;
    if (inAssignPhase) {
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
        if (rouletteAutoSpinTimeout) { clearTimeout(rouletteAutoSpinTimeout); rouletteAutoSpinTimeout = null; }
        // Mostrar el botón brevemente y girar en cuanto termine la voz.
        document.getElementById('spin-btn').style.display = 'block';
        document.getElementById('roulette-heading').textContent = '¡Todas las asignaciones recibidas!';
        FlowDirector.hasten(0, 1200);
      }
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
  if (!FlowDirector.request('start_song')) {
    updateTicker('La canción empezará cuando termine la presentación…');
  }
});

socket.on('tv:spin_roulette_trigger', () => {
  if (!FlowDirector.request('spin')) {
    updateTicker('Espera a que termine la presentación para girar…');
  }
});

socket.on('tv:next_turn_trigger', () => {
  if (!FlowDirector.request('next')) {
    updateTicker('El siguiente turno avanza solo en un momento…');
  }
});

socket.on('tv:new_game_trigger', () => {
  if (!FlowDirector.request('new_game')) {
    updateTicker('La nueva partida se habilita al terminar el podio…');
  }
});
} // end setupSocket

onReady(async () => {
  try { if (window.ritmikaConfigReady) await window.ritmikaConfigReady; } catch {}
  const url = getSocketUrl();
  const s = url ? io(url, { transports: ['websocket'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 }) : io();
  setupSocket(s);
});

// START GAME BUTTON
document.getElementById('start-btn').addEventListener('click', () => {
  if (!state.roomCode) return;
  if (state.round > 0) return;
  UISounds.stinger();
  clearSavedGame();
  FlowDirector.enter('starting', { label: 'Iniciando partida' });
  state.round = 1;
  state.singerQueue = [...state.players].sort(() => Math.random() - 0.5);
  state.currentSingerIdx = 0;
  if (idleInterval) { clearInterval(idleInterval); idleInterval = null; }
  socket.emit('tv:start_game', { roomCode: state.roomCode });
  socket.emit('tv:broadcast', { roomCode: state.roomCode, hostToken: _hostToken,
    event: 'ROUND_INFO',
    data: { round: state.round },
    hostToken: _hostToken,
  });
  startRoulette();
  if (typeof window.__ritmikaShellPush === 'function') window.__ritmikaShellPush();
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
  state.gameMode = saved.gameMode || 'clasico';
  if (typeof applyModeTheme === 'function') applyModeTheme();
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



