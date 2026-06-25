// ═══ LÓGICA DE JUEGO ═══
// Módulo extraído de tv.html
// ==============================================

// ════════════════════════════════════════════
//  ROULETTE
// ════════════════════════════════════════════
let rouletteAngle = 0;
let isSpinning    = false;
let rouletteAutoSpinTimeout = null;
let rouletteResultTimeout   = null;
let scoreboardTimeout       = null;

const ROULETTE_INTROS = [
  { text: '¡La ruleta decide tu condena! ¡Que el destino sea justo... o no! 🎰', file: 'roulette_intro_0.mp3' },
  { text: '¡Gira, gira, ruedita del dolor! ¡Alguien va a sufrir esta noche! 😈', file: 'roulette_intro_1.mp3' },
  { text: '¡El universo karaoke ha hablado! ¡Prepárense! 🌌', file: 'roulette_intro_2.mp3' },
  { text: '¡Nadie se escapa! ¡La ruleta del Tío Axolo todo lo ve! 👁️', file: 'roulette_intro_3.mp3' },
];

async function startRoulette() {
  showScreen('roulette-screen', 'flash');

  const remaining = state.singerQueue.slice(state.currentSingerIdx);
  if (remaining.length === 0) return; // safety

  if (remaining.length === 1) {
    const player = remaining[0];
    buildRouletteWheel([player]);
    document.getElementById('spin-btn').style.display = 'none';
    
    // Auto-select and show result immediately without spin
    showRouletteResult(player).catch(()=>{});
    return;
  }

  // Otherwise, build wheel for all remaining
  buildRouletteWheel(remaining);
  // Hide spin button during Ronda 2 assignment phase — show only after all assign
  if (state.round === 2) {
    document.getElementById('spin-btn').style.display = 'none';
  } else {
    document.getElementById('spin-btn').style.display = 'block';
  }

  const intro = ROULETTE_INTROS[Math.floor(Math.random() * ROULETTE_INTROS.length)];
  axoloSay(intro.text, intro.file);

  // Notify phones: roulette is spinning
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'ROULETTE_START',
    data: {},
  });

  // Ronda 2: pedir a los jugadores que asignen canciones (Fuego Cruzado)
  if (state.round === 2) {
    state.assignedBy = new Set();
    
    // Gather all genres selected by active players for relevance filtering
    const activeR2Players = state.players.filter(p => !p.disconnected);
    const allPlayerGenres = new Set();
    activeR2Players.forEach(p => { if (p.genres) p.genres.forEach(g => allPlayerGenres.add(g)); });
    
    // Fetch song pool from server (prefer player genres)
    window.round2Songs = window.round2Songs || [];
    try {
      if (allPlayerGenres.size > 0 && window.round2Songs.length === 0) {
        const url = '/api/songs?genres=' + encodeURIComponent([...allPlayerGenres].join(',')) + '&limit=60&random=true' + (typeof getModeQueryParam === 'function' ? getModeQueryParam() : '');
        const res = await fetch(url);
        if (res.ok) window.round2Songs = await res.json();
      }
      if (!window.round2Songs || window.round2Songs.length < 10) {
        const url = '/api/songs?limit=60&random=true' + (typeof getModeQueryParam === 'function' ? getModeQueryParam() : '');
        const res = await fetch(url);
        if (res.ok) window.round2Songs = (window.round2Songs || []).concat(await res.json());
      }
      
      // NEW FALLBACK: if we STILL have < 10 songs AND we are in a special mode, try querying the general catalog without mode
      if ((!window.round2Songs || window.round2Songs.length < 10) && state.gameMode && state.gameMode !== 'clasico') {
        console.warn(`⚠️ Catálogo insuficiente para modo ${state.gameMode}. Recurriendo al catálogo general.`);
        const url = '/api/songs?limit=60&random=true';
        const res = await fetch(url);
        if (res.ok) window.round2Songs = (window.round2Songs || []).concat(await res.json());
      }
    } catch (_) {}
    
    if (!window.round2Songs || window.round2Songs.length < 10) {
      window.round2Songs = FALLBACK_CATALOG;
    }
    
    socket.emit('tv:broadcast', {
      roomCode: state.roomCode,
      event: 'ROUND_2_ASSIGN',
      data: {
        players: activeR2Players.map(p => ({
          socketId: p.socketId,
          name: p.name,
          avatarId: p.avatarId,
          genres: p.genres || [],
          artists: p.artists || [],
        })),
        songs: window.round2Songs,
      },
    });

    // Automate assignments for bot players
    activeR2Players.forEach(p => {
      if (p.socketId.startsWith('bot_')) {
        const botDelay = 1500 + Math.random() * 2500; // 1.5 - 4 seconds delay
        setTimeout(async () => {
          const lobbyScreen = document.getElementById('roulette-screen');
          if (state.round === 2 && lobbyScreen && lobbyScreen.classList.contains('active') && !state.assignedBy.has(p.socketId)) {
            // Pick a random target (not the bot itself, only active players)
            const targets = activeR2Players.filter(t => t.socketId !== p.socketId);
            const target = targets[Math.floor(Math.random() * targets.length)] || activeR2Players[0];
            
            // Pick a random song from server
            let song = { id: 'default' };
            try {
              const res = await fetch('/api/songs?random=true&limit=1' + (typeof getModeQueryParam === 'function' ? getModeQueryParam() : ''));
              if (res.ok) {
                const list = await res.json();
                if (list && list.length > 0) song = list[0];
              }
              if (song.id === 'default' && state.gameMode && state.gameMode !== 'clasico') {
                const fallbackRes = await fetch('/api/songs?random=true&limit=1');
                if (fallbackRes.ok) {
                  const fallbackList = await fallbackRes.json();
                  if (fallbackList && fallbackList.length > 0) song = fallbackList[0];
                }
              }
            } catch (_) {}
            if (song.id === 'default' && FALLBACK_CATALOG.length > 0) {
              song = FALLBACK_CATALOG[Math.floor(Math.random() * FALLBACK_CATALOG.length)];
            }
            
            // Simulate the assignment locally
            state.assignedSongs[target.socketId] = { attackerName: p.name, attackerSocketId: p.socketId, songId: song.id };
            updateTicker(`⚔️ ${p.name} asignó una canción a su rival`);
            
            state.assignedBy.add(p.socketId);
            
            // Update visual status indicator on the player chip
            const statusEl = document.getElementById(`astatus-${p.socketId}`);
            if (statusEl) {
              statusEl.textContent = '✅';
              statusEl.className = 'assignment-status done';
            }
            
            // Update progress text
            const progEl = document.getElementById('roulette-assign-progress');
            if (progEl) {
              const doneCount = [...state.assignedBy].filter(id => activeR2Players.some(p2 => p2.socketId === id)).length;
              progEl.textContent = `Asignaciones: ${doneCount}/${activeR2Players.length}`;
            }
            
            // Check if all active players have submitted
            if (state.assignedBy.size >= activeR2Players.length) {
              console.log("[AUTO-FLOW] ¡Todos los jugadores asignaron canción (con bots)! Girando ruleta...");
              if (rouletteAutoSpinTimeout) clearTimeout(rouletteAutoSpinTimeout);
              document.getElementById('spin-btn').style.display = 'block';
              document.getElementById('roulette-heading').textContent = '¡Todas las asignaciones recibidas!';
              setTimeout(() => { spinRoulette(); }, 1200);
            }
          }
        }, botDelay);
      }
    });

    const r2Idx = Math.floor(Math.random() * 2);
    const r2Text = r2Idx === 0 ? "¡Fuego cruzado activado! Asignen canciones a sus rivales 🔥" : "¡Ronda 2: Fuego Cruzado! Es hora de vengarse y darles la peor canción posible. 😈";
    axoloSay(r2Text, `round_2_start_${r2Idx}.mp3`);
  }

  // Update round badge and heading
  const labels = typeof getModeRoundLabels === 'function' ? getModeRoundLabels() : null;
  const badges = labels ? labels.badges : ['Ronda 1 — Tu Elección, Tu Condena', 'Ronda 2 — Fuego Cruzado', 'Ronda 3 — Apagón Mental'];
  document.getElementById('roulette-round-badge').querySelector('span:last-child').textContent = badges[state.round - 1] || 'Ronda Final';
  const headings = labels ? labels.headings : ['¿Quién canta primero?', 'Asignen canciones a sus rivales...', '¿Quién sobrevive al apagón?'];
  document.getElementById('roulette-heading').textContent = headings[state.round - 1] || '¿Quién sigue?';

  // Mini player avatars
  const mini = document.getElementById('roulette-players-mini');
  mini.innerHTML = '';
  state.players.filter(p => !p.disconnected).forEach(p => {
    const av = getAvatar(p.avatarId);
    const el = document.createElement('div');
    el.className = 'roulette-player-chip';
    el.id = `rchip-${p.socketId}`;
    el.innerHTML = `
      <img src="${av.img}" style="border-color:${av.border};" />
      <span>${escapeHtml(p.name)}</span>
      <span class="chip-score">${p.score || 0} pts</span>
      ${state.round === 2 ? `<span id="astatus-${p.socketId}" class="assignment-status waiting" title="Esperando asignación">⏳</span>` : ''}
    `;
    mini.appendChild(el);
  });
  // Add assignment progress text for Ronda 2
  let progEl = document.getElementById('roulette-assign-progress');
  if (state.round === 2) {
    if (!progEl) {
      progEl = document.createElement('div');
      progEl.id = 'roulette-assign-progress';
      mini.parentNode.appendChild(progEl);
    }
    const activeR2Players = state.players.filter(p => !p.disconnected);
    const doneCount = [...(state.assignedBy || [])].filter(id => activeR2Players.some(p => p.socketId === id)).length;
    progEl.textContent = `Asignaciones: ${doneCount}/${activeR2Players.length}`;
    progEl.style.display = 'block';
  } else if (progEl) {
    progEl.style.display = 'none';
  }

  // Reset banner
  document.getElementById('selected-player-banner').style.opacity = '0';
  document.getElementById('selected-player-banner').style.transform = 'scale(0.8)';
  document.getElementById('spin-btn').disabled = false;

  // Auto-spin after 4 seconds (Ronda 2: 30s para que asignen canciones)
  if (rouletteAutoSpinTimeout) clearTimeout(rouletteAutoSpinTimeout);
  const autoSpinDelay = state.round === 2 ? 30000 : 4000;
  rouletteAutoSpinTimeout = setTimeout(() => {
    if (state.round === 2) {
      document.getElementById('spin-btn').style.display = 'block';
      document.getElementById('roulette-heading').textContent = '¡Tiempo agotado!';
    }
    spinRoulette();
  }, autoSpinDelay);
}

function buildRouletteWheel(playersToDraw) {
  const wheel = document.getElementById('roulette-wheel');
  wheel.innerHTML = '';
  const players   = playersToDraw || state.players;
  const n         = players.length;
  if (n === 0) return;

  const cx = 250, cy = 250, r = 228;
  const SLICE_COLORS = (state.gameMode === 'emo')
    ? ['#831843','#450a0a','#1e1b4b','#0f172a','#312e81','#000000','#581c87','#7f1d1d']
    : ['#ec4899','#22d3ee','#a855f7','#facc15','#f97316','#22c55e','#3b82f6','#06b6d4'];

  if (n === 1) {
    const p = players[0];
    const av = getAvatar(p.avatarId);
    
    // Draw a single circle filling the roulette area
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', SLICE_COLORS[0]);
    circle.setAttribute('stroke', '#111827');
    circle.setAttribute('stroke-width', '4');
    wheel.appendChild(circle);

    // Position label coordinates (in upper area so it rotates nicely when spun)
    const lx = cx;
    const ly = cy - 95;
    
    // Image element (using local transparent PNG)
    const avatarImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    avatarImg.setAttribute('href', av.img);
    const imgSize = 90;
    avatarImg.setAttribute('x', lx - imgSize / 2);
    avatarImg.setAttribute('y', ly - imgSize / 2 - 12);
    avatarImg.setAttribute('width', imgSize);
    avatarImg.setAttribute('height', imgSize);
    wheel.appendChild(avatarImg);

    // Name text
    const nameText = document.createElementNS('http://www.w3.org/2000/svg','text');
    nameText.setAttribute('x', lx);
    nameText.setAttribute('y', ly + imgSize / 2 + 15);
    nameText.setAttribute('text-anchor','middle');
    nameText.setAttribute('dominant-baseline','middle');
    nameText.setAttribute('font-size', '22');
    nameText.setAttribute('font-weight','900');
    nameText.setAttribute('fill','white');
    nameText.setAttribute('stroke','#111827');
    nameText.setAttribute('stroke-width','5');
    nameText.setAttribute('paint-order','stroke fill');
    nameText.textContent = p.name.slice(0, 10);
    wheel.appendChild(nameText);
    return;
  }

  const sliceAngle = (2 * Math.PI) / n;

  players.forEach((p, i) => {
    const startA = i * sliceAngle - Math.PI / 2;
    const endA   = startA + sliceAngle;
    const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA),   y2 = cy + r * Math.sin(endA);
    const lg = '0';

    // Slice path
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} Z`);
    path.setAttribute('fill', SLICE_COLORS[i % SLICE_COLORS.length]);
    path.setAttribute('stroke', '#111827');
    path.setAttribute('stroke-width', '4');
    path.style.opacity = '1';
    wheel.appendChild(path);

    // Label coordinates
    const midA = startA + sliceAngle / 2;
    const lx = cx + (r * 0.62) * Math.cos(midA);
    const ly = cy + (r * 0.62) * Math.sin(midA);
    const deg = (midA * 180 / Math.PI) + 90;

    const av = getAvatar(p.avatarId);
    
    // Avatar Image (using local transparent PNG)
    const avatarImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    avatarImg.setAttribute('href', av.img);
    const imgSize = n > 6 ? 38 : 52;
    avatarImg.setAttribute('x', lx - imgSize / 2);
    avatarImg.setAttribute('y', ly - imgSize / 2 - 10);
    avatarImg.setAttribute('width', imgSize);
    avatarImg.setAttribute('height', imgSize);
    avatarImg.setAttribute('transform', `rotate(${deg},${lx},${ly})`);
    wheel.appendChild(avatarImg);

    // Name text
    const nameText = document.createElementNS('http://www.w3.org/2000/svg','text');
    nameText.setAttribute('x', lx);
    nameText.setAttribute('y', ly + imgSize / 2 + 6);
    nameText.setAttribute('text-anchor','middle');
    nameText.setAttribute('dominant-baseline','middle');
    nameText.setAttribute('font-size', n > 6 ? '12' : '14');
    nameText.setAttribute('font-weight','900');
    nameText.setAttribute('fill','white');
    nameText.setAttribute('stroke','#111827');
    nameText.setAttribute('stroke-width','4');
    nameText.setAttribute('paint-order','stroke fill');
    nameText.setAttribute('transform', `rotate(${deg},${lx},${ly})`);
    nameText.textContent = p.name.slice(0, 8);
  });
}

document.getElementById('spin-btn').addEventListener('click', () => {
  UISounds.click();
  if (rouletteAutoSpinTimeout) clearTimeout(rouletteAutoSpinTimeout);
  spinRoulette();
});

function spinRoulette() {
  if (isSpinning) return;
  isSpinning = true;
  if (state.round === 2) state.assignedBy = new Set();
  if (rouletteAutoSpinTimeout) clearTimeout(rouletteAutoSpinTimeout);
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('selected-player-banner').style.opacity = '0';

  // Pick winner deterministically
  const winner = state.singerQueue[state.currentSingerIdx] || state.players[0];
  const remaining = state.singerQueue.slice(state.currentSingerIdx);
  const n         = remaining.length;

  // Calculate angle to land on winner's slice
  const sliceDeg   = 360 / n;
  const targetSlice = remaining.findIndex(p => p.socketId === winner.socketId);
  // Arrow is at top (270° in SVG terms); we want that slice under arrow
  const thetaDest = 360 - targetSlice * sliceDeg - sliceDeg / 2;
  const currentNormalized = rouletteAngle % 360;
  let diff = thetaDest - currentNormalized;
  if (diff <= 0) {
    diff += 360; // ensure we spin forward
  }
  let targetAngle = 360 * 5 + diff; // 5 full spins + diff
  if (n === 1) {
    targetAngle = 360 * 5;
  }

  let lastTickSlice = -1;

  anime({
    targets: '#roulette-wheel',
    rotate:  [rouletteAngle, rouletteAngle + targetAngle],
    duration: 2800,
    easing: 'cubicBezier(0.15, 0.85, 0.15, 1)',
    update: (anim) => {
      const currentRot = rouletteAngle + (anim.progress / 100) * targetAngle;
      const tickAngle = currentRot + 90;
      const currentSlice = Math.floor(tickAngle / sliceDeg);
      if (currentSlice !== lastTickSlice) {
        lastTickSlice = currentSlice;
        UISounds.tick();
        // CSS-based arrow bounce (no new anime() instance per tick)
        const arrowEl = document.getElementById('roulette-arrow');
        arrowEl.style.transition = 'none';
        arrowEl.style.transform = 'rotate(-18deg)';
        requestAnimationFrame(() => {
          arrowEl.style.transition = 'transform 110ms cubic-bezier(0.34,1.56,0.64,1)';
          arrowEl.style.transform = 'rotate(0deg)';
        });
      }
    },
    complete: () => {
      rouletteAngle = (rouletteAngle + targetAngle) % 360;
      isSpinning = false;
      showRouletteResult(winner).catch(()=>{});
    },
  });

  // Axolo excitement during spin
  const spinChoice = ROULETTE_SPINS[Math.floor(Math.random() * ROULETTE_SPINS.length)];
  axoloSay(spinChoice.text, spinChoice.file);
}

async function showRouletteResult(player) {
  if (rouletteAutoSpinTimeout) clearTimeout(rouletteAutoSpinTimeout);
  state.votes = [];
  const song = await pickSongForPlayer(player);
  state.currentSong = song;

  // Resolve video URL (presigned from R2 or public fallback)
  if (song && song.id) {
    fetch('/api/video-url?id=' + encodeURIComponent(song.id))
      .then(r => r.json())
      .then(data => {
        if (data && data.url && state.currentSong && state.currentSong.id === song.id) {
          state.currentSong._resolvedUrl = data.url;
        }
      })
      .catch(() => {});
  }

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
  const singerQueue = state.singerQueue.length ? state.singerQueue : state.players.filter(p => !p.disconnected);
  const player = singerQueue[state.currentSingerIdx % singerQueue.length] || singerQueue[0];
  startKaraoke(player, state.currentSong);
});

// ════════════════════════════════════════════
//  KARAOKE PLAYER
// ════════════════════════════════════════════
let timerInterval   = null;
let challengeFired  = false;
let blackoutFired   = false;
let blackoutTimeout = null;
let karaokeGeneration = 0;
let songEnded = false;
let currentSongPerformer = null;
let votePhaseActive = false;
let votePhaseTimeout = null;
const VOTE_PHASE_DURATION = 10000;
const activeSfx = [];
const SFX_VOLUME = 0.35;
const SFX_DUCKED = 0.10;
function playSfx(url, vol) {
  const a = new Audio(url);
  a.volume = vol ?? (currentAxoloAudio ? SFX_DUCKED : SFX_VOLUME);
  activeSfx.push(a);
  a.addEventListener('ended', () => {
    const idx = activeSfx.indexOf(a);
    if (idx > -1) activeSfx.splice(idx, 1);
  }, { once: true });
  a.play().catch(()=>{});
  return a;
}
function duckSfx() {
  activeSfx.forEach(a => { try { a.volume = SFX_DUCKED; } catch(e){} });
}
function unduckSfx() {
  activeSfx.forEach(a => { try { a.volume = SFX_VOLUME; } catch(e){} });
}
function stopAllSfx() {
  activeSfx.forEach(a => { try { a.pause(); a.src=''; } catch(e){} });
  activeSfx.length = 0;
}

async function startKaraoke(player, song) {
  if (document.getElementById('karaoke-screen').classList.contains('active')) return;
  karaokeGeneration++;
  songEnded = false;
  currentSongPerformer = player;
  const myGeneration = karaokeGeneration;
  showScreen('karaoke-screen', 'flash');

  // Resolve video URL if not already done
  if (song && song.id && !song._resolvedUrl) {
    fetch('/api/video-url?id=' + encodeURIComponent(song.id))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (data && data.url) song._resolvedUrl = data.url; })
      .catch(() => {});
  }

  state.votedBy = new Set();
  
  // Automate voting for bot players
  state.players.forEach(p => {
    if (p.socketId.startsWith('bot_') && p.socketId !== player.socketId) {
      const botDelay = 4000 + Math.random() * 8000; // 4 - 12 seconds delay
      setTimeout(() => {
        const karaokeScreen = document.getElementById('karaoke-screen');
        // Ensure we are still playing this song and the bot hasn't voted yet
        if (karaokeScreen && karaokeScreen.classList.contains('active') && !state.votedBy.has(p.socketId)) {
          const scores = [30, 60, 100];
          const botScore = scores[Math.floor(Math.random() * scores.length)];
          
          state.votes.push({ voterName: p.name, performerSocketId: player.socketId, score: botScore });
          updateTicker(`${p.name} votó: ${botScore} pts 🗳️`);
          
          state.votedBy.add(p.socketId);
          if (typeof checkAllVotesSubmitted === 'function') {
            checkAllVotesSubmitted(player.socketId);
          } else {
            // Fallback inline check
            const expectedVoters = (state.players || []).filter(p2 => p2.socketId !== player.socketId);
            if (votePhaseActive && (state.votedBy || new Set()).size >= expectedVoters.length) {
              if (votePhaseTimeout) clearTimeout(votePhaseTimeout);
              votePhaseActive = false;
              songEnded = false;
              endSong(player);
            }
          }
        }
      }, botDelay);
    }
  });

  const av = getAvatar(player.avatarId);
  document.getElementById('hud-singer-avatar-img').src = av.img;
  document.getElementById('hud-singer-name').textContent = player.name;
  document.getElementById('hud-round-label').textContent = 'Ronda ' + state.round;

  challengeFired = false;
  blackoutFired = false;
  document.getElementById('challenge-banner').style.transform = 'translateY(60px)';
  document.getElementById('blackout-banner').style.transform = 'scale(0)';
  document.getElementById('scoreboard-overlay').classList.remove('visible');
  const aph = document.getElementById('audio-only-placeholder');
  if (aph) aph.classList.remove('visible');

  // Video — recreate element and YIELD to compositor to fix black screen bug in WebView2
  const oldVideo = document.getElementById('karaoke-video');
  const video = document.createElement('video');
  video.id = 'karaoke-video';
  video.playsinline = true;
  video.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; object-fit:contain; z-index:1; background:#000;';
  
  if (oldVideo) {
    oldVideo.parentNode.replaceChild(video, oldVideo);
  } else {
    const wrap = document.getElementById('karaoke-video-wrap');
    if (wrap) wrap.appendChild(video);
  }

  // Resolve video URL (prefer presigned from R2, fallback raw DB URL)
  let videoUrl = null;
  if (song && song.id) {
    if (song._resolvedUrl) {
      videoUrl = song._resolvedUrl;
    } else {
      try {
        const vRes = await fetch('/api/video-url?id=' + encodeURIComponent(song.id));
        if (vRes.ok) {
          const vData = await vRes.json();
          videoUrl = vData && vData.url ? vData.url : null;
        }
      } catch (_) {}
    }
  }
  if (!videoUrl && song && song.url) videoUrl = song.url;

  // Set video src IMMEDIATELY so the compositor sees a valid source from frame 1
  if (song && videoUrl) {
    document.getElementById('lyrics-text').textContent = song.title;
    document.getElementById('np-artist').textContent = song.artist;
    video.muted = true;
    video.src = videoUrl;
    if (typeof bootMusic !== 'undefined' && bootMusic) bootMusic.pause();
  } else {
    document.getElementById('lyrics-text').textContent = '¡Canta lo que quieras!';
    document.getElementById('np-artist').textContent = '🎤';
  }

  // Notify phones and play Axolo intro immediately
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'KARAOKE_START',
    data: { socketId: player.socketId, name: player.name, song: song },
  });

  const choice = AXOLO_SINGER_INTROS[Math.floor(Math.random() * AXOLO_SINGER_INTROS.length)];
  const introMsg = choice.text;
  axoloSay(introMsg, choice.file);

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // YIELD to event loop so Chromium can attach the DOM element to the hardware compositor
  // Without this double requestAnimationFrame, the second video will play audio only (black screen)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (myGeneration !== karaokeGeneration) return;

      video.onplaying = () => {
        if (myGeneration !== karaokeGeneration) return;
        const errBanner = document.getElementById('video-error-banner');
        if (errBanner) errBanner.classList.remove('visible');
        if (!timerInterval) startKaraokeTimer(video, song);
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          setTimeout(() => {
            if (video.videoWidth === 0 || video.videoHeight === 0) {
              showAudioOnlyPlaceholder(song);
            }
          }, 500);
        }
      };
      
      video.onerror = () => {
        if (myGeneration !== karaokeGeneration) return;
        console.error("Video load error, starting timer manually.");
        const errBanner = document.getElementById('video-error-banner');
        if (errBanner) errBanner.classList.add('visible');
        if (!timerInterval) startKaraokeTimer(null, song || { duration: 120 });
      };
      
      video.onended = () => {
        if (myGeneration !== karaokeGeneration) return;
        startVotePhase(player, song);
      };

      if (videoUrl) {
        video.play().then(() => {
          if (myGeneration !== karaokeGeneration) return;
          const unmuteWhenReady = setInterval(() => {
            if (myGeneration !== karaokeGeneration || !currentAxoloAudio) {
              clearInterval(unmuteWhenReady);
              video.muted = false;
            }
          }, 200);
        }).catch(e => {
          console.warn("Autoplay block or explicit play failed:", e);
          if (!timerInterval) startKaraokeTimer(null, song);
        });
      } else {
        startKaraokeTimer(null, song || { duration: 120 });
      }
    });
  });
}

function startVotePhase(player, song) {
  if (songEnded) return;
  songEnded = true;
  votePhaseActive = true;

  clearInterval(timerInterval);
  timerInterval = null;
  if (blackoutTimeout) { clearTimeout(blackoutTimeout); blackoutTimeout = null; }
  _stopCurrentAxolo();
  stopAllSfx();
  const mouthCss = document.getElementById('axolo-mouth-css');
  if (mouthCss) mouthCss.classList.remove('open');
  document.getElementById('lyrics-text').classList.remove('blackout');
  document.getElementById('np-artist').classList.remove('blackout');

  const video = document.getElementById('karaoke-video');
  video.onplaying = null;
  video.onerror   = null;
  video.onended   = null;
  const aph = document.getElementById('audio-only-placeholder');
  if (aph) aph.classList.remove('visible');
  video.style.filter = '';
  video.pause();
  video.removeAttribute('src');

  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'VOTE_PHASE_START',
    data: { performerSocketId: player.socketId, performerName: player.name },
  });

  const votePrompt = AXOLO_VOTE_PROMPTS[Math.floor(Math.random() * AXOLO_VOTE_PROMPTS.length)];
  axoloSay(votePrompt.text, votePrompt.file);

  if (votePhaseTimeout) clearTimeout(votePhaseTimeout);
  votePhaseTimeout = setTimeout(() => {
    if (!votePhaseActive) return;
    votePhaseActive = false;
    songEnded = false;
    endSong(player);
  }, VOTE_PHASE_DURATION);
}

function showAudioOnlyPlaceholder(song) {
  const el = document.getElementById('audio-only-placeholder');
  if (!el) return;
  const titleEl = document.getElementById('aop-title');
  const artistEl = document.getElementById('aop-artist');
  if (titleEl && song) titleEl.textContent = song.title || 'Sin título';
  if (artistEl && song) artistEl.textContent = song.artist || '';
  el.classList.add('visible');
}

function startKaraokeTimer(video, song) {
  if (timerInterval) clearInterval(timerInterval);
  const duration = Math.floor((video && video.duration) || song?.duration || 120);
  let elapsed = 0;
  let timerBcastTick = 0;

  timerInterval = setInterval(() => {
    elapsed++;
    timerBcastTick++;
    const remaining = Math.max(0, Math.floor(duration - elapsed));
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    document.getElementById('hud-timer').textContent = `${mm}:${ss}`;

    if (timerBcastTick % 3 === 0 && state.roomCode) {
      socket.emit('tv:broadcast', {
        roomCode: state.roomCode,
        event: 'SONG_TIMER',
        data: { active: true, elapsed, duration },
      });
    }

    // Ronda 1: fire challenge at halfway
    if (state.round === 1 && !challengeFired && elapsed >= duration * 0.5) {
      challengeFired = true;
      fireChallenge();
    }

    // Ronda 3: blackout at random point between 40-60%
    if (state.round === 3 && !blackoutFired && elapsed >= duration * 0.4) {
      blackoutFired = true;
      fireBlackout();
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      const fallbackSinger = currentSongPerformer || state.singerQueue[state.currentSingerIdx % state.singerQueue.length] || state.players.find(p => !p.disconnected);
      startVotePhase(fallbackSinger, song);
    }
  }, 1000);
}

function fireChallenge() {
  const reto = RETO_CHALLENGES[Math.floor(Math.random() * RETO_CHALLENGES.length)];
  document.getElementById('challenge-text').textContent = reto;
  const banner = document.getElementById('challenge-banner');

  anime({
    targets: banner,
    opacity: [0, 1],
    translateY: [60, 0],
    duration: 700,
    easing: 'easeOutBack',
  });
  const cChoice = CHALLENGE_INTROS[Math.floor(Math.random() * CHALLENGE_INTROS.length)];
  const retoMsg = `¡RETO ACTIVADO! ${reto}`;
  axoloSay(retoMsg, cChoice.file);

  // Auto-hide after 8s
  setTimeout(() => {
    anime({ targets: banner, opacity: [1, 0], translateY: [0, 60], duration: 400, easing: 'easeInCubic' });
  }, 8000);
}

function fireBlackout() {
  const video = document.getElementById('karaoke-video');
  const lyrics = document.getElementById('lyrics-text');

  // Show blackout banner
  anime({
    targets: '#blackout-banner',
    scale: [0, 1.05, 1],
    duration: 600,
    easing: 'easeOutBack',
  });
  lyrics.classList.add('blackout');
  document.getElementById('np-artist').classList.add('blackout');
  if (video) video.style.filter = 'brightness(0.05)';

  const bIntroChoice = BLACKOUT_INTROS[Math.floor(Math.random() * BLACKOUT_INTROS.length)];
  const blackoutMsg = bIntroChoice.text;
  axoloSay(blackoutMsg, bIntroChoice.file);

  const blackoutDuration = 5000 + Math.random() * 5000;
  blackoutTimeout = setTimeout(() => {
    blackoutTimeout = null;
    anime({ targets: '#blackout-banner', scale: [1, 0], duration: 400, easing: 'easeInCubic' });
    lyrics.classList.remove('blackout');
    document.getElementById('np-artist').classList.remove('blackout');
    if (video) video.style.filter = '';
    const bEndChoice = BLACKOUT_ENDS[Math.floor(Math.random() * BLACKOUT_ENDS.length)];
    axoloSay(bEndChoice.text, bEndChoice.file);
  }, blackoutDuration);
}

function endSong(player) {
  if (songEnded) return;
  songEnded = true;
  clearInterval(timerInterval);
  timerInterval = null;
  const errBanner = document.getElementById('video-error-banner');
  if (errBanner) errBanner.classList.remove('visible');
  if (blackoutTimeout) { clearTimeout(blackoutTimeout); blackoutTimeout = null; }
  _stopCurrentAxolo();
  const mouthCss = document.getElementById('axolo-mouth-css');
  if (mouthCss) mouthCss.classList.remove('open');
  document.getElementById('lyrics-text').classList.remove('blackout');
  document.getElementById('np-artist').classList.remove('blackout');

  const video = document.getElementById('karaoke-video');
  video.onplaying = null;
  video.onerror   = null;
  video.onended   = null;
  const aph = document.getElementById('audio-only-placeholder');
  if (aph) aph.classList.remove('visible');
  video.style.filter = '';
  video.pause();
  video.removeAttribute('src');

  const overlay = document.getElementById('scoreboard-overlay');
  const list    = document.getElementById('score-results-list');
  list.innerHTML = '';

  const singerVotes = state.votes.filter(v => v.performerSocketId === player.socketId);
  const avgScore    = singerVotes.length
    ? Math.round(singerVotes.reduce((sum, v) => sum + v.score, 0) / singerVotes.length)
    : 50;

  const target = state.players.find(p => p.socketId === player.socketId);
  if (target) target.score = (target.score || 0) + avgScore;

  // Broadcast score update to mobiles
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'SCORE_UPDATE',
    data: { players: state.players.map(p => ({ socketId: p.socketId, score: p.score || 0, name: p.name })) },
  });

  if (singerVotes.length === 0) {
    list.innerHTML = `<p class="text-center" style="color:#64748b;">No hubo votos esta ronda</p>`;
  } else {
    singerVotes.forEach((v, i) => {
      const row = document.createElement('div');
      row.className = 'score-row';
      row.style.cssText = `background:${v.score >= 80 ? '#facc1522' : v.score >= 50 ? '#22d3ee22' : '#6b728022'}; border:1px solid ${v.score >= 80 ? '#facc1544' : '#33415544'}; opacity:0; transform:translateX(-30px);`;
      row.innerHTML = `
        <span class="text-2xl">${v.score >= 80 ? '&#127942;' : v.score >= 50 ? '&#128077;' : '&#128128;'}</span>
        <span class="font-bold text-sm flex-1" style="color:#f1f5f9;">${escapeHtml(v.voterName)}</span>
        <span class="text-xl font-black vote-score" style="color:${v.score >= 80 ? '#facc15' : '#94a3b8'};">0 pts</span>
      `;
      list.appendChild(row);
      setTimeout(() => {
        anime({
          targets: row, opacity: [0, 1], translateX: [-30, 0],
          duration: 400, easing: 'easeOutBack',
          complete: () => {
            const scoreEl = row.querySelector('.vote-score');
            RitmikaStyleFX.counter(scoreEl, 0, v.score, { duration: 500, suffix: ' pts' });
          }
        });
      }, 300 + i * 250);
    });
  }

  const totalRow = document.createElement('div');
  totalRow.className = 'mt-4 p-3 rounded-xl text-center';
  totalRow.style.cssText = 'background:#ec489922; border:1px solid #ec489966; opacity:0; transform:scale(0.8);';
  totalRow.innerHTML = `<p class="font-bold" style="color:#64748b;">PUNTOS GANADOS</p><p id="total-score-display" class="text-4xl font-black" style="color:#ec4899;">0</p>`;
  list.appendChild(totalRow);

  const totalDelay = 300 + singerVotes.length * 250 + 300;
  setTimeout(() => {
    playSfx('./assets/audio/sfx_magic_reveal.mp3');
    anime({
      targets: totalRow, opacity: [0, 1], scale: [0.8, 1.05, 1],
      duration: 600, easing: 'easeOutElastic(1, .5)',
      complete: () => {
        RitmikaStyleFX.counter(document.getElementById('total-score-display'), 0, avgScore, { duration: 800, prefix: '+' });
      }
    });
  }, totalDelay);

  saveGameState();
  overlay.classList.add('visible');

  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'SHOW_SCOREBOARD',
    data: { performerSocketId: player.socketId, performerName: player.name },
  });

  const singer = state.players.find(p => p.socketId === player.socketId);
  const genreBark = singer ? getGenreBark(singer) : '&#161;Vaya actuaci&#243;n!';
  const voteReact = getVoteReaction(avgScore);
  const endMsg = avgScore > 70 ? voteReact : genreBark;
  axoloSay(endMsg.text, endMsg.file);

  if (scoreboardTimeout) clearTimeout(scoreboardTimeout);
  const ceremonyDuration = 300 + singerVotes.length * 250 + 900;
  scoreboardTimeout = setTimeout(() => { nextTurn(); }, Math.max(ceremonyDuration + 4000, 12000));
}

document.getElementById('continue-btn').addEventListener('click', () => {
  UISounds.click();
  if (scoreboardTimeout) clearTimeout(scoreboardTimeout);
  nextTurn();
});

function nextTurn() {
  if (typeof bootMusic !== 'undefined' && bootMusic && bootMusic.paused) {
    bootMusic.volume = 0.06;
    bootMusic.play().catch(()=>{});
  }
  _stopCurrentAxolo();
  stopAllSfx();
  if (rouletteAutoSpinTimeout) clearTimeout(rouletteAutoSpinTimeout);
  if (rouletteResultTimeout) clearTimeout(rouletteResultTimeout);
  if (scoreboardTimeout) clearTimeout(scoreboardTimeout);
  if (blackoutTimeout) { clearTimeout(blackoutTimeout); blackoutTimeout = null; }

  document.getElementById('scoreboard-overlay').classList.remove('visible');
  state.currentSingerIdx++;

  if (state.currentSingerIdx >= state.singerQueue.length) {
    state.currentSingerIdx = 0;
    state.round++;

    if (state.round > 3) {
      showPodium();
      return;
    }

    if (state.round === 2) {
      state.assignedBy = new Set();
    }

    socket.emit('tv:broadcast', {
      roomCode: state.roomCode,
      event: 'ROUND_INFO',
      data: { round: state.round },
    });

        state.singerQueue = [...state.players.filter(p => !p.disconnected)].sort(() => Math.random() - 0.5);
    saveGameState();

    showRoundSplash(state.round, () => { startRoulette(); });
    const rStartIdx = Math.floor(Math.random() * 2);
    let rStartText = '';
    let barkFile = `round_${state.round}_start_${rStartIdx}.mp3`;
    if (state.gameMode === 'emo') {
      let phrases = EMO_MODE_PHRASES.intro;
      let choice = phrases[Math.floor(Math.random() * 3)]; // 0, 1, 2 are general intros
      
      if (state.round === 1 && phrases.length >= 4) choice = phrases[3];
      if (state.round === 2 && phrases.length >= 5) choice = phrases[4];
      if (state.round === 3 && phrases.length >= 6) choice = phrases[5];
      
      rStartText = choice.text;
      barkFile = choice.file;
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
    return;
  }

  startRoulette();
}

// ==============================================
//  PODIO FINAL - PREMIUM
// ==============================================
const AWARD_CARRILLA = {
  rey:      [{text:'&#161;La banda reconoci&#243; al verdadero &#237;dolo de la noche!', file:'award_rey_0.mp3'}, {text:'&#161;Nadie le llega ni a los talones!', file:'award_rey_1.mp3'}, {text:'&#161;El micr&#243;fono ya tiene nuevo due&#241;o permanente!', file:'award_rey_2.mp3'}],
  gallo:    [{text:'&#161;Los perros del barrio aullaron de solidaridad!', file:'award_gallo_0.mp3'}, {text:'&#161;Urgen 3 meses de solfeo, urgente!', file:'award_gallo_1.mp3'}, {text:'&#161;El honor de la familia exige pr&#225;ctica diaria!', file:'award_gallo_2.mp3'}],
  tomate:   [{text:'&#161;La banda habl&#243; con los proyectiles!', file:'award_tomate_0.mp3'}, {text:'&#161;Concentr&#243; todo el amor en forma de tomate!', file:'award_tomate_1.mp3'}, {text:'&#161;Tan bueno que mereci&#243; atenci&#243;n especial de todos!', file:'award_tomate_2.mp3'}],
  vengador: [{text:'&#161;Rob&#243; m&#225;s puntos que el gobierno!', file:'award_vengador_0.mp3'}, {text:'&#161;La t&#225;ctica del ataque silencioso funcion&#243; perfecto!', file:'award_vengador_1.mp3'}, {text:'&#161;Estratega karaoke de alto nivel!', file:'award_vengador_2.mp3'}],
};

let podiumBgm = null;

function showPodium() {
  if (typeof bootMusic !== 'undefined' && bootMusic) { bootMusic.pause(); }
  clearSavedGame();
  if (podiumBgm) { podiumBgm.pause(); podiumBgm.currentTime = 0; podiumBgm = null; }

  const sorted       = [...state.players].sort((a, b) => b.score - a.score);
  const mostTomatoes = [...state.players].sort((a, b) => (b.tomatazos||0) - (a.tomatazos||0))[0];
  const vengador     = sorted.length >= 3 ? sorted[1] : (sorted[1] || sorted[0]);
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];

  let awardsData = [];
  if (state.gameMode === 'emo') {
    awardsData = [
      { icon:'💔', img: './assets/modes/emo/award_broken_heart.webp', title:'Corazón Más Roto', subtitle:'Mayor Sufrimiento', player: sorted[sorted.length-1], color:'#6b7280', border:'#4b5563', obj: {text:'Ni tu ex te dejó tan mal como esta puntuación.', file: 'emo_award_0.mp3'} },
      { icon:'📱', img: './assets/modes/emo/award_indirecta.webp', title:'Mejor Indirecta', subtitle:'Fuego Cruzado Emo', player: vengador, color:'#a855f7', border:'#9333ea', obj: {text:'Esa indirecta dolió hasta en la otra cuadra.', file: 'emo_award_1.mp3'} },
      { icon:'🌑', img: './assets/modes/emo/award_blackout.webp', title:'Sobreviviente', subtitle:'Superó el Apagón', player: sorted[0], color:'#facc15', border:'#eab308', obj: {text:'Cantaste en la oscuridad mejor que en la luz.', file: 'emo_award_2.mp3'} },
    ];
  } else {
    awardsData = [
      { icon:'&#128019;', img: './assets/award_gallo.webp', title:'Gallo Supremo',    subtitle:'Valor Desafinado', player: sorted[sorted.length-1], color:'#6b7280', border:'#4b5563', obj: rand(AWARD_CARRILLA.gallo) },
      { icon:'&#127813;', img: './assets/award_tomate.webp', title:'Salsa de Tomate',  subtitle:'El M&#225;s Atacado',   player: mostTomatoes && mostTomatoes.tomatazos > 0 ? mostTomatoes : null, color:'#ef4444', border:'#dc2626', obj: rand(AWARD_CARRILLA.tomate) },
      { icon:'&#128535;', img: './assets/award_vengador.webp', title:'Vengador An&#243;nimo', subtitle:'Fuego Cruzado',    player: vengador, color:'#a855f7', border:'#9333ea', obj: rand(AWARD_CARRILLA.vengador) },
    ];
  }
  awardsData = awardsData.map(a => ({...a, carrilla: a.obj.text, file: a.obj.file}));
  const stepData = [
    { place:3, player:sorted[2], rank:'&#129350;', label:'3er Lugar', color:'#f97316', glow:'#f9731640', pedColor:'#f97316', size:'5.5rem' },
    { place:2, player:sorted[1], rank:'&#129349;', label:'2do Lugar', color:'#22d3ee', glow:'#22d3ee40', pedColor:'#06b6d4', size:'5.5rem' },
    { place:1, player:sorted[0], rank:'&#129351;', label:'1er Lugar', color:'#facc15', glow:'#facc1560', pedColor:'#facc15', size:'7.5rem' },
  ];

  const axoloOverlay = document.getElementById('axolo-cutin-overlay');
  if (axoloOverlay) axoloOverlay.style.zIndex = '10002';
  document.querySelectorAll('.tv-screen').forEach(s => { s.classList.remove('active'); s.style.display='none'; });
  const oldPodium = document.getElementById('podium-screen');
  if (oldPodium && oldPodium.parentNode) oldPodium.parentNode.removeChild(oldPodium);

  const ceremonyRoot = document.createElement('div');
  ceremonyRoot.id = 'podium-screen';
  ceremonyRoot.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#0a0a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;font-family:Fredoka,sans-serif;';
  document.body.appendChild(ceremonyRoot);


  const starCanvas = document.createElement('canvas');
  starCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;';
  starCanvas.width = window.innerWidth; starCanvas.height = window.innerHeight;
  ceremonyRoot.appendChild(starCanvas);
  const starCtx = starCanvas.getContext('2d');
  const stars = Array.from({length:120}, () => ({
    x:Math.random()*starCanvas.width, y:Math.random()*starCanvas.height,
    r:0.5+Math.random()*2, a:Math.random(), da:0.005+Math.random()*0.015,
    vy:-0.15-Math.random()*0.3,
    color:['#facc15','#ec4899','#22d3ee','#a855f7','#ffffff','#f97316'][Math.floor(Math.random()*6)],
  }));
  let starFrameId = null;
  function drawStars() {
    starCtx.clearRect(0,0,starCanvas.width,starCanvas.height);
    stars.forEach(s => {
      s.a += s.da; if(s.a>1||s.a<0) s.da*=-1;
      s.y += s.vy; if(s.y<-5) s.y=starCanvas.height+5;
      starCtx.globalAlpha = s.a*0.8;
      starCtx.fillStyle = s.color;
      starCtx.beginPath(); starCtx.arc(s.x,s.y,s.r,0,Math.PI*2); starCtx.fill();
    });
    starCtx.globalAlpha=1;
    starFrameId = requestAnimationFrame(drawStars);
  }
  drawStars();

  function fireworkBurst(x,y) {
    RitmikaStyleFX.confettiBurst(x,y,{count:60,colors:['#facc15','#ec4899','#22d3ee','#a855f7','#f97316','#ffffff','#22c55e']});
  }

  function animatePodiumCounter(el, target, duration, suffix) {
    duration = duration||1200; suffix = suffix||' pts';
    let start=null;
    function step(ts) {
      if(!start) start=ts;
      const progress=Math.min((ts-start)/duration,1);
      const eased=1-Math.pow(1-progress,3);
      el.textContent=Math.round(eased*target)+suffix;
      if(progress<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function wait(ms) { return new Promise(r=>setTimeout(r,ms)); }

  function waitForAxoloAudio(bufferMs) {
    bufferMs = bufferMs || 800;
    return new Promise(resolve => {
      if (!currentAxoloAudio) { setTimeout(resolve, bufferMs); return; }
      _axoloAudioDoneResolve = () => setTimeout(resolve, bufferMs);
    });
  }

  async function runCeremony() {

    // FASE 1: Titulo epico
    ceremonyRoot.innerHTML=''; ceremonyRoot.appendChild(starCanvas);
    const bgImg=document.createElement('div');
    bgImg.style.cssText='position:absolute;inset:0;background:url(./assets/podium_bg_stadium.webp) center/cover no-repeat;opacity:0;z-index:0;transition:opacity 1.2s ease;';
    ceremonyRoot.appendChild(bgImg);
    const bgOvl=document.createElement('div');
    bgOvl.style.cssText='position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,26,0.5) 0%,rgba(10,10,26,0.88) 100%);z-index:1;';
    ceremonyRoot.appendChild(bgOvl);
    setTimeout(()=>{ bgImg.style.opacity='1'; },100);

    const titleWrap=document.createElement('div');
    titleWrap.style.cssText='position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;';
    ceremonyRoot.appendChild(titleWrap);

    const trophyEl=document.createElement('img');
    trophyEl.src='./assets/podium_trophy_glow.webp';
    trophyEl.style.cssText='width:150px;height:150px;object-fit:contain;opacity:0;transform:translateY(-60px) scale(0.5);filter:drop-shadow(0 0 30px #facc15) drop-shadow(0 0 60px #facc1588);';
    titleWrap.appendChild(trophyEl);

    const titleBlock=document.createElement('div');
    titleBlock.style.cssText='display:inline-block;background:#ffe600;border:6px solid #111827;box-shadow:16px 16px 0 #111827;padding:28px 64px;border-radius:0;text-align:center;opacity:0;transform:scale(0.5) rotate(-3deg);margin-top:18px;';
    titleBlock.innerHTML='<h1 style="font-family:\'Paytone One\',sans-serif;font-size:64px;color:#111827;margin:0;line-height:1;">LA GRAN</h1><h1 style="font-family:\'Paytone One\',sans-serif;font-size:64px;color:#111827;margin:0;line-height:1;">PREMIACI&#211;N</h1>';
    titleWrap.appendChild(titleBlock);

    const subtitleEl=document.createElement('p');
    subtitleEl.style.cssText='font-family:Fredoka,sans-serif;font-size:22px;color:#facc15;font-weight:900;margin-top:20px;opacity:0;letter-spacing:3px;text-shadow:0 0 20px #facc1588;position:relative;z-index:2;';
    subtitleEl.innerHTML='&#10022; &#161;El T&#237;o Axolo reparte premios y carrilla! &#10022;';
    titleWrap.appendChild(subtitleEl);

    anime({targets:trophyEl,opacity:[0,1],translateY:[-60,0],scale:[0.5,1],duration:900,easing:'easeOutElastic(1,.5)'});
    await wait(300);
    anime({targets:titleBlock,opacity:[0,1],scale:[0.5,1.05,1],rotate:[-3,0],duration:900,easing:'easeOutBack'});
    await wait(400);
    anime({targets:subtitleEl,opacity:[0,1],translateY:[20,0],duration:600,easing:'easeOutQuad'});
    anime({targets:trophyEl,scale:[1,1.08,1],duration:1800,loop:true,easing:'easeInOutSine'});
    if (typeof state !== 'undefined' && state.gameMode === 'emo') {
      const p = EMO_MODE_PHRASES.podium[0];
      axoloSay(p.text, p.file);
    } else {
      axoloSay('&#161;Bienvenidos, banda, a la Gran Premiaci&#243;n de R&#237;tmika! Lleg&#243; el momento de la verdad. Vamos a coronar al Rey del Palenque, pero tambi&#233;n vamos a dar carrilla. Premios especiales, podio de ganadores, y muchas sorpresas m&#225;s. &#161;Que empiece la ceremonia!','podium_intro_ceremony.mp3');
    }
    await waitForAxoloAudio(1500);
    anime({targets:[titleBlock,subtitleEl,trophyEl],opacity:[1,0],translateY:[0,-40],duration:500,easing:'easeInCubic'});
    await wait(600);

    // FASE 2: Premios especiales
    for (const award of awardsData) {
      if (!award.player) continue;
      const av=getAvatar(award.player.avatarId);
      const sideDir=award.icon==='&#128019;'?-1:award.icon==='&#127813;'?1:0;
      ceremonyRoot.innerHTML=''; ceremonyRoot.appendChild(starCanvas);
      const aBg=document.createElement('div');
      aBg.style.cssText='position:absolute;inset:0;background:url(./assets/podium_bg_stadium.webp) center/cover no-repeat;opacity:0.22;z-index:0;';
      ceremonyRoot.appendChild(aBg);
      const aOvl=document.createElement('div');
      aOvl.style.cssText='position:absolute;inset:0;background:rgba(10,10,26,0.72);z-index:1;';
      ceremonyRoot.appendChild(aOvl);
      const sp=document.createElement('div');
      sp.style.cssText='position:absolute;left:50%;top:50%;width:0;height:0;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:1;transition:all 0.6s ease;';
      sp.style.background='radial-gradient(circle,'+award.color+'1a 0%,transparent 70%)';
      ceremonyRoot.appendChild(sp);
      setTimeout(()=>{sp.style.width='600px';sp.style.height='600px';},80);
      const aPhase=document.createElement('div');
      aPhase.style.cssText='position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;';
      ceremonyRoot.appendChild(aPhase);
      const aLabel=document.createElement('div');
      aLabel.style.cssText='font-family:\'Paytone One\',sans-serif;font-size:24px;text-transform:uppercase;letter-spacing:10px;margin-bottom:22px;opacity:0;';
      aLabel.style.color=award.color;
      aLabel.style.textShadow='6px 6px 0 #111827, 0 0 30px '+award.color+'88';
      aLabel.innerHTML='&#10022; PREMIO ESPECIAL &#10022;';
      const aCard=document.createElement('div');
      aCard.style.cssText='border-radius:0;padding:32px 52px;text-align:center;max-width:520px;width:90%;opacity:0;';
      aCard.style.background='#0f172a';
      aCard.style.border='6px solid '+award.color;
      aCard.style.boxShadow='16px 16px 0 #111827, 0 0 40px '+award.color+'88';
      aCard.style.transform='translateX('+(sideDir*130)+'%)';
      let awardGraphic = award.img ? '<img src="'+award.img+'" style="width:160px;height:160px;object-fit:contain;margin:0 auto 12px;filter:drop-shadow(0 0 18px '+award.color+');"/>' : '<div style="font-size:76px;margin-bottom:8px;filter:drop-shadow(0 0 18px '+award.color+');">'+award.icon+'</div>';
      aCard.innerHTML= awardGraphic 
        +'<h2 style="font-family:\'Paytone One\',sans-serif;font-size:42px;margin:6px 0;text-shadow:0 0 22px '+award.color+';color:'+award.color+';">'+award.title+'</h2>'
        +'<p style="font-family:Fredoka,sans-serif;font-size:15px;color:#94a3b8;font-weight:700;margin-bottom:16px;letter-spacing:2px;text-transform:uppercase;">'+award.subtitle+'</p>'
        +'<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:14px 0;padding:12px 20px;border-radius:0;background:'+award.color+';border:6px solid #111827;box-shadow:8px 8px 0 #111827;">'
        +'<div style="width:56px;height:56px;border-radius:50%;overflow:hidden;background:'+av.color+';border:6px solid #111827;display:flex;align-items:center;justify-content:center;box-shadow:6px 6px 0 #111827, 0 0 20px '+av.border+'66;">'
        +'<img src="'+av.img+'" style="width:90%;height:90%;object-fit:contain;"/></div>'
        +'<span style="font-family:\'Paytone One\',sans-serif;font-size:28px;color:#111827;">'+escapeHtml(award.player.name)+'</span></div>'
        +'<div style="background:#1e293b;border:6px solid #111827;border-radius:0;padding:14px 20px;margin-top:10px;box-shadow:8px 8px 0 #111827;">'
        +'<p style="font-family:Fredoka,sans-serif;font-size:16px;color:#f8fafc;font-weight:900;margin:0;line-height:1.5;">&ldquo;'+award.carrilla+'&rdquo;</p></div>';
      aPhase.appendChild(aLabel);
      aPhase.appendChild(aCard);
      anime({targets:aLabel,opacity:[0,1],translateY:[-20,0],duration:400,easing:'easeOutQuad'});
      await wait(200);
      anime({targets:aCard,opacity:[0,1],translateX:[sideDir*130+'%','0%'],duration:850,easing:'easeOutBack'});
      if(axoloOverlay) axoloOverlay.style.zIndex='10002';
      if(award.icon==='&#128019;' || award.icon==='&#127813;'){ playSfx('./assets/audio/sfx_comedy_fail.mp3'); } else { playSfx('./assets/audio/sfx_magic_reveal.mp3'); }
      _stopCurrentAxolo();
      const awardCeremonyFile = award.icon==='&#128019;' ? 'podium_award_gallo.mp3' : (award.icon==='&#127813;' ? 'podium_award_tomate.mp3' : 'podium_award_vengador.mp3');
      const awardCeremonyText = award.icon==='&#128019;' ? '&#161;El primero de los premios especiales... Gallo Supremo! Para el m&#225;s valiente, el que se atrevi&#243; a cantar pareciendo gato en licuadora. Banda, el Gallo Supremo de la noche es...' : (award.icon==='&#127813;' ? '&#161;Y ahora el premio Salsa de Tomate! Para el que recibi&#243; m&#225;s tomatazos que la selecci&#243;n en el Azteca. El rey de los tomatazos de la noche es...' : '&#161;El premio al Vengador An&#243;nimo! Saboteador profesional con cara de inocente. Rob&#243; m&#225;s puntos que el SAT. El Vengador An&#243;nimo es...');
      axoloSay(awardCeremonyText, awardCeremonyFile);
      await waitForAxoloAudio(1500);
      anime({targets:[aLabel,aCard],opacity:[1,0],translateY:[0,-40],duration:400,easing:'easeInCubic'});
      if(sp&&sp.parentNode) sp.parentNode.removeChild(sp);
      await wait(500);
    }

    // FASE 3: Revelacion 3ro y 2do
    playSfx('./assets/audio/sfx_drumroll.mp3');
    ceremonyRoot.innerHTML=''; ceremonyRoot.appendChild(starCanvas);
    const p3bg=document.createElement('div');
    p3bg.style.cssText='position:absolute;inset:0;background:url(./assets/podium_bg_stadium.webp) center/cover no-repeat;opacity:0.18;z-index:0;';
    ceremonyRoot.appendChild(p3bg);
    const p3ovl=document.createElement('div');
    p3ovl.style.cssText='position:absolute;inset:0;background:radial-gradient(circle at center,rgba(30,27,75,0.55) 0%,rgba(10,10,26,0.92) 100%);z-index:1;';
    ceremonyRoot.appendChild(p3ovl);
    const p3wrap=document.createElement('div');
    p3wrap.style.cssText='position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;width:100%;height:100%;gap:8px;';
    ceremonyRoot.appendChild(p3wrap);
    const p3title=document.createElement('div');
    p3title.style.cssText='font-family:\'Paytone One\',sans-serif;font-size:36px;color:#facc15;text-shadow:6px 6px 0 #111827, 0 0 30px #facc1566;opacity:0;padding-top:28px;letter-spacing:4px;border:6px solid #111827;background:#0f172a;padding:10px 30px;box-shadow:10px 10px 0 #111827;';
    p3title.innerHTML='&#127942; PODIO DE GANADORES &#127942;';
    p3wrap.appendChild(p3title);
    anime({targets:p3title,opacity:[0,1],scale:[0.7,1],duration:700,easing:'easeOutBack'});
    await wait(700);
    const p3steps=document.createElement('div');
    p3steps.style.cssText='display:flex;align-items:flex-end;justify-content:center;gap:2rem;width:100%;max-width:960px;height:360px;padding:0 20px;';
    p3wrap.appendChild(p3steps);
    const leftSlot=document.createElement('div'); leftSlot.style.cssText='width:240px;flex-shrink:0;';
    const centerSlot=document.createElement('div');
    centerSlot.style.cssText='width:260px;flex-shrink:0;display:flex;align-items:flex-end;justify-content:center;';
    const centerHolder=document.createElement('div');
    centerHolder.style.cssText='width:100%;border-radius:0;height:160px;background:#0f172a;border:6px dashed #111827;border-bottom:none;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 20px rgba(0,0,0,0.5);margin-bottom:-6px;';
    centerHolder.innerHTML='<span style="font-size:3rem;opacity:0.2;">?</span>';
    centerSlot.appendChild(centerHolder);
    const rightSlot=document.createElement('div'); rightSlot.style.cssText='width:220px;flex-shrink:0;';
    p3steps.appendChild(leftSlot);
    p3steps.appendChild(centerSlot);
    p3steps.appendChild(rightSlot);

    const partialSteps=stepData.filter(sd=>sd.place!==1);
    for (const sd of partialSteps) {
      if(!sd.player) continue;
      const av=getAvatar(sd.player.avatarId);
      const pedH=sd.place===2?'110px':'75px';
      const stepDiv=document.createElement('div');
      stepDiv.style.cssText='display:flex;flex-direction:column;align-items:center;width:'+(sd.place===2?'240px':'220px')+';opacity:0;transform:translateY(80px);';
      stepDiv.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;margin-bottom:10px;">'
        +'<span style="font-family:Fredoka,sans-serif;font-size:15px;font-weight:900;background:#111827;color:'+sd.color+';padding:5px 16px;border-radius:20px;border:2px solid '+sd.color+';margin-bottom:10px;letter-spacing:1px;">'+sd.rank+' '+sd.label+'</span>'
        +'<div style="border-radius:50%;overflow:hidden;background:'+av.color+';border:6px solid #111827;display:flex;align-items:center;justify-content:center;width:'+sd.size+';height:'+sd.size+';box-shadow:8px 8px 0 #111827;">'
        +'<img src="'+av.img+'" style="width:100%;height:100%;object-fit:contain;"/></div>'
        +'<p style="font-family:Fredoka,sans-serif;font-size:19px;color:#f1f5f9;font-weight:700;margin:10px 0 2px;text-align:center;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escapeHtml(sd.player.name)+'</p>'
        +'<p class="step-score-'+sd.place+'" style="font-family:\'Paytone One\',sans-serif;font-size:24px;color:'+sd.color+';margin:0;text-shadow:4px 4px 0 #111827;">0 pts</p></div>'
        +'<div style="width:100%;border-radius:0;height:'+pedH+';background:'+sd.color+';border:6px solid #111827;border-bottom:none;box-shadow:8px 8px 0 #111827, inset 0 0 20px '+sd.glow+';position:relative;overflow:hidden;margin-bottom:-6px;">'
        +'<div style="position:absolute;inset:0;background:linear-gradient(to right,transparent,rgba(255,255,255,0.07),transparent);"></div>'
        +'<div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);font-family:\'Paytone One\',sans-serif;font-size:3rem;font-weight:900;color:rgba(255,255,255,0.12);line-height:1;">'+sd.place+'</div></div>';
      if(sd.place===2) p3steps.replaceChild(stepDiv,leftSlot);
      else p3steps.replaceChild(stepDiv,rightSlot);
      _stopCurrentAxolo();
      if (sd.place===3) {
        axoloSay('&#161;Antes del gran campe&#243;n, hay que reconocer a los que llegaron al podio! En tercer lugar, con una actuaci&#243;n que ni fu ni fa... &#161;' + escapeHtml(sd.player.name) + '!', 'podium_reveal_third.mp3');
      } else {
        axoloSay('&#161;Y en segundo lugar, alguien que se la rif&#243; y casi arrebata la corona! &#161;' + escapeHtml(sd.player.name) + '!', 'podium_reveal_second.mp3');
      }
      UISounds.reveal();
      anime({targets:stepDiv,opacity:[0,1],translateY:['80px','0px'],duration:800,easing:'easeOutBack'});
      const scoreEl=stepDiv.querySelector('.step-score-'+sd.place);
      if(scoreEl) animatePodiumCounter(scoreEl,sd.player.score||0,1000);
      await waitForAxoloAudio(1200);
    }
    await wait(400);

    // FASE 4: MOMENTO WOW - 1er lugar
    if(sorted[0]) {
      const blackout=document.createElement('div');
      blackout.style.cssText='position:fixed;inset:0;background:#000;opacity:0;z-index:10003;pointer-events:none;';
      document.body.appendChild(blackout);
      anime({targets:blackout,opacity:[0,0.95],duration:600,easing:'easeInQuad'});
      await wait(400);
      _stopCurrentAxolo();
      axoloSay('&#161;Lleg&#243; el momento que todos esperaban! Despu&#233;s de tres rondas, canciones, tomatazos, y mucha carrilla... ha llegado la hora de coronar al Rey del Palenque. El ganador de R&#237;tmika es...', 'podium_winner_buildup.mp3');
      await waitForAxoloAudio(500);
      blackout.innerHTML='<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;"><p id="susp-text" style="font-family:\'Paytone One\',sans-serif;font-size:28px;color:#94a3b8;letter-spacing:10px;text-transform:uppercase;opacity:0;">Y el ganador es...</p><div id="countdown-wrap" style="display:flex;gap:30px;margin-top:10px;"></div></div>';
      anime({targets:'#susp-text',opacity:[0,1],translateY:[20,0],duration:600,easing:'easeOutQuad'});
      await wait(4000);
      const cwrap=document.getElementById('countdown-wrap');
      for(const n of ['3','2','1']){
        const nd=document.createElement('div');
        nd.style.cssText='font-family:\'Paytone One\',sans-serif;font-size:100px;color:#facc15;opacity:0;transform:scale(2);text-shadow:0 0 40px #facc15,0 0 80px #facc1566;line-height:1;';
        nd.textContent=n;
        cwrap.appendChild(nd);
        UISounds.playTone(n==='3'?440:n==='2'?523:659,0.4,'sine',0.2);
        anime({targets:nd,opacity:[0,1],scale:[2,1],duration:350,easing:'easeOutBack'});
        await wait(650);
        anime({targets:nd,opacity:[1,0],scale:[1,0.5],duration:250,easing:'easeInCubic'});
        await wait(300);
      }
      anime({targets:blackout,opacity:[0.95,0],duration:200,easing:'easeOutQuad',complete:()=>{if(blackout.parentNode)blackout.parentNode.removeChild(blackout);}});
      RitmikaStyleFX.flashBang('#facc15',600);
      UISounds.playTone(880,0.6,'sine',0.3);
      UISounds.playTone(1108,0.5,'sine',0.2);
      setTimeout(()=>UISounds.playTone(1318,0.8,'sine',0.25),120);
      [[0.2,0.3],[0.5,0.1],[0.8,0.35],[0.35,0.6],[0.65,0.25],[0.5,0.5]].forEach(([rx,ry],i)=>{
        setTimeout(()=>fireworkBurst(window.innerWidth*rx,window.innerHeight*ry),i*180);
      });
      await wait(300);
      const winnerScreen=document.createElement('div');
      winnerScreen.style.cssText='position:fixed;inset:0;z-index:10004;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at center,#1e1b4b 0%,#0a0a1a 100%);overflow:hidden;';
      document.body.appendChild(winnerScreen);
      const winnerAv=getAvatar(sorted[0].avatarId);
      ['25%','50%','75%'].forEach((pos,i)=>{
        const spl=document.createElement('div');
        spl.style.cssText='position:absolute;left:'+pos+';top:0;width:4px;height:100%;background:linear-gradient(to bottom,#facc1544,transparent);transform:rotate('+(i-1)*15+'deg);transform-origin:top center;pointer-events:none;';
        winnerScreen.appendChild(spl);
        anime({targets:spl,opacity:[0,0.7,0.3],duration:2000,loop:true,easing:'easeInOutSine'});
      });
      const winnerContent=document.createElement('div');
      winnerContent.id='winner-reveal-content';
      winnerContent.style.cssText='position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;opacity:0;transform:scale(0.6);';
      winnerContent.innerHTML='<img src="./assets/podium_crown.webp" id="winner-crown" style="width:140px;height:auto;object-fit:contain;filter:drop-shadow(0 0 28px #facc15) drop-shadow(0 0 56px #facc1588);margin-bottom:-22px;z-index:3;position:relative;"/>'
        +'<div style="width:180px;height:180px;border-radius:50%;overflow:hidden;background:'+winnerAv.color+';border:8px solid #111827;display:flex;align-items:center;justify-content:center;box-shadow:14px 14px 0 #111827;position:relative;z-index:2;">'
        +'<img src="'+winnerAv.img+'" style="width:100%;height:100%;object-fit:contain;"/></div>'
        +'<div style="margin-top:24px;background:#ffe600;border:6px solid #111827;box-shadow:16px 16px 0 #111827;padding:18px 50px;border-radius:0;text-align:center;">'
        +'<div style="font-family:\'Paytone One\',sans-serif;font-size:24px;color:#111827;letter-spacing:6px;text-transform:uppercase;">&#129351; GANADOR &#129351;</div>'
        +'<div style="font-family:\'Paytone One\',sans-serif;font-size:52px;color:#111827;line-height:1.1;margin-top:4px;">'+escapeHtml(sorted[0].name)+'</div></div>'
        +'<div id="winner-score-display" style="font-family:\'Paytone One\',sans-serif;font-size:42px;color:#facc15;margin-top:18px;text-shadow:6px 6px 0 #111827, 0 0 20px #facc15;opacity:0;background:#0f172a;border:6px solid #111827;padding:4px 30px;box-shadow:10px 10px 0 #111827;">0 pts</div>';
      winnerScreen.appendChild(winnerContent);
      anime({targets:'#winner-reveal-content',opacity:[0,1],scale:[0.6,1.05,1],duration:900,easing:'easeOutBack'});
      playSfx('./assets/audio/sfx_tada.mp3');
      setTimeout(()=>{playSfx('./assets/audio/sfx_applause.mp3');}, 500);
      await wait(400);
      anime({targets:'#winner-crown',translateY:[0,-18,0],duration:1200,loop:true,easing:'easeInOutSine'});
      anime({targets:'#winner-score-display',opacity:[0,1],translateY:[20,0],duration:500,easing:'easeOutQuad',delay:600});
      const wScoreEl=document.getElementById('winner-score-display');
      if(wScoreEl) setTimeout(()=>animatePodiumCounter(wScoreEl,sorted[0].score||0,1400),700);
      _stopCurrentAxolo();
      if (typeof state !== 'undefined' && state.gameMode === 'emo') {
        const p = EMO_MODE_PHRASES.podium[1];
        axoloSay(p.text, p.file);
      } else {
        axoloSay('&#161;El nuevo Rey del Palenque! &#161;' + escapeHtml(sorted[0].name) + '! El que demostr&#243; que tiene flow y que no le tiembla la voz. &#161;Felicidades, campe&#243;n, de parte del T&#237;o Axolo y de toda la banda!', 'podium_winner_reveal.mp3');
      }
      [800,1200,1600,2000].forEach(delay=>{
        setTimeout(()=>fireworkBurst(window.innerWidth*(0.2+Math.random()*0.6),window.innerHeight*(0.1+Math.random()*0.4)),delay);
      });
      await waitForAxoloAudio(1500);
      anime({targets:'#winner-reveal-content',opacity:[1,0],scale:[1,0.8],duration:500,easing:'easeInCubic'});
      await wait(600);
      if(winnerScreen.parentNode) winnerScreen.parentNode.removeChild(winnerScreen);
    }

    // FASE 5: Podio final completo premium
    ceremonyRoot.innerHTML=''; ceremonyRoot.appendChild(starCanvas);
    const finalBg=document.createElement('div');
    finalBg.style.cssText='position:absolute;inset:0;background:url(./assets/podium_bg_stadium.webp) center/cover no-repeat;opacity:0.16;z-index:0;';
    ceremonyRoot.appendChild(finalBg);
    const finalOvl=document.createElement('div');
    finalOvl.style.cssText='position:absolute;inset:0;background:radial-gradient(ellipse at 50% 80%,rgba(30,27,75,0.5) 0%,rgba(10,10,26,0.95) 100%);z-index:1;';
    ceremonyRoot.appendChild(finalOvl);
    const floorLine=document.createElement('div');
    floorLine.style.cssText='position:absolute;bottom:0;left:0;right:0;height:200px;background:linear-gradient(to top,rgba(250,204,21,0.05),transparent);z-index:1;pointer-events:none;';
    ceremonyRoot.appendChild(floorLine);
    const finalWrap=document.createElement('div');
    finalWrap.id='final-podium';
    finalWrap.style.cssText='position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;width:100%;height:100%;padding:14px 28px 18px;opacity:0;gap:6px;';
    ceremonyRoot.appendChild(finalWrap);
    const fTitle=document.createElement('div');
    fTitle.style.cssText='text-align:center;flex-shrink:0;';
    fTitle.innerHTML='<div style="background:#0f172a;border:6px solid #111827;padding:10px 40px;box-shadow:10px 10px 0 #111827;display:inline-block;"><h2 style="font-family:\'Paytone One\',sans-serif;font-size:34px;color:#facc15;margin:0;text-shadow:6px 6px 0 #111827,0 0 20px #facc1566;letter-spacing:3px;">&#127942; PODIO DE GANADORES &#127942;</h2><p style="font-family:Fredoka,sans-serif;font-size:16px;font-weight:900;color:#f8fafc;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;text-shadow:4px 4px 0 #111827;">&#161;El T&#237;o Axolo presenta el podio final de la noche!</p></div>';
    finalWrap.appendChild(fTitle);
    const finalPodiumContainer=document.createElement('div');
    finalPodiumContainer.style.cssText='display:flex;align-items:flex-end;justify-content:center;gap:2rem;width:100%;max-width:960px;flex:1;min-height:0;';
    finalWrap.appendChild(finalPodiumContainer);
    const orderedFinal=[
      stepData.find(s=>s.place===2),
      stepData.find(s=>s.place===1),
      stepData.find(s=>s.place===3),
    ].filter(Boolean);
    const pedHeights={1:'160px',2:'115px',3:'80px'};
    const avSizes={1:'8rem',2:'6rem',3:'5.5rem'};
    orderedFinal.forEach(sd=>{
      if(!sd.player) return;
      const av=getAvatar(sd.player.avatarId);
      const isWinner=sd.place===1;
      const stepEl=document.createElement('div');
      stepEl.style.cssText='display:flex;flex-direction:column;align-items:center;width:'+(isWinner?'260px':'210px')+';flex-shrink:0;';
      stepEl.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;margin-bottom:10px;position:relative;">'
        +(isWinner?'<img src="./assets/podium_crown.webp" style="width:68px;height:auto;object-fit:contain;filter:drop-shadow(0 0 14px #facc15);margin-bottom:-14px;z-index:3;position:relative;"/>':'')
        +'<span style="font-family:Fredoka,sans-serif;font-size:'+(isWinner?'16px':'14px')+';font-weight:900;background:#111827;color:'+sd.color+';padding:5px 16px;border-radius:20px;border:2px solid '+sd.color+';margin-bottom:'+(isWinner?'12px':'8px')+';letter-spacing:1px;">'+sd.rank+' '+sd.label+'</span>'
        +'<div style="border-radius:50%;overflow:hidden;background:'+av.color+';border:6px solid #111827;display:flex;align-items:center;justify-content:center;width:'+(avSizes[sd.place]||'5.5rem')+';height:'+(avSizes[sd.place]||'5.5rem')+';box-shadow:8px 8px 0 #111827;">'
        +'<img src="'+av.img+'" style="width:100%;height:100%;object-fit:contain;"/></div>'
        +'<p style="font-family:Fredoka,sans-serif;font-size:'+(isWinner?'19px':'16px')+';color:#f1f5f9;font-weight:700;margin:10px 0 2px;text-align:center;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escapeHtml(sd.player.name)+'</p>'
        +'<p class="final-score-'+sd.place+'" style="font-family:\'Paytone One\',sans-serif;font-size:'+(isWinner?'28px':'22px')+';color:'+sd.color+';margin:0;text-shadow:4px 4px 0 #111827,0 0 12px '+sd.color+'66;">0 pts</p></div>'
        +'<div style="width:100%;border-radius:0;height:'+(pedHeights[sd.place]||'80px')+';background:'+sd.color+';border:6px solid #111827;border-bottom:none;box-shadow:12px 12px 0 #111827,inset 0 0 20px rgba(255,255,255,0.3);position:relative;overflow:hidden;margin-bottom:-6px;">'
        +'<div style="position:absolute;top:0;left:0;right:0;height:28px;background:linear-gradient(to bottom,rgba(255,255,255,0.14),transparent);border-radius:1.5rem 1.5rem 0 0;"></div>'
        +'<div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);font-family:\'Paytone One\',sans-serif;font-size:'+(isWinner?'4.5rem':'3rem')+';font-weight:900;color:rgba(255,255,255,0.12);line-height:1;">'+sd.place+'</div></div>';
      finalPodiumContainer.appendChild(stepEl);
    });
    const bottomSection=document.createElement('div');
    bottomSection.style.cssText='display:flex;gap:1.2rem;width:100%;max-width:1040px;align-items:stretch;flex-shrink:0;height:138px;';
    finalWrap.appendChild(bottomSection);
    const awardsPanel=document.createElement('div');
    awardsPanel.style.cssText='flex:1;background:#1e293b;border:6px solid #111827;border-radius:0;padding:10px 14px;display:flex;flex-direction:column;box-shadow:10px 10px 0 #111827;';
    awardsPanel.innerHTML='<p style="font-size:9px;font-weight:900;letter-spacing:3px;color:#475569;text-transform:uppercase;margin:0 0 8px;">&#127885; Premios Especiales</p>';
    const awardsInner=document.createElement('div');
    awardsInner.style.cssText='display:flex;gap:8px;flex:1;align-items:center;justify-content:space-around;';
    awardsPanel.appendChild(awardsInner);
    awardsData.forEach(a=>{
      if(!a.player) return;
      const av=getAvatar(a.player.avatarId);
      const aEl=document.createElement('div');
      aEl.style.cssText='display:flex;flex-direction:column;align-items:center;text-align:center;flex:1;max-width:140px;gap:2px;';
      aEl.innerHTML='<div style="font-size:26px;filter:drop-shadow(0 0 8px '+a.color+');">'+a.icon+'</div>'
        +'<p style="font-size:10px;font-weight:900;text-transform:uppercase;color:'+a.color+';margin:0;letter-spacing:1px;">'+a.title+'</p>'
        +'<div style="width:32px;height:32px;border-radius:50%;overflow:hidden;background:'+av.color+';border:4px solid #111827;display:flex;align-items:center;justify-content:center;margin:2px 0;box-shadow:4px 4px 0 #111827;"><img src="'+av.img+'" style="width:90%;height:90%;object-fit:contain;"/></div>'
        +'<p style="font-size:12px;font-weight:800;color:#e2e8f0;margin:0;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escapeHtml(a.player.name)+'</p>';
      awardsInner.appendChild(aEl);
    });
    bottomSection.appendChild(awardsPanel);
    const sbPanel=document.createElement('div');
    sbPanel.style.cssText='width:290px;background:#1e293b;border:6px solid #111827;border-radius:0;padding:10px 14px;display:flex;flex-direction:column;flex-shrink:0;box-shadow:10px 10px 0 #111827;';
    sbPanel.innerHTML='<p style="font-size:9px;font-weight:900;letter-spacing:3px;color:#475569;text-transform:uppercase;margin:0 0 8px;">&#128202; Posiciones Finales</p>';
    const sbInner=document.createElement('div');
    sbInner.style.cssText='flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:5px;';
    const medals=['&#129351;','&#129349;','&#129350;'];
    sorted.forEach((p,i)=>{
      const av=getAvatar(p.avatarId);
      const isTop=i===0;
      const scoreColor=i===0?'#facc15':i===sorted.length-1?'#6b7280':'#94a3b8';
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:0;background:'+(isTop?'#facc15':'#334155')+';border:4px solid #111827;box-shadow:4px 4px 0 #111827;';
      row.innerHTML='<span style="font-size:12px;width:18px;text-align:center;font-weight:900;color:'+(isTop?'#111827':'#f1f5f9')+';">'+(medals[i]||'#'+(i+1))+'</span>'
        +'<div style="width:24px;height:24px;border-radius:50%;overflow:hidden;background:'+av.color+';border:2px solid #111827;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><img src="'+av.img+'" style="width:90%;height:90%;object-fit:contain;"/></div>'
        +'<span style="font-weight:900;flex:1;color:'+(isTop?'#111827':'#e2e8f0')+';font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escapeHtml(p.name)+'</span>'
        +'<span style="font-weight:900;font-size:12px;color:'+(isTop?'#111827':scoreColor)+';">'+(p.score||0)+'</span>'
        +'<span style="font-size:9px;color:'+(isTop?'#111827':'#64748b')+';font-weight:900;">pts</span>';
      sbInner.appendChild(row);
    });
    sbPanel.appendChild(sbInner);
    bottomSection.appendChild(sbPanel);
    const restartBtn=document.createElement('button');
    restartBtn.id='restart-btn-final';
    restartBtn.style.cssText='background:#ffe600;color:#111827;border:6px solid #111827;cursor:pointer;box-shadow:10px 10px 0 #111827;padding:13px 42px;border-radius:0;font-family:\'Paytone One\',sans-serif;font-size:22px;letter-spacing:1px;margin-top:4px;flex-shrink:0;transition:transform 0.15s,box-shadow 0.15s;text-transform:uppercase;';
    restartBtn.innerHTML='&#127918; Nueva Partida';
    restartBtn.onmouseover=()=>{restartBtn.style.transform='translateY(4px) translateX(4px)';restartBtn.style.boxShadow='6px 6px 0 #111827';};
    restartBtn.onmouseout=()=>{restartBtn.style.transform='';restartBtn.style.boxShadow='10px 10px 0 #111827';};
    finalWrap.appendChild(restartBtn);
    anime({targets:'#final-podium',opacity:[0,1],duration:700,easing:'easeOutQuad'});
    playSfx('./assets/audio/sfx_applause.mp3');
    orderedFinal.forEach(sd=>{
      if(!sd.player) return;
      const el=finalWrap.querySelector('.final-score-'+sd.place);
      if(el) setTimeout(()=>animatePodiumCounter(el,sd.player.score||0,1400),400);
    });
    setTimeout(()=>{RitmikaStyleFX.confettiBurst(window.innerWidth/2,0,{count:80});},500);
    setTimeout(()=>{RitmikaStyleFX.confettiBurst(window.innerWidth*0.2,0,{count:40});},1200);
    setTimeout(()=>{RitmikaStyleFX.confettiBurst(window.innerWidth*0.8,0,{count:40});},1800);
    restartBtn.addEventListener('click',()=>{
      stopMouthAnimation();
      _stopCurrentAxolo();
      stopAllSfx();
      if(starFrameId) cancelAnimationFrame(starFrameId);
      if(axoloOverlay) axoloOverlay.style.zIndex='';
      const podiumToRemove=document.getElementById('podium-screen');
      if(podiumToRemove&&podiumToRemove.parentNode) podiumToRemove.parentNode.removeChild(podiumToRemove);
      UISounds.click();
      state.round=0;state.players=[];state.votes=[];state.currentSingerIdx=0;
      state.singerQueue=[];state.audioSabotageCount=0;state.tomatazoCounts={};
      socket.emit('tv:create_room');
      showScreen('lobby-screen');
      const newGameChoice=NEW_GAMES[Math.floor(Math.random()*NEW_GAMES.length)];
      axoloSay(newGameChoice.text,newGameChoice.file,4000,true);
    });
    socket.emit('tv:broadcast',{
      roomCode:state.roomCode,event:'GAME_OVER',
      data:{results:sorted.map((p,i)=>({socketId:p.socketId,name:p.name,score:p.score,
        award:i===0?'&#128081; Rey del Palenque':p===sorted[sorted.length-1]?'&#128019; Gallo Supremo':'&#127908; Participante'
      }))},
    });
    const winner=sorted[0];
    const fVictoryChoice=FINAL_VICTORIES[Math.floor(Math.random()*FINAL_VICTORIES.length)];
    const pClimaxChoice=PODIUM_CLIMAXES[Math.floor(Math.random()*PODIUM_CLIMAXES.length)];
    let customPodiumScript='';
    if(pClimaxChoice.file==='podium_climax_0.mp3'){
      customPodiumScript='&#161;Y as&#237; termina la noche m&#225;s &#233;pica del a&#241;o! Con '+(winner?.score||0)+' puntos, el ganador es... &#161;'+(winner?.name||'alguien misterioso')+'! &#161;El Rey del Palenque ha sido coronado! &#161;Gracias banda por esta noche de gloria, carrilla y alg&#250;n que otro tomate! &#161;Hasta la pr&#243;xima fiesta!';
    } else if(pClimaxChoice.file==='podium_climax_1.mp3'){
      customPodiumScript='&#161;Qu&#233; noche, se&#241;ores! Con '+(winner?.score||0)+' puntos, &#161;'+(winner?.name||'alguien misterioso')+'! es el campe&#243;n. El palenque se cierra pero las risas se quedan. &#161;Felicidades a los ganadores y gracias a todos por aguantar la carrilla!';
    } else {
      customPodiumScript='&#161;La fiesta lleg&#243; a su fin! Con '+(winner?.score||0)+' puntos, coronamos a &#161;'+(winner?.name||'alguien misterioso')+'! como el rey, abucheamos al gallo y nos divertimos como locos. &#161;Nos vemos en la pr&#243;xima ronda de R&#237;tmika! &#161;Adi&#243;s!';
    }
    axoloSay(fVictoryChoice.text,fVictoryChoice.file);
    axoloSay(customPodiumScript,pClimaxChoice.file);
    ['&#127881;','&#127882;','&#127942;','&#11088;','&#128293;','&#127925;','&#128171;','&#127775;'].forEach((e,i)=>
      setTimeout(()=>floatEmoji(e),i*150)
    );
  }

  runCeremony();
}

