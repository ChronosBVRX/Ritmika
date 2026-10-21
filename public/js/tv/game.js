// ═══ LÓGICA DE JUEGO ═══
// Módulo extraído de tv.html
// ==============================================

// ════════════════════════════════════════════
//  ROULETTE
// ════════════════════════════════════════════
let rouletteAngle = 0;
let rouletteUprightNodes = [];

function applyRouletteUprightRotation(deg) {
  if (!rouletteUprightNodes.length) return;
  const rot = -deg;
  rouletteUprightNodes.forEach(({ el, x, y, base }) => {
    el.setAttribute('transform', `rotate(${base + rot},${x},${y})`);
  });
}
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

function rouletteDisplayName(name) {
  return String(name || '').replace(/\s*\(bot\)$/i, '').trim();
}

// ════════════════════════════════════════════
//  RETO DE LA CANCIÓN
// ════════════════════════════════════════════
let challengeDeck = [];

function drawChallenge() {
  if (!challengeDeck.length) {
    challengeDeck = RETO_CHALLENGES
      .map((text, id) => ({ id, text }))
      .sort(() => Math.random() - 0.5);
  }
  return challengeDeck.pop() || { id: 0, text: RETO_CHALLENGES[0] };
}

function ensureChallengeHud() {
  let hud = document.getElementById('active-challenge-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'active-challenge-hud';
    hud.className = 'hidden';
    hud.innerHTML = '<span class="rfx-ach-icon">🎭</span><span class="rfx-ach-label">RETO</span><span id="active-challenge-hud-text"></span>';
    const screen = document.getElementById('karaoke-video-wrap') || document.getElementById('karaoke-screen');
    if (screen) screen.appendChild(hud);
  }
  return hud;
}

function showChallengeHud(text) {
  const hud = ensureChallengeHud();
  const textEl = document.getElementById('active-challenge-hud-text');
  if (textEl) textEl.textContent = text || '';
  if (hud) hud.classList.remove('hidden');
}

function hideChallengeHud() {
  const hud = document.getElementById('active-challenge-hud');
  if (hud) hud.classList.add('hidden');
}

function resetSongChallenge() {
  state.currentChallenge = null;
  state.challengeVotes = [];
  state.challengeVotedBy = new Set();
  hideChallengeHud();
  const banner = document.getElementById('challenge-banner');
  if (banner) {
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(60px)';
    banner.classList.remove('is-live');
  }
}

async function startRoulette(skipIntro = false) {
  showScreen('roulette-screen', 'flash');
  if (typeof updateTicker === 'function') {
    updateTicker(state.round === 2 ? '🔥 Fuego cruzado: asignen canciones a sus rivales…' : '🎰 La ruleta decide quién canta…');
  }

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

  FlowDirector.enter('roulette_wait', {
    action: 'spin',
    run: () => spinRoulette(),
    label: state.round === 2 ? 'Asignación de canciones' : 'Ruleta',
  });

  // Otherwise, build wheel for all remaining
  buildRouletteWheel(remaining);
  // Hide spin button during Ronda 2 assignment phase — show only after all assign
  if (state.round === 2) {
    document.getElementById('spin-btn').style.display = 'none';
  } else {
    document.getElementById('spin-btn').style.display = 'block';
  }

  if (!skipIntro) {
    // Una sola presentación por entrada a la ruleta. Antes se encolaban la
    // intro genérica y la de Ronda 2, alargando la espera sin necesidad.
    const introChoice = state.round === 2
      ? { text: '¡Fuego cruzado activado! Asignen canciones a sus rivales 🔥', file: `round_2_start_${Math.floor(Math.random() * 2)}.mp3` }
      : ROULETTE_INTROS[Math.floor(Math.random() * ROULETTE_INTROS.length)];
    axoloSay(introChoice.text, introChoice.file);
  }

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
          if (state.round === 2 && !isSpinning && FlowDirector.getPhase() === 'roulette_wait' && lobbyScreen && lobbyScreen.classList.contains('active') && !state.assignedBy.has(p.socketId)) {
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
              if (rouletteAutoSpinTimeout) { clearTimeout(rouletteAutoSpinTimeout); rouletteAutoSpinTimeout = null; }
              document.getElementById('spin-btn').style.display = 'block';
              document.getElementById('roulette-heading').textContent = '¡Todas las asignaciones recibidas!';
              FlowDirector.hasten(0, 1200);
            }
          }
        }, botDelay);
      }
    });
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
      <span>${escapeHtml(rouletteDisplayName(p.name))}</span>
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

  // La ruleta avanza sola. El director espera a que Axolo termine de hablar
  // antes de girar; en Ronda 2 da 30s para que todos asignen.
  if (rouletteAutoSpinTimeout) clearTimeout(rouletteAutoSpinTimeout);
  rouletteAutoSpinTimeout = null;
  const autoSpinDelay = state.round === 2 ? 30000 : 4000;
  if (state.round === 2) {
    rouletteAutoSpinTimeout = setTimeout(() => {
      document.getElementById('spin-btn').style.display = 'block';
      document.getElementById('roulette-heading').textContent = '¡Tiempo agotado!';
      rouletteAutoSpinTimeout = null;
    }, autoSpinDelay);
  }
  FlowDirector.armAuto({ minMs: autoSpinDelay, holdMs: 1000 });
}


function buildRouletteWheel(playersToDraw) {
  const wheel = document.getElementById('roulette-wheel');
  wheel.innerHTML = '';
  rouletteUprightNodes = [];
  const players   = playersToDraw || state.players;
  const n         = players.length;
  if (n === 0) return;

  const cx = 250, cy = 250, r = 228;
  const SLICE_COLORS = (state.gameMode === 'emo')
    ? ['#831843','#450a0a','#1e1b4b','#0f172a','#312e81','#000000','#581c87','#7f1d1d']
    : ['#ec4899','#22d3ee','#a855f7','#facc15','#f97316','#22c55e','#3b82f6','#06b6d4'];

  const NS = 'http://www.w3.org/2000/svg';
  const mix = (hex, target, amount) => {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(target.slice(1), 16);
    const ch = (shift) => {
      const av = (a >> shift) & 255;
      const bv = (b >> shift) & 255;
      return Math.round(av + (bv - av) * amount);
    };
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  };

  const defs = document.createElementNS(NS, 'defs');
  const glossGrad = document.createElementNS(NS, 'radialGradient');
  glossGrad.setAttribute('id', 'rfx-wheel-gloss');
  glossGrad.setAttribute('cx', '42%');
  glossGrad.setAttribute('cy', '18%');
  glossGrad.setAttribute('r', '62%');
  const glossStopA = document.createElementNS(NS, 'stop');
  glossStopA.setAttribute('offset', '0%');
  glossStopA.setAttribute('stop-color', '#ffffff');
  glossStopA.setAttribute('stop-opacity', '0.34');
  const glossStopB = document.createElementNS(NS, 'stop');
  glossStopB.setAttribute('offset', '55%');
  glossStopB.setAttribute('stop-color', '#ffffff');
  glossStopB.setAttribute('stop-opacity', '0.04');
  const glossStopC = document.createElementNS(NS, 'stop');
  glossStopC.setAttribute('offset', '100%');
  glossStopC.setAttribute('stop-color', '#000000');
  glossStopC.setAttribute('stop-opacity', '0.22');
  glossGrad.append(glossStopA, glossStopB, glossStopC);
  defs.appendChild(glossGrad);

  SLICE_COLORS.forEach((color, i) => {
    const grad = document.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id', `rfx-slice-${i}`);
    grad.setAttribute('x1', '0');
    grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0.25');
    grad.setAttribute('y2', '1');
    const s1 = document.createElementNS(NS, 'stop');
    s1.setAttribute('offset', '0%');
    s1.setAttribute('stop-color', mix(color, '#ffffff', 0.28));
    const s2 = document.createElementNS(NS, 'stop');
    s2.setAttribute('offset', '52%');
    s2.setAttribute('stop-color', color);
    const s3 = document.createElementNS(NS, 'stop');
    s3.setAttribute('offset', '100%');
    s3.setAttribute('stop-color', mix(color, '#000000', 0.38));
    grad.append(s1, s2, s3);
    defs.appendChild(grad);
  });
  wheel.appendChild(defs);

  if (n === 1) {
    const p = players[0];
    const av = getAvatar(p.avatarId);
    
    // Draw a single circle filling the roulette area
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', 'url(#rfx-slice-0)');
    circle.setAttribute('stroke', '#111827');
    circle.setAttribute('stroke-width', '4');
    circle.setAttribute('class', 'roulette-slice');
    circle.setAttribute('data-player', p.socketId);
    wheel.appendChild(circle);

    // Gloss over the disc
    const glossSingle = document.createElementNS(NS, 'circle');
    glossSingle.setAttribute('cx', cx);
    glossSingle.setAttribute('cy', cy);
    glossSingle.setAttribute('r', r);
    glossSingle.setAttribute('fill', 'url(#rfx-wheel-gloss)');
    glossSingle.setAttribute('pointer-events', 'none');
    wheel.appendChild(glossSingle);

    // Position label coordinates (in upper area so it rotates nicely when spun)
    const lx = cx;
    const ly = cy - 95;

    const halo = document.createElementNS(NS, 'circle');
    halo.setAttribute('cx', lx);
    halo.setAttribute('cy', ly - 12);
    halo.setAttribute('r', 52);
    halo.setAttribute('fill', 'rgba(2,6,23,0.55)');
    halo.setAttribute('stroke', 'rgba(255,255,255,0.5)');
    halo.setAttribute('stroke-width', '2');
    wheel.appendChild(halo);
    
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
    nameText.textContent = rouletteDisplayName(p.name).slice(0, 12);
    wheel.appendChild(nameText);
    rouletteUprightNodes.push({ el: avatarImg, x: lx, y: ly, base: 0 });
    rouletteUprightNodes.push({ el: nameText, x: lx, y: ly, base: 0 });
    applyRouletteUprightRotation(rouletteAngle);
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
    path.setAttribute('fill', `url(#rfx-slice-${i % SLICE_COLORS.length})`);
    path.setAttribute('stroke', '#0b1020');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('class', 'roulette-slice');
    path.setAttribute('data-player', p.socketId);
    path.style.opacity = '1';
    wheel.appendChild(path);

    // Label coordinates
    const midA = startA + sliceAngle / 2;
    const lx = cx + (r * 0.62) * Math.cos(midA);
    const ly = cy + (r * 0.62) * Math.sin(midA);
    const deg = (midA * 180 / Math.PI) + 90;

    const av = getAvatar(p.avatarId);
    const imgSize = n > 6 ? 46 : 70;

    // Avatar halo
    const halo = document.createElementNS(NS, 'circle');
    halo.setAttribute('cx', lx);
    halo.setAttribute('cy', ly - 10);
    halo.setAttribute('r', imgSize / 2 + 5);
    halo.setAttribute('fill', 'rgba(2,6,23,0.55)');
    halo.setAttribute('stroke', 'rgba(255,255,255,0.45)');
    halo.setAttribute('stroke-width', '1.5');
    wheel.appendChild(halo);
    
    // Avatar Image (using local transparent PNG)
    const avatarImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    avatarImg.setAttribute('href', av.img);
    avatarImg.setAttribute('x', lx - imgSize / 2);
    avatarImg.setAttribute('y', ly - imgSize / 2 - 12);
    avatarImg.setAttribute('width', imgSize);
    avatarImg.setAttribute('height', imgSize);
    wheel.appendChild(avatarImg);
    rouletteUprightNodes.push({ el: avatarImg, x: lx, y: ly, base: 0 });

    // Name text (kept horizontal so every slice reads upright)
    const nameText = document.createElementNS('http://www.w3.org/2000/svg','text');
    nameText.setAttribute('x', lx);
    nameText.setAttribute('y', ly + imgSize / 2 + 9);
    nameText.setAttribute('text-anchor','middle');
    nameText.setAttribute('dominant-baseline','middle');
    nameText.setAttribute('font-size', n > 6 ? '11' : '14');
    nameText.setAttribute('font-weight','900');
    nameText.setAttribute('fill','white');
    nameText.setAttribute('stroke','#111827');
    nameText.setAttribute('stroke-width','4');
    nameText.setAttribute('paint-order','stroke fill');
    nameText.textContent = rouletteDisplayName(p.name).slice(0, 12);
    wheel.appendChild(nameText);
    rouletteUprightNodes.push({ el: nameText, x: lx, y: ly, base: 0 });
  });

  applyRouletteUprightRotation(rouletteAngle);

  // Glassy highlight across the top of the wheel.
  const gloss = document.createElementNS(NS, 'circle');
  gloss.setAttribute('cx', cx);
  gloss.setAttribute('cy', cy);
  gloss.setAttribute('r', r);
  gloss.setAttribute('fill', 'url(#rfx-wheel-gloss)');
  gloss.setAttribute('pointer-events', 'none');
  wheel.appendChild(gloss);
}


document.getElementById('spin-btn').addEventListener('click', () => {
  UISounds.click();
  if (!FlowDirector.request('spin')) {
    updateTicker('La ruleta girará sola en un momento…');
  }
});

function spinRoulette() {
  if (isSpinning) return;
  FlowDirector.enter('roulette_spin', { label: 'Girando la ruleta' });
  sting('sting_roulette_spin', 0.42);
  isSpinning = true;
  if (state.round === 2) state.assignedBy = new Set();
  if (rouletteAutoSpinTimeout) { clearTimeout(rouletteAutoSpinTimeout); rouletteAutoSpinTimeout = null; }
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
      applyRouletteUprightRotation(currentRot);
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
      applyRouletteUprightRotation(rouletteAngle);
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
  const spinButton = document.getElementById('spin-btn');
  if (spinButton) {
    spinButton.blur();
    spinButton.style.display = 'none';
  }
  state.votes = [];
  const assignment = state.assignedSongs[player.socketId] || null;
  const song = await pickSongForPlayer(player);
  state.currentAssignment = assignment;
  state.currentSong = song;

  // Resolve video URL — siempre presignada desde R2. La URL pública
  // (media.pixelhub.party) ya no resuelve, así que no sirve como atajo.
  if (song && song.id) {
    fetch('/api/video-url?id=' + encodeURIComponent(song.id))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data && data.url && state.currentSong && state.currentSong.id === song.id) {
          state.currentSong._resolvedUrl = data.url;
        }
      })
      .catch(() => {
        if (song.url) state.currentSong._resolvedUrl = song.url;
      });
  }

  document.getElementById('selected-player-avatar-img').src = getAvatar(player.avatarId).img;
  document.getElementById('selected-player-name').textContent = rouletteDisplayName(player.name);
  const rouletteHeading = document.getElementById('roulette-heading');
  if (rouletteHeading) rouletteHeading.textContent = '¡El destino habló!';
  const assignedSuffix = assignment && assignment.attackerName
    ? ` · Asignada por ${assignment.attackerName}`
    : '';
  document.getElementById('selected-song-info').textContent = song
    ? `Canción: "${song.title}" — ${song.artist}${assignedSuffix}`
    : '🎲 Canción aleatoria de la noche';

  // Highlight winner chip
  document.querySelectorAll('.roulette-player-chip').forEach(c => c.classList.remove('is-winner'));
  const winnerChip = document.getElementById(`rchip-${player.socketId}`);
  if (winnerChip) {
    winnerChip.classList.add('is-winner');
  }

  document.querySelectorAll('#roulette-wheel .roulette-slice').forEach(slice => slice.classList.remove('is-winner'));
  const winningSlice = document.querySelector(`#roulette-wheel .roulette-slice[data-player="${player.socketId}"]`);
  if (winningSlice) winningSlice.classList.add('is-winner');

  const banner = document.getElementById('selected-player-banner');
  anime({
    targets: banner,
    opacity: [0, 1], scale: [0.8, 1],
    duration: 600, easing: 'easeOutBack',
  });

  const winMsgText = `¡${rouletteDisplayName(player.name)} le toca cantar! ${state.currentSong ? `La canción es "${state.currentSong.title}"` : '¡La suerte eligió!'} ¡Que el palenque decida su destino! 🎤`;
  const winChoice = ROULETTE_WINS[Math.floor(Math.random() * ROULETTE_WINS.length)];
  axoloSay(winMsgText, winChoice.file);

  // Notify phones: singer was selected
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'SINGER_SELECTED',
    data: {
      socketId: player.socketId,
      name: player.name,
      song: state.currentSong,
      assignedBy: assignment ? assignment.attackerName : null,
    },
  });
  // Private message to singer
  socket.emit('tv:send_to_player', {
    targetSocketId: player.socketId,
    event: 'YOUR_TURN',
    data: {},
  });

  // La canción arranca sola cuando Axolo termina de anunciar al cantante.
  // El cantante puede adelantar con "¡Estoy listo!" desde su celular.
  FlowDirector.enter('singer_result', {
    action: 'start_song',
    run: () => startKaraoke(player, state.currentSong),
    singerSocketId: player.socketId,
    label: 'Turno de ' + player.name,
  });
  if (rouletteResultTimeout) { clearTimeout(rouletteResultTimeout); rouletteResultTimeout = null; }
  FlowDirector.armAuto({ minMs: 4500, holdMs: 1200 });
}

document.getElementById('go-karaoke-btn').addEventListener('click', () => {
  UISounds.click();
  if (!FlowDirector.request('start_song')) {
    updateTicker('La canción empezará cuando termine la presentación…');
  }
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
let crowdAmbience = null;
const SFX_VOLUME = 0.35;
const SFX_DUCKED = 0.10;
function playSfx(url, vol) {
  const a = new Audio(url);
  const voiceActive = (window.AxoloNarrator && typeof window.AxoloNarrator.isBusy === 'function')
    ? window.AxoloNarrator.isBusy()
    : !!currentAxoloAudio;
  a.volume = vol ?? (voiceActive ? SFX_DUCKED : SFX_VOLUME);
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
function stopAllSfx(fadeMs = 0) {
  const toStop = activeSfx.splice(0);
  toStop.forEach(a => {
    if (!fadeMs) {
      try { a.pause(); a.src = ''; } catch (e) {}
      return;
    }
    try {
      const startVol = a.volume;
      const started = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - started) / fadeMs);
        try { a.volume = Math.max(0, startVol * (1 - t)); } catch (e) {}
        if (t < 1) {
          setTimeout(step, 40);
        } else {
          try { a.pause(); a.src = ''; } catch (e) {}
        }
      };
      step();
    } catch (e) {}
  });
}
// Loop de ambiente (público). Se registra en activeSfx para que duck/unduck y
// stopAllSfx lo manejen junto con el resto de la capa sonora.
function playLoop(url, vol) {
  const a = new Audio(url);
  a.loop = true;
  a.volume = vol ?? 0.18;
  activeSfx.push(a);
  a.play().catch(()=>{});
  return a;
}
// Sting musical corto (entradas de ronda, podio, ganador...)
function sting(name, vol) {
  return playSfx('./assets/audio/' + name + '.mp3', vol ?? 0.5);
}

// ════════════════════════════════════════════
//  KARAOKE PREMIUM STAGE
//  El video ya no ocupa la pantalla completa: va dentro de una "ventana" con
//  marco, y alrededor se pinta un escenario. Así un MP4 4:3 de karaoke viejo
//  con marca de agua deja de verse como un video crudo y pasa a verse como
//  parte del show.
// ════════════════════════════════════════════
const KS_WIN = { x: 200, y: 112, w: 1520, h: 855 };
const KS_DESIGN = { w: 1920, h: 1080 };
let ksVideoPoll = null;
let lastKsVideo = '';

function ksFit(vw, vh) {
  if (!vw || !vh) return { x: KS_WIN.x, y: KS_WIN.y, w: KS_WIN.w, h: KS_WIN.h };
  const s = Math.min(KS_WIN.w / vw, KS_WIN.h / vh);
  const w = Math.round(vw * s), h = Math.round(vh * s);
  return {
    x: Math.round(KS_WIN.x + (KS_WIN.w - w) / 2),
    y: Math.round(KS_WIN.y + (KS_WIN.h - h) / 2),
    w, h,
  };
}

function ksEnsureStage() {
  if (document.getElementById('ks-bg')) return;
  const st = document.createElement('style');
  st.id = 'ks-css';
  st.textContent = [
    '#ks-bg,#ks-fg{position:absolute;left:0;top:0;width:1920px;height:1080px;pointer-events:none;}',
    '#ks-bg{z-index:0;}',
    '#ks-fg{z-index:2;}',
    '#karaoke-video-wrap{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:top left;overflow:hidden;}',
    '.ks-region{position:absolute;background-image:url("./assets/karaoke_stage_bg.webp?v=1");background-size:1920px 1080px;background-repeat:no-repeat;}',
    '#ks-frame{position:absolute;border:6px solid #111827;box-shadow:inset 0 0 0 2px rgba(255,230,0,.22),0 0 40px rgba(0,229,255,.16);}',
    '#ks-vig{position:absolute;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 52%,rgba(0,0,0,.62) 100%);}',
    '.ks-bracket{position:absolute;width:46px;height:46px;border:5px solid #ffe600;filter:drop-shadow(2px 2px 0 #111827);}',
    '.ks-live{position:absolute;display:flex;align-items:center;gap:9px;background:rgba(17,24,39,.94);border:3px solid #111827;box-shadow:5px 5px 0 #111827;padding:7px 15px;font-family:"Paytone One",sans-serif;font-size:15px;letter-spacing:2px;color:#f8fafc;}',
    '.ks-live i{width:11px;height:11px;border-radius:50%;background:#ef4444;box-shadow:0 0 10px #ef4444;animation:ks-pulse 1.1s ease-in-out infinite;}',
    '@keyframes ks-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.78)}}',
    '.ks-sweep{position:absolute;top:0;bottom:0;width:38%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.32),transparent);transform:skewX(-14deg);filter:blur(7px);}',
    '#karaoke-screen #karaoke-video{left:' + KS_WIN.x + 'px !important;top:' + KS_WIN.y + 'px !important;right:auto !important;bottom:auto !important;width:' + KS_WIN.w + 'px !important;height:' + KS_WIN.h + 'px !important;background:transparent !important;}',
    '#karaoke-screen #audio-only-placeholder{inset:' + KS_WIN.y + 'px ' + (KS_DESIGN.w - KS_WIN.x - KS_WIN.w) + 'px ' + (KS_DESIGN.h - KS_WIN.y - KS_WIN.h) + 'px ' + KS_WIN.x + 'px !important;}',
    '#karaoke-screen #lyrics-overlay{position:absolute !important;left:' + (KS_WIN.x + 36) + 'px !important;top:' + (KS_WIN.y + KS_WIN.h - 118) + 'px !important;bottom:auto !important;transform:none !important;z-index:4 !important;}',
    '#now-playing-card{background:rgba(17,24,39,.94) !important;border:4px solid #111827 !important;box-shadow:7px 7px 0 #111827 !important;border-radius:0 !important;padding:12px 20px !important;}',
    '#lyrics-text{font-family:"Paytone One",sans-serif !important;font-size:22px !important;}',
    '#np-artist{font-size:14px !important;letter-spacing:1px !important;}',
  ].join('\n');
  document.head.appendChild(st);

  const host = document.getElementById('karaoke-video-wrap') || document.getElementById('karaoke-screen') || document.body;
  const bg = document.createElement('div'); bg.id = 'ks-bg';
  const fg = document.createElement('div'); fg.id = 'ks-fg';
  host.insertBefore(bg, host.firstChild);
  host.appendChild(fg);

  ['ks-out-t', 'ks-out-b', 'ks-out-l', 'ks-out-r',
   'ks-bar-l', 'ks-bar-r', 'ks-bar-t', 'ks-bar-b'].forEach(id => {
    const d = document.createElement('div');
    d.className = 'ks-region';
    d.id = id;
    bg.appendChild(d);
  });

  if (!window.__ksResizeBound) {
    window.addEventListener('resize', ksApplyViewport);
    window.__ksResizeBound = true;
  }

  const frame = document.createElement('div'); frame.id = 'ks-frame'; fg.appendChild(frame);
  const vig = document.createElement('div'); vig.id = 'ks-vig'; fg.appendChild(vig);
  const live = document.createElement('div'); live.id = 'ks-live'; live.className = 'ks-live';
  live.innerHTML = '<i></i><span>EN VIVO</span>';
  fg.appendChild(live);

  [['tl', '#ffe600'], ['tr', '#00e5ff'], ['bl', '#00e5ff'], ['br', '#f0047f']].forEach(([pos, color]) => {
    const b = document.createElement('div');
    b.className = 'ks-bracket';
    b.dataset.pos = pos;
    b.style.borderColor = color;
    if (pos === 'tl') { b.style.borderRight = 'none'; b.style.borderBottom = 'none'; }
    if (pos === 'tr') { b.style.borderLeft = 'none'; b.style.borderBottom = 'none'; }
    if (pos === 'bl') { b.style.borderRight = 'none'; b.style.borderTop = 'none'; }
    if (pos === 'br') { b.style.borderLeft = 'none'; b.style.borderTop = 'none'; }
    fg.appendChild(b);
  });
}

function ksApplyViewport() {
  const wrap = document.getElementById('karaoke-video-wrap');
  if (!wrap) return;
  const scale = Math.min(window.innerWidth / KS_DESIGN.w, window.innerHeight / KS_DESIGN.h);
  const ox = Math.round((window.innerWidth - KS_DESIGN.w * scale) / 2);
  const oy = Math.round((window.innerHeight - KS_DESIGN.h * scale) / 2);
  wrap.style.position = 'absolute';
  wrap.style.left = '0';
  wrap.style.top = '0';
  wrap.style.width = KS_DESIGN.w + 'px';
  wrap.style.height = KS_DESIGN.h + 'px';
  wrap.style.transformOrigin = 'top left';
  wrap.style.transform = `translate(${ox}px,${oy}px) scale(${scale})`;
}

function ksLayout(vw, vh) {
  ksApplyViewport();
  const r = ksFit(vw, vh);
  const place = (id, x, y, w, h) => {
    const d = document.getElementById(id);
    if (!d) return;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.width = Math.max(0, w) + 'px';
    d.style.height = Math.max(0, h) + 'px';
    d.style.backgroundPosition = '-' + x + 'px -' + y + 'px';
  };
  const winB = KS_WIN.y + KS_WIN.h, winR = KS_WIN.x + KS_WIN.w;
  place('ks-out-t', 0, 0, KS_DESIGN.w, KS_WIN.y);
  place('ks-out-b', 0, winB, KS_DESIGN.w, KS_DESIGN.h - winB);
  place('ks-out-l', 0, KS_WIN.y, KS_WIN.x, KS_WIN.h);
  place('ks-out-r', winR, KS_WIN.y, KS_DESIGN.w - winR, KS_WIN.h);
  place('ks-bar-l', KS_WIN.x, r.y, r.x - KS_WIN.x, r.h);
  place('ks-bar-r', r.x + r.w, r.y, winR - (r.x + r.w), r.h);
  place('ks-bar-t', r.x, KS_WIN.y, r.w, r.y - KS_WIN.y);
  place('ks-bar-b', r.x, r.y + r.h, r.w, winB - (r.y + r.h));

  const frame = document.getElementById('ks-frame');
  if (frame) Object.assign(frame.style, { left: KS_WIN.x + 'px', top: KS_WIN.y + 'px', width: KS_WIN.w + 'px', height: KS_WIN.h + 'px' });
  const vig = document.getElementById('ks-vig');
  if (vig) Object.assign(vig.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  const live = document.getElementById('ks-live');
  if (live) Object.assign(live.style, { left: (winR - 205) + 'px', top: (KS_WIN.y + 20) + 'px' });
  document.querySelectorAll('.ks-bracket').forEach(b => {
    const pos = b.dataset.pos;
    const top = (pos === 'tl' || pos === 'tr') ? KS_WIN.y : winB;
    const left = (pos === 'tl' || pos === 'bl') ? KS_WIN.x : winR;
    b.style.left = (pos === 'tl' || pos === 'bl' ? left - 8 : left - 38) + 'px';
    b.style.top = (pos === 'tl' || pos === 'tr' ? top - 8 : top - 38) + 'px';
  });
}

function karaokeStageInfo(song, player) {
  const card = document.getElementById('now-playing-card');
  if (!card) return;
  let av = document.getElementById('np-avatar');
  if (!av) {
    av = document.createElement('img');
    av.id = 'np-avatar';
    av.style.cssText = 'width:44px;height:44px;object-fit:contain;border:3px solid #111827;background:#0f172a;flex-shrink:0;';
    card.insertBefore(av, card.firstChild);
  }
  if (player) {
    const a = getAvatar(player.avatarId);
    av.src = a.img;
    av.style.background = a.color;
  }
}

function karaokeStageEnter() {
  const fg = document.getElementById('ks-fg');
  const bg = document.getElementById('ks-bg');
  if (!fg || !bg) return;
  anime({ targets: [fg, bg], opacity: [0, 1], duration: 380, easing: 'easeOutQuad' });
  const sweep = document.createElement('div');
  sweep.className = 'ks-sweep';
  sweep.style.left = '-40%';
  fg.appendChild(sweep);
  anime({
    targets: sweep,
    translateX: ['0%', '420%'],
    opacity: [0, 0.6, 0],
    duration: 640,
    easing: 'easeInOutQuad',
    complete: () => { if (sweep.parentNode) sweep.parentNode.removeChild(sweep); },
  });
}

function isQuickSongsMode() {
  try {
    if (window.MainMenu && typeof MainMenu.isQuickSongs === 'function') return MainMenu.isQuickSongs();
  } catch (e) {}
  try { return localStorage.getItem('ritmika_quick_songs') === '1'; } catch (e) { return false; }
}

async function startKaraoke(player, song) {
  if (document.getElementById('karaoke-screen').classList.contains('active')) return;
  karaokeGeneration++;
  songEnded = false;
  currentSongPerformer = player;
  const myGeneration = karaokeGeneration;
  showScreen('karaoke-screen', 'flash');

  FlowDirector.enter('karaoke_intro', {
    singerSocketId: player.socketId,
    label: 'Preparando a ' + player.name,
  });

  // Marco premium: escenario + ventana del video + lower-third + wipe
  ksEnsureStage();
  ksLayout(0, 0);
  karaokeStageInfo(song, player);
  karaokeStageEnter();
  if (ksVideoPoll) clearInterval(ksVideoPoll);
  lastKsVideo = '';
  ksVideoPoll = setInterval(() => {
    if (myGeneration !== karaokeGeneration) { clearInterval(ksVideoPoll); ksVideoPoll = null; return; }
    const v = document.getElementById('karaoke-video');
    if (!v) return;
    const key = v.videoWidth + 'x' + v.videoHeight;
    if (key !== lastKsVideo) {
      lastKsVideo = key;
      ksLayout(v.videoWidth, v.videoHeight);
    }
  }, 400);

  // Resolve video URL if not already done (presignada desde R2)
  if (song && song.id && !song._resolvedUrl) {
    fetch('/api/video-url?id=' + encodeURIComponent(song.id))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (data && data.url) song._resolvedUrl = data.url; })
      .catch(() => {});
  }

  state.votedBy = new Set();
  const quickSongs = isQuickSongsMode();
  state.songLimitSeconds = quickSongs ? 90 : null;
  state.songStartOffset = quickSongs
    ? Math.min(15, Math.max(0, (song && song.duration ? song.duration : 0) * 0.05))
    : 0;

  const av = getAvatar(player.avatarId);
  document.getElementById('hud-singer-avatar-img').src = av.img;
  document.getElementById('hud-singer-name').textContent = player.name;
  document.getElementById('hud-round-label').textContent = 'Ronda ' + state.round;

  challengeFired = false;
  blackoutFired = false;
  document.body.classList.remove('scoreboard-open');
  resetSongChallenge();
  state.tomatazoCounts = {};
  document.getElementById('blackout-banner').style.transform = 'scale(0)';
  document.getElementById('scoreboard-overlay').classList.remove('visible');
  if (state.roomCode) {
    socket.emit('tv:broadcast', { roomCode: state.roomCode, event: 'CHALLENGE_CLEAR', data: {} });
  }
  const aph = document.getElementById('audio-only-placeholder');
  if (aph) aph.classList.remove('visible');

  // Video — recreate element and YIELD to compositor to fix black screen bug in WebView2
  const oldVideo = document.getElementById('karaoke-video');
  const video = document.createElement('video');
  video.id = 'karaoke-video';
  video.playsinline = true;
  video.preload = 'auto';
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

  // Dejar el video precargado, pero PAUSADO. Antes se reproducía en silencio
  // mientras Axolo hablaba y el cantante perdía el inicio de la canción.
  if (song && videoUrl) {
    document.getElementById('lyrics-text').textContent = song.title;
    document.getElementById('np-artist').textContent = song.artist;
    video.muted = true;
    video.src = videoUrl;
    const seekToStart = () => {
      if (state.songStartOffset > 0 && isFinite(video.duration) && video.duration > 0) {
        try { video.currentTime = Math.min(state.songStartOffset, Math.max(0, video.duration - 1)); } catch (e) {}
      }
    };
    try { video.load(); } catch (e) {}
    if (video.readyState >= 1) seekToStart();
    else video.addEventListener('loadedmetadata', seekToStart, { once: true });
    if (typeof bootMusic !== 'undefined' && bootMusic) bootMusic.pause();
  } else {
    document.getElementById('lyrics-text').textContent = '¡Canta lo que quieras!';
    document.getElementById('np-artist').textContent = '🎤';
  }

  // Los celulares preparan la pantalla, pero la canción aún no empieza.
  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'KARAOKE_PREP',
    data: { socketId: player.socketId, name: player.name, song: song },
  });

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  let karaokeStarted = false;
  let playbackWatchdog = null;

  function scheduleBotVotes() {
    state.players.forEach(p => {
      if (!p.socketId.startsWith('bot_') || p.socketId === player.socketId) return;
      const botDelay = 4000 + Math.random() * 8000; // 4 - 12 segundos de canción
      setTimeout(() => {
        const karaokeScreen = document.getElementById('karaoke-screen');
        if (!karaokeScreen || !karaokeScreen.classList.contains('active')) return;
        if (myGeneration !== karaokeGeneration) return;
        if (state.votedBy.has(p.socketId)) return;
        const scores = [30, 60, 100];
        const botScore = scores[Math.floor(Math.random() * scores.length)];
        state.votes.push({ voterName: p.name, voterSocketId: p.socketId, performerSocketId: player.socketId, score: botScore });
        updateTicker(`${p.name} votó: ${botScore} pts 🗳️`);
        state.votedBy.add(p.socketId);
        checkAllVotesSubmitted(player.socketId);
      }, botDelay);
    });
  }

  function markKaraokeStarted() {
    if (karaokeStarted || myGeneration !== karaokeGeneration) return;
    karaokeStarted = true;
    if (playbackWatchdog) { clearTimeout(playbackWatchdog); playbackWatchdog = null; }
    FlowDirector.enter('karaoke', {
      singerSocketId: player.socketId,
      label: 'En vivo: ' + player.name,
    });
    socket.emit('tv:broadcast', {
      roomCode: state.roomCode,
      event: 'KARAOKE_START',
      data: { socketId: player.socketId, name: player.name, song: song },
    });
    scheduleBotVotes();
  }

  const proceedWithKaraoke = () => {
    // Watchdog fuera de requestAnimationFrame: si la TV está minimizada o el
    // compositor no dispara `playing`, la partida no se queda congelada.
    playbackWatchdog = setTimeout(() => {
      if (myGeneration !== karaokeGeneration || karaokeStarted) return;
      console.warn('[Karaoke] Video sin evento playing; arrancando respaldo.');
      if (!timerInterval) startKaraokeTimer(null, song);
      markKaraokeStarted();
    }, 8000);

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
          markKaraokeStarted();
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
          if (!timerInterval) startKaraokeTimer(null, song);
          markKaraokeStarted();
        };

        video.onended = () => {
          if (myGeneration !== karaokeGeneration) return;
          startVotePhase(player, song);
        };

        // Ambiente de público: empieza junto con la canción, no durante la presentación.
        if (crowdAmbience) { try { crowdAmbience.pause(); } catch (e) {} }
        crowdAmbience = playLoop('./assets/audio/loop_crowd_karaoke.mp3', 0.16);

        if (videoUrl) {
          video.muted = false;
          video.play().catch(e => {
            console.warn("Autoplay block or explicit play failed:", e);
            // Reintento silencioso y unmute inmediato: el audio no se solapa con Axolo.
            video.muted = true;
            video.play().then(() => {
              setTimeout(() => {
                if (myGeneration === karaokeGeneration) video.muted = false;
              }, 250);
            }).catch(() => {
              if (!timerInterval) startKaraokeTimer(null, song);
              markKaraokeStarted();
            });
          });
        } else {
          startKaraokeTimer(null, song || { duration: 120 });
          markKaraokeStarted();
        }
      });
    });
  };

  // ── Presentación de Axolo (una sola voz, sin solapar con el video) ──
  let introDone = Promise.resolve();
  if (state.gameMode === 'emo' && (state.round === 1 || state.round === 2)) {
    const isDiary = state.round === 1;
    const overlay = document.getElementById(isDiary ? 'emo-diary-overlay' : 'emo-dedication-overlay');
    const textEl = document.getElementById(isDiary ? 'emo-diary-text' : 'emo-dedication-text');
    if (overlay && textEl) {
      const selected = (isDiary ? EMO_DIARY_LINES : EMO_DEDICATIONS)[
        Math.floor(Math.random() * (isDiary ? EMO_DIARY_LINES : EMO_DEDICATIONS).length)
      ];
      const lineText = selected.text || selected;
      const file = selected.file || null;
      textEl.textContent = `"${lineText}"`;
      overlay.style.display = 'flex';
      if (file && typeof axoloSay === 'function') {
        axoloSay(lineText, file, 5000, true);
      }
      introDone = Promise.all([
        new Promise(resolve => setTimeout(resolve, 5000)),
        FlowDirector.whenVoiceIdle(20000),
      ]).then(() => {
        overlay.style.display = 'none';
      });
    }
  } else {
    const choice = AXOLO_SINGER_INTROS[Math.floor(Math.random() * AXOLO_SINGER_INTROS.length)];
    axoloSay(choice.text, choice.file);
    introDone = FlowDirector.whenVoiceIdle(20000);
  }

  await introDone;
  if (myGeneration !== karaokeGeneration) return;
  // Salvavidas: si un MP3 se quedó colgado, no solapamos voz con la canción.
  if (window.AxoloNarrator.isBusy()) {
    console.warn('[Karaoke] Introducción excedió la espera; liberando audio para no solapar.');
    _stopCurrentAxolo();
  }
  proceedWithKaraoke();
}

function scheduleBotChallengeVotes(player) {
  if (!state.currentChallenge) return;
  state.challengeVotedBy = state.challengeVotedBy || new Set();
  state.challengeVotes = state.challengeVotes || [];
  state.players.forEach(p => {
    if (!p.socketId.startsWith('bot_') || p.socketId === player.socketId) return;
    const delay = 900 + Math.random() * 2400;
    setTimeout(() => {
      if (!votePhaseActive || !state.currentChallenge) return;
      if (state.challengeVotedBy.has(p.socketId)) return;

      const singerVote = state.votes.find(v =>
        v.performerSocketId === player.socketId &&
        (v.voterSocketId === p.socketId || v.voterName === p.name)
      );
      const baseScore = singerVote ? singerVote.score : 60;
      const completed = baseScore >= 60 ? Math.random() < 0.85 : Math.random() < 0.3;

      state.challengeVotedBy.add(p.socketId);
      state.challengeVotes.push({
        voterName: p.name,
        voterSocketId: p.socketId,
        performerSocketId: player.socketId,
        completed,
      });

      const expected = state.players.filter(x => !x.disconnected && x.socketId !== player.socketId).length;
      socket.emit('tv:broadcast', {
        roomCode: state.roomCode,
        event: 'VOTE_COUNT',
        data: {
          count: state.votedBy ? state.votedBy.size : 0,
          total: expected,
          challengeCount: state.challengeVotedBy.size,
          challengeTotal: expected,
        },
      });
      checkAllVotesSubmitted(player.socketId);
    }, delay);
  });
}

async function startVotePhase(player, song) {

  if (songEnded) return;
  songEnded = true;
  votePhaseActive = true;

  clearInterval(timerInterval);
  timerInterval = null;
  if (blackoutTimeout) { clearTimeout(blackoutTimeout); blackoutTimeout = null; }

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
  stopAllSfx(450);

  FlowDirector.enter('vote_pending', {
    singerSocketId: player.socketId,
    label: 'Cerrando actuación',
  });

  // Si un reto o apagón estaba narrando, se deja terminar. Antes se cortaba
  // la voz a la mitad para abrir la votación.
  await FlowDirector.whenVoiceIdle(15000);
  if (!votePhaseActive) return;

  FlowDirector.enter('vote', {
    action: 'end_vote',
    run: () => { songEnded = false; endSong(player); },
    singerSocketId: player.socketId,
    label: 'Votación',
  });

  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'VOTE_PHASE_START',
    data: { performerSocketId: player.socketId, performerName: player.name },
  });

  let votePrompt;
  if (state.gameMode === 'emo' && typeof EMO_MODE_PHRASES !== 'undefined') {
    const phrases = EMO_MODE_PHRASES.vote;
    votePrompt = phrases[Math.floor(Math.random() * phrases.length)];
  } else {
    votePrompt = AXOLO_VOTE_PROMPTS[Math.floor(Math.random() * AXOLO_VOTE_PROMPTS.length)];
  }
  axoloSay(votePrompt.text, votePrompt.file);

  // La votación cierra sola. El mínimo cuenta desde que termina la voz de
  // Axolo, así el prompt nunca se corta.
  FlowDirector.armAuto({ minMs: VOTE_PHASE_DURATION, holdMs: 500 });
  scheduleBotChallengeVotes(player);
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
  const fallbackDuration = Math.floor(song?.duration || 120);
  const clipStart = Math.max(0, Number(state.songStartOffset) || 0);
  const clipLimit = state.songLimitSeconds ? Number(state.songLimitSeconds) : null;
  let wallElapsed = 0;
  let lastBroadcastSecond = -1;

  // El reloj se basa en video.currentTime, no en un contador de pared.
  // Si el video se bufferea o se pausa, la letra y los retos respetan el
  // tiempo real de la canción.
  timerInterval = setInterval(() => {
    wallElapsed += 0.5;
    let elapsed;
    let duration;
    const hasVideoClock = video && !video.error && isFinite(video.duration) && video.duration > 0;
    if (hasVideoClock) {
      elapsed = Math.max(0, (video.currentTime || 0) - clipStart);
      const videoRemaining = Math.max(0, video.duration - clipStart);
      duration = clipLimit ? Math.min(clipLimit, videoRemaining) : videoRemaining;
    } else {
      elapsed = wallElapsed;
      duration = clipLimit ? Math.min(clipLimit, fallbackDuration) : fallbackDuration;
    }

    const remaining = Math.max(0, Math.floor(duration - elapsed));
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    const timerEl = document.getElementById('hud-timer');
    if (timerEl) timerEl.textContent = `${mm}:${ss}`;

    const wholeElapsed = Math.floor(elapsed);
    if (wholeElapsed !== lastBroadcastSecond && (wholeElapsed % 3 === 0) && state.roomCode) {
      lastBroadcastSecond = wholeElapsed;
      socket.emit('tv:broadcast', {
        roomCode: state.roomCode,
        event: 'SONG_TIMER',
        data: { active: true, elapsed: wholeElapsed, duration },
      });
    }

    // Ronda 1: el reto entra en la primera mitad, nunca después de 1:15.
    const challengeAt = Math.min(75, Math.max(25, duration * 0.35));
    if (state.round === 1 && !challengeFired && elapsed >= challengeAt) {
      challengeFired = true;
      fireChallenge();
    }

    // Ronda 3: apagón con el mismo criterio, nunca después de 1:30.
    const blackoutAt = Math.min(90, Math.max(30, duration * 0.4));
    if (state.round === 3 && !blackoutFired && elapsed >= blackoutAt) {
      blackoutFired = true;
      if (state.gameMode === 'emo') {
        fireEmoRain();
      } else {
        fireBlackout();
      }
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (clipLimit && video) { try { video.pause(); } catch (e) {} }
      const fallbackSinger = currentSongPerformer || state.singerQueue[state.currentSingerIdx % state.singerQueue.length] || state.players.find(p => !p.disconnected);
      startVotePhase(fallbackSinger, song);
    }
  }, 500);
}

function fireChallenge() {
  const reto = drawChallenge();
  state.currentChallenge = { id: reto.id, text: reto.text, round: 1, startedAt: Date.now() };
  state.challengeVotes = [];
  state.challengeVotedBy = new Set();

  document.getElementById('challenge-text').textContent = reto.text;
  showChallengeHud(reto.text);

  const banner = document.getElementById('challenge-banner');
  anime({
    targets: banner,
    opacity: [0, 1],
    translateY: [60, 0],
    duration: 700,
    easing: 'easeOutBack',
  });

  // Sin voz encima de la canción: el reto se lee en TV y en los celulares.
  sting('sting_round_start', 0.32);

  if (state.roomCode) {
    socket.emit('tv:broadcast', {
      roomCode: state.roomCode,
      event: 'CHALLENGE_START',
      data: { id: reto.id, text: reto.text, round: 1 },
    });
  }
  updateTicker(`🎭 Reto activo: ${reto.text}`);

  setTimeout(() => {
    anime({ targets: banner, opacity: [1, 0], translateY: [0, 60], duration: 400, easing: 'easeInCubic' });
  }, 8000);
}

function fireEmoRain() {
  const selected = EMO_DRAMA_CHALLENGES[Math.floor(Math.random() * EMO_DRAMA_CHALLENGES.length)];
  const reto = selected.text || selected;
  const file = selected.file || null;
  const banner = document.getElementById('emo-rain-overlay');
  const challengeText = document.getElementById('emo-rain-challenge');
  
  if (!banner || !challengeText) {
    console.warn('[EMO] Rain overlay missing, continuing karaoke');
    return;
  }
  
  challengeText.textContent = `"${reto}"`;
  banner.style.display = 'flex';
  
  anime({
    targets: banner,
    opacity: [0, 1],
    duration: 1000,
    easing: 'easeOutQuad',
  });
  
  const video = document.getElementById('karaoke-video');
  const originalFilter = video.style.filter;
  video.style.filter = 'grayscale(80%) contrast(1.2) brightness(0.6)';

  // Sting corto: la voz de Axolo no debe tapar la canción ni la lluvia.
  sting('sting_blackout', 0.4);

  // Auto-hide after 12s
  setTimeout(() => {
    anime({ 
      targets: banner, 
      opacity: [1, 0], 
      duration: 1000, 
      easing: 'easeInCubic',
      complete: () => { banner.style.display = 'none'; }
    });
    video.style.filter = originalFilter;
  }, 12000);
}

function fireBlackout() {
  const video = document.getElementById('karaoke-video');
  const lyrics = document.getElementById('lyrics-text');
  const karaokeScreen = document.getElementById('karaoke-screen');

  sting('sting_blackout', 0.55);
  if (karaokeScreen) karaokeScreen.classList.add('rfx-blackout');

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

  const blackoutDuration = 5000 + Math.random() * 5000;
  blackoutTimeout = setTimeout(() => {
    blackoutTimeout = null;
    anime({ targets: '#blackout-banner', scale: [1, 0], duration: 400, easing: 'easeInCubic' });
    lyrics.classList.remove('blackout');
    document.getElementById('np-artist').classList.remove('blackout');
    if (karaokeScreen) karaokeScreen.classList.remove('rfx-blackout');
    if (video) video.style.filter = '';
    try { UISounds.playToneSweep(320, 960, 0.28, 0.1); } catch (e) {}
  }, blackoutDuration);
}

function endSong(player) {
  if (songEnded) return;
  songEnded = true;
  votePhaseActive = false;
  clearInterval(timerInterval);
  timerInterval = null;
  const errBanner = document.getElementById('video-error-banner');
  if (errBanner) errBanner.classList.remove('visible');
  if (blackoutTimeout) { clearTimeout(blackoutTimeout); blackoutTimeout = null; }
  const mouthCss2 = document.getElementById('axolo-mouth-css');
  if (mouthCss2) mouthCss2.classList.remove('open');
  document.getElementById('lyrics-text').classList.remove('blackout');
  document.getElementById('np-artist').classList.remove('blackout');
  const karaokeScreen = document.getElementById('karaoke-screen');
  if (karaokeScreen) karaokeScreen.classList.remove('rfx-blackout');

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

  const challengeVotes = (state.currentChallenge && Array.isArray(state.challengeVotes))
    ? state.challengeVotes.filter(v => v.performerSocketId === player.socketId)
    : [];
  const challengeYes = challengeVotes.filter(v => v.completed).length;
  const challengeTotal = challengeVotes.length;
  const challengePassed = !!state.currentChallenge && challengeTotal > 0 && challengeYes >= Math.ceil(challengeTotal / 2);
  const challengeBonus = challengePassed ? 15 : 0;
  const challengeResult = state.currentChallenge
    ? { text: state.currentChallenge.text, total: challengeTotal, yes: challengeYes, passed: challengePassed, bonus: challengeBonus }
    : null;

  const tomatoCount = state.tomatazoCounts[player.socketId] || 0;
  const tomatoPenalty = Math.min(30, tomatoCount * 15);

  let revenge = null;
  let revengeBonus = 0;
  let attackerDelta = 0;
  let revengeAttacker = null;
  if (state.round === 2 && state.currentAssignment && state.currentAssignment.attackerSocketId) {
    const assignment = state.currentAssignment;
    revengeAttacker = state.players.find(p =>
      p.socketId === assignment.attackerSocketId ||
      (assignment.attackerPlayerId && p.playerId === assignment.attackerPlayerId)
    ) || null;
    if (revengeAttacker && revengeAttacker.socketId !== player.socketId) {
      if (avgScore >= 80) {
        revengeBonus = 15;
        attackerDelta = -10;
        revenge = {
          type: 'revenge', bonus: revengeBonus, attackerName: revengeAttacker.name,
          attackerDelta, text: 'Revancha',
        };
      } else if (avgScore <= 30) {
        attackerDelta = 5;
        revenge = {
          type: 'crossfire', bonus: 0, attackerName: revengeAttacker.name,
          attackerDelta, text: 'Fuego cruzado',
        };
      }
    }
  }

  const finalScore = Math.max(0, avgScore + challengeBonus - tomatoPenalty + revengeBonus);

  hideChallengeHud();
  const challengeBanner = document.getElementById('challenge-banner');
  if (challengeBanner) {
    challengeBanner.style.opacity = '0';
    challengeBanner.classList.remove('is-live');
  }

  const target = state.players.find(p => p.socketId === player.socketId);
  if (target) target.score = (target.score || 0) + finalScore;
  if (revengeAttacker && attackerDelta) {
    revengeAttacker.score = Math.max(0, (revengeAttacker.score || 0) + attackerDelta);
  }

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
      let badge = v.score >= 80 ? '&#127942;' : v.score >= 50 ? '&#128077;' : '&#128128;';
      if (state.gameMode === 'emo') {
        badge = v.score >= 80 ? '🖤' : v.score >= 50 ? '💔' : '😭';
        if (v.score === 10) badge = '🥱'; // No dolió
      }
      let voteLabel = EMO_VOTE_LABELS[v.score] || `${v.score} pts`;
      row.innerHTML = `
        <span class="text-2xl">${badge}</span>
        <span class="font-bold text-sm flex-1" style="color:#f1f5f9;">${escapeHtml(v.voterName)}</span>
        <span class="text-xs font-bold" style="color:#94a3b8; margin-right:8px;">${state.gameMode === 'emo' ? voteLabel : ''}</span>
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

  if (challengeResult) {
    const challengeRow = document.createElement('div');
    challengeRow.className = 'mt-3 p-3 rounded-xl text-center';
    challengeRow.style.cssText = `background:${challengePassed ? '#22c55e22' : '#ef444422'}; border:1px solid ${challengePassed ? '#22c55e66' : '#ef444466'};`;
    challengeRow.innerHTML = `<p class="font-bold text-xs" style="color:${challengePassed ? '#4ade80' : '#fca5a5'}; letter-spacing:.12em;">🎭 RETO ${challengePassed ? 'CUMPLIDO +15' : 'NO CUMPLIDO'}</p><p class="text-xs mt-1" style="color:#94a3b8;">${escapeHtml(challengeResult.text)} · ${challengeYes}/${challengeTotal} votos</p>`;
    list.appendChild(challengeRow);
  }

  if (revenge) {
    const revengeRow = document.createElement('div');
    revengeRow.className = 'mt-3 p-3 rounded-xl text-center';
    const revColor = revenge.type === 'revenge' ? '#22c55e' : '#a855f7';
    revengeRow.style.cssText = `background:${revColor}22; border:1px solid ${revColor}66;`;
    const revLabel = revenge.type === 'revenge'
      ? `⚔️ REVANCHA +${revenge.bonus}`
      : `🔥 FUEGO CRUZADO +${revenge.attackerDelta}`;
    const revDetail = revenge.type === 'revenge'
      ? `Asignada por ${escapeHtml(revenge.attackerName)} · pierde ${Math.abs(revenge.attackerDelta)}`
      : `Asignada por ${escapeHtml(revenge.attackerName)} · se lleva +${revenge.attackerDelta}`;
    revengeRow.innerHTML = `<p class="font-bold text-xs" style="color:${revColor}; letter-spacing:.12em;">${revLabel}</p><p class="text-xs mt-1" style="color:#94a3b8;">${revDetail}</p>`;
    list.appendChild(revengeRow);
  }

  const totalRow = document.createElement('div');
  totalRow.className = 'mt-4 p-3 rounded-xl text-center';
  totalRow.style.cssText = 'background:#ec489922; border:1px solid #ec489966; opacity:0; transform:scale(0.8);';
  totalRow.innerHTML = `<p class="font-bold" style="color:#64748b;">TOTAL DE LA CANCIÓN</p><p id="total-score-display" class="text-4xl font-black" style="color:#ec4899;">0</p><p class="text-xs mt-1" style="color:#94a3b8;">Votos ${avgScore}${challengeResult ? ` · Reto ${challengeBonus ? '+' + challengeBonus : '0'}` : ''}${tomatoPenalty ? ` · Tomates −${tomatoPenalty}` : ''}${revengeBonus ? ` · Revancha +${revengeBonus}` : ''}</p>`;
  list.appendChild(totalRow);

  const totalDelay = 300 + singerVotes.length * 250 + 300;
  setTimeout(() => {
    playSfx('./assets/audio/sfx_magic_reveal.mp3');
    anime({
      targets: totalRow, opacity: [0, 1], scale: [0.8, 1.05, 1],
      duration: 600, easing: 'easeOutElastic(1, .5)',
      complete: () => {
        RitmikaStyleFX.counter(document.getElementById('total-score-display'), 0, finalScore, { duration: 800, prefix: '+' });
      }
    });
  }, totalDelay);

  saveGameState();
  overlay.classList.add('visible');
  document.body.classList.add('scoreboard-open');

  FlowDirector.enter('scoreboard', {
    action: 'next',
    run: () => nextTurn(),
    singerSocketId: player.socketId,
    label: 'Resultados de ' + player.name,
  });

  socket.emit('tv:broadcast', {
    roomCode: state.roomCode,
    event: 'SHOW_SCOREBOARD',
    data: {
      performerSocketId: player.socketId,
      performerName: player.name,
      average: avgScore,
      challenge: challengeResult,
      tomatoCount,
      tomatoPenalty,
      revenge,
      total: finalScore,
    },
  });
  socket.emit('tv:broadcast', { roomCode: state.roomCode, event: 'CHALLENGE_CLEAR', data: {} });

  const singer = state.players.find(p => p.socketId === player.socketId);
  const genreBark = singer ? getGenreBark(singer) : '&#161;Vaya actuaci&#243;n!';
  const voteReact = getVoteReaction(avgScore);
  const endMsg = avgScore > 70 ? voteReact : genreBark;
  axoloSay(endMsg.text, endMsg.file);

  if (scoreboardTimeout) { clearTimeout(scoreboardTimeout); scoreboardTimeout = null; }
  const ceremonyDuration = 300 + singerVotes.length * 250 + 900;
  // El siguiente turno avanza solo, pero nunca antes de que Axolo termine su
  // reacción ni antes de que la tabla termine de animarse.
  FlowDirector.armAuto({
    minMs: Math.max(ceremonyDuration + 2500, 5000),
    holdMs: 3000,
  });
}

document.getElementById('continue-btn').addEventListener('click', () => {
  UISounds.click();
  if (!FlowDirector.request('next')) {
    updateTicker('El siguiente turno avanza solo en un momento…');
  }
});

function nextTurn() {
  // Sin cama musical durante la partida: el loop de menu competia con el
  // narrador y con la cancion. Solo suena en lobby/menus.
  if (typeof bootMusic !== 'undefined' && bootMusic && !bootMusic.paused) {
    bootMusic.pause();
  }
  FlowDirector.enter('round_transition', { label: 'Cambio de turno' });
  stopAllSfx(450);
  if (rouletteAutoSpinTimeout) { clearTimeout(rouletteAutoSpinTimeout); rouletteAutoSpinTimeout = null; }
  if (rouletteResultTimeout) { clearTimeout(rouletteResultTimeout); rouletteResultTimeout = null; }
  if (scoreboardTimeout) { clearTimeout(scoreboardTimeout); scoreboardTimeout = null; }
  if (blackoutTimeout) { clearTimeout(blackoutTimeout); blackoutTimeout = null; }

  document.getElementById('scoreboard-overlay').classList.remove('visible');
  document.body.classList.remove('scoreboard-open');
  resetSongChallenge();
  state.currentAssignment = null;
  state.songLimitSeconds = null;
  state.songStartOffset = 0;
  state.tomatazoCounts = {};
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

    showRoundSplash(state.round, () => { startRoulette(true); });
    const rStartIdx = Math.floor(Math.random() * 2);
    let rStartText = '';
    let barkFile = `round_${state.round}_start_${rStartIdx}.mp3`;
    if (state.gameMode === 'emo') {
      const lines = EMO_MODE_PHRASES.roundIntros && EMO_MODE_PHRASES.roundIntros[state.round];
      if (lines && lines.length) {
        const choice = lines[Math.floor(Math.random() * lines.length)];
        rStartText = choice.text;
        barkFile = choice.file;
      } else {
        const phrases = EMO_MODE_PHRASES.intro;
        const choice = phrases[Math.floor(Math.random() * 3)];
        rStartText = choice.text;
        barkFile = choice.file;
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
    return;
  }

  startRoulette();
}

// ==============================================
//  PODIO FINAL - PREMIUM
// ==============================================
const AWARD_CARRILLA = {
  rey:      [{text:'&#161;La banda reconoci&#243; al verdadero &#237;dolo de la noche!', file:'award_rey_0.mp3'}, {text:'&#161;Nadie le llega ni a los talones!', file:'award_rey_1.mp3'}, {text:'&#161;El micr&#243;fono ya tiene nuevo due&#241;o permanente!', file:'award_rey_2.mp3'}, {text:'&#161;El Rey del Palenque no se discute: se respeta!', file:'award_rey_3.mp3'}, {text:'&#161;Ah&#237; est&#225; el campe&#243;n, se&#241;ores!', file:'award_rey_4.mp3'}],
  gallo:    [{text:'&#161;Los perros del barrio aullaron de solidaridad!', file:'award_gallo_0.mp3'}, {text:'&#161;Urgen 3 meses de solfeo, urgente!', file:'award_gallo_1.mp3'}, {text:'&#161;El honor de la familia exige pr&#225;ctica diaria!', file:'award_gallo_2.mp3'}],
  tomate:   [{text:'&#161;La banda habl&#243; con los proyectiles!', file:'award_tomate_0.mp3'}, {text:'&#161;Concentr&#243; todo el amor en forma de tomate!', file:'award_tomate_1.mp3'}, {text:'&#161;Tan bueno que mereci&#243; atenci&#243;n especial de todos!', file:'award_tomate_2.mp3'}],
  vengador: [{text:'&#161;Rob&#243; m&#225;s puntos que el gobierno!', file:'award_vengador_0.mp3'}, {text:'&#161;La t&#225;ctica del ataque silencioso funcion&#243; perfecto!', file:'award_vengador_1.mp3'}, {text:'&#161;Estratega karaoke de alto nivel!', file:'award_vengador_2.mp3'}],
};

const PODIUM_VOICE = {
  intro: [
    { text: '¡Bienvenidos a la Gran Premiación de Rítmika, banda! Saquen las micheladas, que hoy se corona al Rey del Palenque y se abuchea al Gallo Supremo. ¡Que empiece la carrilla!', file: 'podium_intro_ceremony_0.mp3' },
    { text: '¡Llegó el momento de la verdad, compas! Aquí se reparten trofeos, aplausos y unas buenas dosis de vergüenza ajena. ¡Arranca la premiación!', file: 'podium_intro_ceremony_1.mp3' },
    { text: '¡Se acabó el karaoke, pero no la carrilla! Bienvenidos a la premiación, donde el talento se premia y el desafine también. ¡Vamos con todo!', file: 'podium_intro_ceremony_2.mp3' },
    { text: '¡Banda, llegó la hora de coronar al Rey del Palenque! Y no se preocupen, al Gallo Supremo también le tenemos su trofeo y su salsa. ¡Comienza la fiesta!', file: 'podium_intro_ceremony_3.mp3' },
    { text: '¡Atención, palenque! La noche se cierra con premios, chistes y algún que otro tomate volador. ¡Que viva la premiación, carnales!', file: 'podium_intro_ceremony_4.mp3' },
  ],
  gallo: [
    { text: '¡Primer premio, banda! Gallo Supremo para el que cantó como gato en licuadora, pero con el corazón en la mano. ¡Que viva el valor!', file: 'podium_award_gallo_0.mp3' },
    { text: '¡Y el Gallo Supremo se lo lleva el que desafinó más fuerte que la bocina del tianguis! Aplausos, que también se sufre.', file: 'podium_award_gallo_1.mp3' },
    { text: '¡Gallo Supremo! Para el compa que se aventó al escenario sin miedo y sin afinación. ¡Eso también es arte, carnal!', file: 'podium_award_gallo_2.mp3' },
    { text: '¡El premio Gallo Supremo es para el que hizo llorar a los perros del barrio! Tranquilo, aquí te queremos igual.', file: 'podium_award_gallo_3.mp3' },
    { text: '¡Gallo Supremo, señores! El trofeo al valor desafinado. Porque cantar mal frente a la banda tiene su mérito y su carrilla.', file: 'podium_award_gallo_4.mp3' },
  ],
  tomate: [
    { text: '¡Salsa de Tomate! Para el que recibió más tomates que la selección en el Azteca. Pero ojo, aquí el tomate es cariño... creo.', file: 'podium_award_tomate_0.mp3' },
    { text: '¡Y el premio Salsa de Tomate es para el más atacado de la noche! Con tanto jitomate ya puedes abrir tu puesto en el tianguis, carnal.', file: 'podium_award_tomate_1.mp3' },
    { text: '¡Salsa de Tomate! El público te mandó tomates hasta por debajo de la puerta. No te preocupes, de aquí salió una salsa bien picante.', file: 'podium_award_tomate_2.mp3' },
    { text: '¡Salsa de Tomate para el superviviente del tomatazo! La banda te quiso tanto que te hizo ensalada. ¡Felicidades, compa!', file: 'podium_award_tomate_3.mp3' },
    { text: '¡Salsa de Tomate! Porque recibir tomates también es protagonismo. Ya tienes material para tu propio puesto de salsas, mi rey.', file: 'podium_award_tomate_4.mp3' },
  ],
  vengador: [
    { text: '¡Vengador Anónimo! Para el que sabotajeó más calladito que ex en WhatsApp. Todos te odiamos un poquito, pero te respetamos.', file: 'podium_award_vengador_0.mp3' },
    { text: '¡Vengador Anónimo! El que apagó el audio más veces que la luz en el barrio. Estratega, carnal, estratega.', file: 'podium_award_vengador_1.mp3' },
    { text: '¡Vengador Anónimo! Saboteador profesional con cara de no romper un plato. La banda ya te tiene en la mira.', file: 'podium_award_vengador_2.mp3' },
    { text: '¡Vengador Anónimo! Robó más atención que el compa que llega tarde a la fiesta. Pero qué bien lo hizo, ¿eh?', file: 'podium_award_vengador_3.mp3' },
    { text: '¡Vengador Anónimo! El premio al que saboteó con estilo. Nadie sabe quién fuiste... bueno, todos lo sabemos, compadre.', file: 'podium_award_vengador_4.mp3' },
  ],
  third: [
    { text: '¡Antes del gran campeón, hay que reconocer al tercer lugar! Con una actuación que ni fu ni fa...', file: 'podium_reveal_third_0.mp3' },
    { text: '¡En tercer lugar, el que sobrevivió al karaoke con más pena que gloria!', file: 'podium_reveal_third_1.mp3' },
    { text: '¡Tercer lugar! No fue el mejor, pero tampoco el peor. Un logro muy mexicano, la neta.', file: 'podium_reveal_third_2.mp3' },
    { text: '¡Y el tercer lugar se lo lleva el que aguantó tres rondas sin que se le acabara la vergüenza!', file: 'podium_reveal_third_3.mp3' },
    { text: '¡Tercer lugar! El bronce sabe a victoria... o a que faltó ensayo, pero igual se celebra.', file: 'podium_reveal_third_4.mp3' },
  ],
  second: [
    { text: '¡Y en segundo lugar, alguien que se la rifó y casi arrebata la corona!', file: 'podium_reveal_second_0.mp3' },
    { text: '¡Segundo lugar! Te quedaste a un tomatazo de la gloria, carnal. ¡Bien jugado!', file: 'podium_reveal_second_1.mp3' },
    { text: '¡En segundo lugar, la banda te quiere, pero el rey ya tiene dueño... por poquito!', file: 'podium_reveal_second_2.mp3' },
    { text: '¡Segundo lugar! Casi, casi. Como cuando dices que llegas en cinco minutos y llegas en una hora.', file: 'podium_reveal_second_3.mp3' },
    { text: '¡Segundo lugar! Te faltó un estribillo para coronarte. Pero esta noche te llevas aplausos y carrilla.', file: 'podium_reveal_second_4.mp3' },
  ],
  buildup: [
    { text: '¡Llegó el momento que todos esperaban! Después de tres rondas, canciones, tomatazos y mucha carrilla... ha llegado la hora de coronar al Rey del Palenque. El ganador de Rítmika es...', file: 'podium_winner_buildup_0.mp3' },
    { text: '¡Banda, llegó la hora de la verdad! Saquen las palomitas, apaguen el WhatsApp y pónganse cómodos, porque vamos a coronar al Rey del Palenque. El ganador es...', file: 'podium_winner_buildup_1.mp3' },
    { text: '¡Ya se armó el momento épico! Tres rondas, mil desafines y un montón de tomates después... el nuevo Rey del Palenque es...', file: 'podium_winner_buildup_2.mp3' },
    { text: '¡No se vayan, que esto se pone bueno! La banda ya votó, los tomates ya volaron y el trono está caliente. El Rey del Palenque es...', file: 'podium_winner_buildup_3.mp3' },
    { text: '¡Atención, palenque! El momento más esperado de la noche: coronar al Rey del Palenque. Y el ganador de Rítmika es...', file: 'podium_winner_buildup_4.mp3' },
  ],
  reveal: [
    { text: '¡El nuevo Rey del Palenque! El que demostró que tiene flow y que no le tiembla la voz. ¡Felicidades, campeón, de parte del Tío Axolo y de toda la banda!', file: 'podium_winner_reveal_0.mp3' },
    { text: '¡Tenemos nuevo Rey del Palenque! La noche queda oficialmente coronada. ¡Que viva el palenque!', file: 'podium_winner_reveal_1.mp3' },
    { text: '¡El Rey del Palenque ha sido coronado! La banda te aclama, los tomates te respetan y el micrófono ya tiene dueño. ¡Felicidades!', file: 'podium_winner_reveal_2.mp3' },
    { text: '¡Se acabó la duda! El Rey del Palenque es el que se llevó la noche con flow, carisma y algún que otro berrinche. ¡Que viva el campeón!', file: 'podium_winner_reveal_3.mp3' },
    { text: '¡El nuevo Rey del Palenque! Porque cantar bien es opcional, pero tener flow... eso no se negocia. ¡Felicidades, mi rey!', file: 'podium_winner_reveal_4.mp3' },
  ],
};

function pickPodiumLine(key) {
  const lines = PODIUM_VOICE[key] || [];
  return lines[Math.floor(Math.random() * lines.length)] || { text: '', file: null };
}

const EMO_AWARD_CARRILLA = {
  heart: [
    { text: 'Ni tu ex te dejó tan mal como esta puntuación.', file: 'emo/emo_award_0.mp3' },
    { text: 'Tu corazón tiene más grietas que la pantalla de mi celular.', file: 'emo/emo_award_0_1.mp3' },
    { text: 'Lloraste tanto que hasta el micrófono pidió terapia.', file: 'emo/emo_award_0_2.mp3' },
    { text: 'El premio al corazón más roto: ni el Titanic se hundió tanto.', file: 'emo/emo_award_0_3.mp3' },
    { text: 'Tu ex te mandó un mensaje... mentira, pero dolió igual.', file: 'emo/emo_award_0_4.mp3' },
  ],
  indirect: [
    { text: 'Esa indirecta dolió hasta en la otra cuadra.', file: 'emo/emo_award_1.mp3' },
    { text: 'Tus indirectas tienen más veneno que el WhatsApp de la familia.', file: 'emo/emo_award_1_1.mp3' },
    { text: 'El premio a la indirecta más filosa: hasta el Tío Axolo se dio por aludido.', file: 'emo/emo_award_1_2.mp3' },
    { text: 'Publicaste un estado y todos supimos de quién hablabas. Arte.', file: 'emo/emo_award_1_3.mp3' },
    { text: 'Esa indirecta llegó más lejos que el wifi del vecino.', file: 'emo/emo_award_1_4.mp3' },
  ],
  blackout: [
    { text: 'Cantaste en la oscuridad mejor que en la luz.', file: 'emo/emo_award_2.mp3' },
    { text: 'Sobreviviste al apagón como sobreviviste a tu ex: con dignidad y desafinando.', file: 'emo/emo_award_2_1.mp3' },
    { text: 'El premio a cantar a oscuras: ni la luz se atrevió a verte.', file: 'emo/emo_award_2_2.mp3' },
    { text: 'Sobreviviente del apagón. La oscuridad te queda bien.', file: 'emo/emo_award_2_3.mp3' },
    { text: 'Cantaste sin letra, sin luz y sin vergüenza. Un ejemplo para la banda.', file: 'emo/emo_award_2_4.mp3' },
  ],
};

const EMO_PODIUM_AWARDS = {
  heart: [
    { text: 'Primer premio: Corazón Más Roto. Para quien nos hizo sufrir más que su ex. Y el ganador es...', file: 'emo/emo_podium_award_0.mp3' },
    { text: 'El premio Corazón Más Roto va para el que lloró hasta en el coro. El ganador es...', file: 'emo/emo_podium_award_0_1.mp3' },
    { text: 'Corazón Más Roto: un trofeo para el que convirtió el karaoke en terapia. El ganador es...', file: 'emo/emo_podium_award_0_2.mp3' },
    { text: 'Primer premio: el corazón más roto de la noche. Y no, no es un cumplido. El ganador es...', file: 'emo/emo_podium_award_0_3.mp3' },
    { text: 'Corazón Más Roto. Porque hay heridas que ni el autotune cura. El ganador es...', file: 'emo/emo_podium_award_0_4.mp3' },
  ],
  indirect: [
    { text: 'Siguiente premio: Mejor Indirecta. Para esa persona que lanza dagas como si publicara estados de Messenger...', file: 'emo/emo_podium_award_1.mp3' },
    { text: 'Mejor Indirecta: el premio a decir todo sin decir nada. El ganador es...', file: 'emo/emo_podium_award_1_1.mp3' },
    { text: 'Siguiente premio: Mejor Indirecta. Sus estados de WhatsApp deberían venir con advertencia. El ganador es...', file: 'emo/emo_podium_award_1_2.mp3' },
    { text: 'Mejor Indirecta: para el que publica una canción y todos sabemos de quién habla. El ganador es...', file: 'emo/emo_podium_award_1_3.mp3' },
    { text: 'Mejor Indirecta. El arte de herir con emojis. El ganador es...', file: 'emo/emo_podium_award_1_4.mp3' },
  ],
  blackout: [
    { text: 'Último premio: Sobreviviente del Apagón. Brillaste más en la oscuridad. El premio es para...', file: 'emo/emo_podium_award_2.mp3' },
    { text: 'Sobreviviente del Apagón: para el que cantó sin luz y sin vergüenza. El premio es para...', file: 'emo/emo_podium_award_2_1.mp3' },
    { text: 'Último premio: Sobreviviente del Apagón. La oscuridad no pudo contigo. El premio es para...', file: 'emo/emo_podium_award_2_2.mp3' },
    { text: 'Sobreviviente del Apagón. Cantaste a ciegas y aun así nos hiciste llorar. El premio es para...', file: 'emo/emo_podium_award_2_3.mp3' },
    { text: 'Último premio: el que sobrevivió al apagón emocional. El premio es para...', file: 'emo/emo_podium_award_2_4.mp3' },
  ],
};

let podiumBgm = null;

function showPodium() {
  document.body.classList.remove('scoreboard-open');
  document.body.classList.remove('podium-title-open','podium-award-open','podium-winner-open','podium-final-open');
  if (typeof bootMusic !== 'undefined' && bootMusic) { bootMusic.pause(); }
  FlowDirector.enter('podium', { label: 'Premiación' });
  sting('sting_podium', 0.5);
  clearSavedGame();
  if (podiumBgm) { podiumBgm.pause(); podiumBgm.currentTime = 0; podiumBgm = null; }

  const sorted       = [...state.players].sort((a, b) => b.score - a.score);
  const mostTomatoes = [...state.players].sort((a, b) => (b.tomatazos||0) - (a.tomatazos||0))[0];
  const sabotageCounts = state.sabotageCounts || {};
  const sabotageSorted = [...state.players].sort((a, b) => (sabotageCounts[b.socketId] || 0) - (sabotageCounts[a.socketId] || 0));
  const mostSaboteur = sabotageSorted.find(p => (sabotageCounts[p.socketId] || 0) > 0) || null;
  const vengador = mostSaboteur || (sorted.length >= 3 ? sorted[1] : (sorted[1] || sorted[0]));
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];

  let awardsData = [];
  if (state.gameMode === 'emo') {
    awardsData = [
      { icon:'💔', img: './assets/modes/emo/award_broken_heart.webp?v=3', title:'Corazón Más Roto', subtitle:'Mayor Sufrimiento', player: sorted[sorted.length-1], color:'#6b7280', border:'#4b5563', obj: rand(EMO_AWARD_CARRILLA.heart) },
      { icon:'📱', img: './assets/modes/emo/award_indirecta.webp?v=3', title:'Mejor Indirecta', subtitle:'Fuego Cruzado Emo', player: vengador, color:'#a855f7', border:'#9333ea', obj: rand(EMO_AWARD_CARRILLA.indirect) },
      { icon:'🌑', img: './assets/modes/emo/award_blackout.webp?v=3', title:'Sobreviviente', subtitle:'Superó el Apagón', player: sorted[0], color:'#facc15', border:'#eab308', obj: rand(EMO_AWARD_CARRILLA.blackout) },
    ];
  } else {
    awardsData = [
      { icon:'&#128019;', img: './assets/award_gallo.webp?v=3', title:'Gallo Supremo',    subtitle:'Valor Desafinado', player: sorted[sorted.length-1], color:'#6b7280', border:'#4b5563', obj: rand(AWARD_CARRILLA.gallo) },
      { icon:'&#127813;', img: './assets/award_tomate.webp?v=3', title:'Salsa de Tomate',  subtitle:'El M&#225;s Atacado',   player: mostTomatoes && mostTomatoes.tomatazos > 0 ? mostTomatoes : null, color:'#ef4444', border:'#dc2626', obj: rand(AWARD_CARRILLA.tomate) },
      { icon:'&#128535;', img: './assets/award_vengador.webp?v=3', title:'Vengador An&#243;nimo', subtitle:'M&#225;s Sabotajes',    player: vengador, color:'#a855f7', border:'#9333ea', obj: rand(AWARD_CARRILLA.vengador) },
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
  const STAR_COUNT = (window.RITMIKA_PERF_MODE === 'performance') ? 0 : ((typeof window !== 'undefined' && window.RITMIKA_LITE) ? 50 : 120);
  const stars = Array.from({length: STAR_COUNT}, () => ({
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
  if (STAR_COUNT > 0) drawStars();

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

  /*
   * Espera a que termine TODO audio de Axolo (incluida la cola) y añade el
   * margen pedido.
   *
   * Antes se enganchaba a `_axoloAudioDoneResolve`, un único slot global: si la
   * narración de la fase quedaba encolada detrás de otro audio, el visual
   * avanzaba al terminar el audio equivocado y la voz sonaba después (de ahí
   * que la premiación se oyera desfasada). Además, si un MP3 fallaba, el
   * handler de error no llamaba al resolver y la ceremonia se quedaba colgada.
   */
  function waitForAxoloAudio(bufferMs) {
    bufferMs = bufferMs || 800;
    // Espera a que termine la voz Y la cola. El límite de 60s evita que un
    // MP3 corrupto congele la ceremonia.
    const waitVoice = (window.AxoloNarrator && typeof window.AxoloNarrator.whenIdle === 'function')
      ? window.AxoloNarrator.whenIdle({ maxMs: 60000 })
      : Promise.resolve(true);
    return waitVoice.then(() => new Promise(resolve => setTimeout(resolve, bufferMs)));
  }

  async function runCeremony() {

    // FASE 1: Titulo epico
    document.body.classList.add('podium-title-open');
    ceremonyRoot.innerHTML=''; ceremonyRoot.appendChild(starCanvas);
    const bgImg=document.createElement('div');
    bgImg.style.cssText='position:absolute;inset:0;background:url(./assets/podium_bg_stage_wide.webp) center/cover no-repeat;opacity:0;z-index:0;transition:opacity 1.2s ease;';
    ceremonyRoot.appendChild(bgImg);
    const bgOvl=document.createElement('div');
    bgOvl.style.cssText='position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,26,0.5) 0%,rgba(10,10,26,0.88) 100%);z-index:1;';
    ceremonyRoot.appendChild(bgOvl);
    setTimeout(()=>{ bgImg.style.opacity='1'; },100);

    const titleWrap=document.createElement('div');
    titleWrap.style.cssText='position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;';
    ceremonyRoot.appendChild(titleWrap);

    const trophyEl=document.createElement('img');
    trophyEl.src='./assets/podium_trophy_ritmika.webp';
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
    _stopCurrentAxolo();
    if (typeof state !== 'undefined' && state.gameMode === 'emo') {
      const p = rand(EMO_MODE_PHRASES.podiumIntro);
      axoloSay(p.text, p.file, 4000, true);
    } else {
      const introLine = pickPodiumLine('intro');
      axoloSay(introLine.text, introLine.file, 4000, true);
    }
    await waitForAxoloAudio(1500);
    anime({targets:[titleBlock,subtitleEl,trophyEl],opacity:[1,0],translateY:[0,-40],duration:500,easing:'easeInCubic'});
    await wait(600);
    document.body.classList.remove('podium-title-open');

    // FASE 2: Premios especiales
    document.body.classList.add('podium-award-open');
    let awardRevealSeq = 0;
    for (const award of awardsData) {
      if (!award.player) continue;
      const av=getAvatar(award.player.avatarId);
      const sideDir=award.icon==='&#128019;'?-1:award.icon==='&#127813;'?1:0;
      ceremonyRoot.innerHTML=''; ceremonyRoot.appendChild(starCanvas);
      const aBg=document.createElement('div');
      aBg.style.cssText='position:absolute;inset:0;background:url(./assets/podium_bg_stage_wide.webp) center/cover no-repeat;opacity:0.22;z-index:0;';
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
      let awardGraphic = award.img ? '<img src="'+award.img+'" style="width:220px;height:220px;object-fit:contain;margin:0 auto 12px;filter:drop-shadow(0 0 18px '+award.color+');"/>' : '<div style="font-size:76px;margin-bottom:8px;filter:drop-shadow(0 0 18px '+award.color+');">'+award.icon+'</div>';
      // La tarjeta muestra el premio durante la narración, pero el ganador se
      // revela recién cuando el narrador termina de anunciarlo.
      const winnerBlockId = 'award-winner-' + (awardRevealSeq++);
      aCard.innerHTML= awardGraphic 
        +'<h2 style="font-family:\'Paytone One\',sans-serif;font-size:42px;margin:6px 0;text-shadow:0 0 22px '+award.color+';color:'+award.color+';">'+award.title+'</h2>'
        +'<p style="font-family:Fredoka,sans-serif;font-size:15px;color:#94a3b8;font-weight:700;margin-bottom:16px;letter-spacing:2px;text-transform:uppercase;">'+award.subtitle+'</p>'
        +'<div id="'+winnerBlockId+'" style="opacity:0;transform:translateY(24px) scale(0.85);">'
        +'<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:14px 0;padding:12px 20px;border-radius:0;background:'+award.color+';border:6px solid #111827;box-shadow:8px 8px 0 #111827;">'
        +'<div style="width:56px;height:56px;border-radius:50%;overflow:hidden;background:'+av.color+';border:6px solid #111827;display:flex;align-items:center;justify-content:center;box-shadow:6px 6px 0 #111827, 0 0 20px '+av.border+'66;">'
        +'<img src="'+av.img+'" style="width:90%;height:90%;object-fit:contain;"/></div>'
        +'<span style="font-family:\'Paytone One\',sans-serif;font-size:28px;color:#111827;">'+escapeHtml(award.player.name)+'</span></div>'
        +'<div style="background:#1e293b;border:6px solid #111827;border-radius:0;padding:14px 20px;margin-top:10px;box-shadow:8px 8px 0 #111827;">'
        +'<p style="font-family:Fredoka,sans-serif;font-size:16px;color:#f8fafc;font-weight:900;margin:0;line-height:1.5;">&ldquo;'+award.carrilla+'&rdquo;</p></div>'
        +'</div>';
      aPhase.appendChild(aLabel);
      aPhase.appendChild(aCard);
      anime({targets:aLabel,opacity:[0,1],translateY:[-20,0],duration:400,easing:'easeOutQuad'});
      await wait(200);
      anime({targets:aCard,opacity:[0,1],translateX:[sideDir*130+'%','0%'],duration:850,easing:'easeOutBack'});
      if(axoloOverlay) axoloOverlay.style.zIndex='10002';
      _stopCurrentAxolo();
      let awardLine = award.icon === '&#128019;' ? pickPodiumLine('gallo')
        : award.icon === '&#127813;' ? pickPodiumLine('tomate')
        : pickPodiumLine('vengador');
      if (state.gameMode === 'emo') {
        if (award.icon === '💔') {
          awardLine = rand(EMO_PODIUM_AWARDS.heart);
        } else if (award.icon === '📱') {
          awardLine = rand(EMO_PODIUM_AWARDS.indirect);
        } else if (award.icon === '🌑') {
          awardLine = rand(EMO_PODIUM_AWARDS.blackout);
        }
      }
      axoloSay(awardLine.text, awardLine.file, 4000, true);
      // El narrador presenta el premio; el nombre y la carrilla se revelan
      // cuando termina de anunciarlo (antes se veían desde el segundo cero).
      await waitForAxoloAudio(400);
      if(award.icon==='&#128019;' || award.icon==='&#127813;'){ playSfx('./assets/audio/sfx_comedy_fail.mp3'); } else { playSfx('./assets/audio/sfx_magic_reveal.mp3'); }
      anime({targets:'#'+winnerBlockId,opacity:[0,1],translateY:[24,0],scale:[0.85,1.06,1],duration:800,easing:'easeOutBack'});
      // Un poco más de tiempo en pantalla: el nombre y la carrilla hay que leerlos.
      await wait(2600);
      anime({targets:[aLabel,aCard],opacity:[1,0],translateY:[0,-40],duration:400,easing:'easeInCubic'});
      if(sp&&sp.parentNode) sp.parentNode.removeChild(sp);
      await wait(500);
    }

    // FASE 3: Revelacion 3ro y 2do
    playSfx('./assets/audio/sfx_drumroll.mp3');
    ceremonyRoot.innerHTML=''; ceremonyRoot.appendChild(starCanvas);
    const p3bg=document.createElement('div');
    p3bg.style.cssText='position:absolute;inset:0;background:url(./assets/podium_bg_stage_wide.webp) center/cover no-repeat;opacity:0.18;z-index:0;';
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
      // Placeholder "?" mientras el narrador anuncia; el escalón se revela
      // cuando termina (antes el ganador aparecía junto con la primera frase).
      const revealSlot=document.createElement('div');
      revealSlot.style.cssText='width:'+(sd.place===2?'240px':'220px')+';border-radius:0;height:'+pedH+';background:#0f172a;border:6px dashed #111827;border-bottom:none;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 20px rgba(0,0,0,0.5);margin-bottom:-6px;';
      revealSlot.innerHTML='<span style="font-size:3rem;opacity:0.2;">?</span>';
      if(sd.place===2) p3steps.replaceChild(revealSlot,leftSlot);
      else p3steps.replaceChild(revealSlot,rightSlot);
      _stopCurrentAxolo();
      const placementLine = pickPodiumLine(sd.place === 3 ? 'third' : 'second');
      axoloSay(placementLine.text + ' ¡' + escapeHtml(sd.player.name) + '!', placementLine.file, 4000, true);
      await waitForAxoloAudio(400);
      if(revealSlot.parentNode) revealSlot.replaceWith(stepDiv);
      UISounds.reveal();
      anime({targets:stepDiv,opacity:[0,1],translateY:['80px','0px'],duration:800,easing:'easeOutBack'});
      const scoreEl=stepDiv.querySelector('.step-score-'+sd.place);
      if(scoreEl) animatePodiumCounter(scoreEl,sd.player.score||0,1000);
      await wait(1700);
    }
    await wait(400);
    document.body.classList.remove('podium-award-open');

    // FASE 4: MOMENTO WOW - 1er lugar
    if(sorted[0]) {
      const blackout=document.createElement('div');
      blackout.style.cssText='position:fixed;inset:0;background:#000;opacity:0;z-index:10003;pointer-events:none;';
      document.body.appendChild(blackout);
      anime({targets:blackout,opacity:[0,0.95],duration:600,easing:'easeInQuad'});
      await wait(400);
      _stopCurrentAxolo();
      const buildupLine = pickPodiumLine('buildup');
      axoloSay(buildupLine.text, buildupLine.file, 4000, true);
      await waitForAxoloAudio(500);
      blackout.innerHTML='<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;"><p id="susp-text" style="font-family:\'Paytone One\',sans-serif;font-size:28px;color:#94a3b8;letter-spacing:10px;text-transform:uppercase;opacity:0;">Y el ganador es...</p><div id="countdown-wrap" style="display:flex;gap:30px;margin-top:10px;"></div></div>';
      anime({targets:'#susp-text',opacity:[0,1],translateY:[20,0],duration:600,easing:'easeOutQuad'});
      // El narrador termina con "...es...": el suspenso empieza ya, sin 4s muertos.
      await wait(1200);
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
      document.body.classList.add('podium-winner-open');
      const winnerScreen=document.createElement('div');
      winnerScreen.style.cssText='position:fixed;inset:0;z-index:10004;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(rgba(10,10,26,0.72),rgba(10,10,26,0.92)), url(./assets/podium_bg_stage_wide.webp) center/cover no-repeat;overflow:hidden;';
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
        +'<div id="winner-score-display" style="font-family:\'Paytone One\',sans-serif;font-size:42px;color:#facc15;margin-top:18px;text-shadow:6px 6px 0 #111827, 0 0 20px #facc15;opacity:0;background:#0f172a;border:6px solid #111827;padding:4px 30px;box-shadow:10px 10px 0 #111827;">0 pts</div>'
        +'<img src="./assets/podium_trophy_ritmika.webp" alt="Trofeo Rítmika" style="width:160px;height:160px;object-fit:contain;margin-top:20px;filter:drop-shadow(0 0 28px #facc15) drop-shadow(0 0 56px #facc1588);"/>';
      winnerScreen.appendChild(winnerContent);
      anime({targets:'#winner-reveal-content',opacity:[0,1],scale:[0.6,1.05,1],duration:900,easing:'easeOutBack'});
      sting('sting_winner', 0.55);
      setTimeout(()=>{playSfx('./assets/audio/sfx_applause.mp3');}, 500);
      await wait(400);
      anime({targets:'#winner-crown',translateY:[0,-18,0],duration:1200,loop:true,easing:'easeInOutSine'});
      anime({targets:'#winner-score-display',opacity:[0,1],translateY:[20,0],duration:500,easing:'easeOutQuad',delay:600});
      const wScoreEl=document.getElementById('winner-score-display');
      if(wScoreEl) setTimeout(()=>animatePodiumCounter(wScoreEl,sorted[0].score||0,1400),700);
      _stopCurrentAxolo();
      if (typeof state !== 'undefined' && state.gameMode === 'emo') {
        const p = rand(EMO_MODE_PHRASES.podiumWinner);
        axoloSay(p.text, p.file, 4000, true);
      } else {
        const revealLine = pickPodiumLine('reveal');
        axoloSay(revealLine.text, revealLine.file, 4000, true);
      }
      [800,1200,1600,2000].forEach(delay=>{
        setTimeout(()=>fireworkBurst(window.innerWidth*(0.2+Math.random()*0.6),window.innerHeight*(0.1+Math.random()*0.4)),delay);
      });
      await waitForAxoloAudio(1500);
      anime({targets:'#winner-reveal-content',opacity:[1,0],scale:[1,0.8],duration:500,easing:'easeInCubic'});
      await wait(600);
      if(winnerScreen.parentNode) winnerScreen.parentNode.removeChild(winnerScreen);
      document.body.classList.remove('podium-winner-open');
    }

    // FASE 5: Podio final completo premium
    document.body.classList.add('podium-final-open');
    ceremonyRoot.innerHTML=''; ceremonyRoot.appendChild(starCanvas);
    const finalBg=document.createElement('div');
    finalBg.style.cssText='position:absolute;inset:0;background:url(./assets/podium_bg_stage_wide.webp) center/cover no-repeat;opacity:0.16;z-index:0;';
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
      const awardPanelIcon = a.img
        ? '<img src="'+a.img+'" style="width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 0 8px '+a.color+');"/>'
        : '<div style="font-size:26px;filter:drop-shadow(0 0 8px '+a.color+');">'+a.icon+'</div>';
      aEl.innerHTML=awardPanelIcon
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
    const restartGame = () => {
      stopMouthAnimation();
      _stopCurrentAxolo();
      stopAllSfx(300);
      if(starFrameId) cancelAnimationFrame(starFrameId);
      if(axoloOverlay) axoloOverlay.style.zIndex='';
      const podiumToRemove=document.getElementById('podium-screen');
      if(podiumToRemove&&podiumToRemove.parentNode) podiumToRemove.parentNode.removeChild(podiumToRemove);
      UISounds.click();
      state.round=0;state.players=[];state.votes=[];state.currentSingerIdx=0;
      state.singerQueue=[];state.audioSabotageCount=0;state.tomatazoCounts={};state.sabotageCounts={};state.currentChallenge=null;state.currentAssignment=null;state.songLimitSeconds=null;state.songStartOffset=0;state.challengeVotes=[];state.challengeVotedBy=new Set();challengeDeck=[];hideChallengeHud();
      socket.emit('tv:create_room');
      showScreen('lobby-screen');
      if (typeof startLobbyIdleLoop === 'function') startLobbyIdleLoop();
      FlowDirector.enter('lobby', { label: 'Sala de espera' });
      if (typeof bootMusic !== 'undefined' && bootMusic && window.__RITMIKA_MENU_MUSIC !== false) {
        bootMusic.volume = 0.22;
        bootMusic.play().catch(()=>{});
      }
      const newGameChoice=NEW_GAMES[Math.floor(Math.random()*NEW_GAMES.length)];
      if (typeof axoloLobbySay === 'function') axoloLobbySay(newGameChoice.text, newGameChoice.file, true);
      else axoloSay(newGameChoice.text,newGameChoice.file,4000,true);
    };
    restartBtn.addEventListener('click',()=>{
      if (!FlowDirector.request('new_game')) {
        updateTicker('La nueva partida se habilita al terminar el podio…');
      }
    });
    FlowDirector.enter('podium_final', {
      action: 'new_game',
      run: restartGame,
      label: 'Podio final',
    });
    FlowDirector.makeReady();
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
    // La victoria entra ya; el cierre de la noche queda encolado detrás (antes
    // se encolaba la primera y sonaba la segunda, saltándose una frase).
    axoloSay(fVictoryChoice.text,fVictoryChoice.file,4000,true);
    axoloSay(customPodiumScript,pClimaxChoice.file);
    ['&#127881;','&#127882;','&#127942;','&#11088;','&#128293;','&#127925;','&#128171;','&#127775;'].forEach((e,i)=>
      setTimeout(()=>floatEmoji(e),i*150)
    );
  }

  runCeremony();
}

