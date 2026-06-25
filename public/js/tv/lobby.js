// ═══ LOBBY & FX ═══
// Módulo extraído de tv.html
// ==============================================

// ════════════════════════════════════════════
//  LOBBY RENDER HELPERS
// ════════════════════════════════════════════
function renderRoomCode(code) {
  const container = document.getElementById('room-code-display');
  if (container) {
    container.innerHTML = '';
    [...code].forEach((letter, i) => {
      const div = document.createElement('div');
      div.className = 'code-letter';
      div.textContent = letter;
      // Inject Premium Styles to override the yellow default
      div.style.background = 'rgba(10,10,26,0.9)';
      div.style.color = '#22d3ee';
      div.style.border = '2px solid rgba(34,211,238,0.5)';
      div.style.boxShadow = '0 0 15px rgba(34,211,238,0.2), inset 0 0 10px rgba(34,211,238,0.1)';
      div.style.textShadow = '0 0 10px #22d3ee';
      div.style.borderRadius = '16px';
      
      div.style.opacity = '0';
      container.appendChild(div);
      anime({ targets: div, opacity:[0,1], translateY:[-20,0], scale:[0,1], delay: i*120, duration:600, easing:'easeOutBack', complete:() => { div.style.animation = 'letterGlow 2s ease-in-out infinite alternate'; } });
    });
  }

  const joinUrl = `${window.location.origin}/join?code=${state.roomCode || ''}`;
  const textoInstruccion = document.getElementById('texto-instruccion-unirse');
  if (textoInstruccion) {
    textoInstruccion.innerHTML = `Escanea el código QR o ingresa a:<br/><span style="color:#22d3ee; font-weight:900; letter-spacing:1px; text-shadow:0 0 8px rgba(34,211,238,0.5);">${joinUrl}</span>`;
  }

  // QR del WiFi — escanear para conectarse automáticamente a la red
  const wifiQr = document.getElementById('qr-wifi');
  if (wifiQr) {
    wifiQr.src = '/qr-wifi';
  }

  // Mostrar credenciales WiFi
  const wifiSsid = document.getElementById('wifi-ssid');
  if (wifiSsid) {
    wifiSsid.textContent = state.hotspotSSID;
  }
  const wifiPassword = document.getElementById('wifi-password');
  if (wifiPassword) {
    wifiPassword.textContent = state.hotspotPassword;
  }
}

function renderPlayerList() {
  const lobbyContainer = document.getElementById('players-list');
  const modeContainer = document.getElementById('mode-players-list');
  const activePlayers = state.players.filter(p => !p.disconnected);
  
  // Sync the player count badges
  const modeCountStr = `${activePlayers.length} / 8`;
  const mBadge = document.getElementById('mode-player-badge');
  if (mBadge) mBadge.textContent = modeCountStr;
  const mCount = document.getElementById('mode-player-count');
  if (mCount) mCount.textContent = activePlayers.length;

  const renderToContainer = (container, emptyStateId) => {
    if (!container) return;
    const emptyState = document.getElementById(emptyStateId);
    if (activePlayers.length === 0) { 
      if(emptyState) emptyState.style.display='flex'; 
      container.querySelectorAll('.player-card').forEach(c=>c.remove()); 
      return; 
    }
    if(emptyState) emptyState.style.display = 'none';
    const existingIds = new Set([...container.querySelectorAll('.player-card')].map(el=>el.dataset.socketId));
    activePlayers.forEach(player => {
      if (!existingIds.has(player.socketId)) {
        const card = buildPlayerCard(player);
        container.appendChild(card);
        anime({ targets: card, translateX:[60,0], opacity:[0,1], duration:500, easing:'easeOutBack' });
      }
    });
    container.querySelectorAll('.player-card').forEach(card => {
      if (!activePlayers.find(p => p.socketId === card.dataset.socketId)) {
        anime({ targets:card, translateX:[0,60], opacity:[1,0], duration:300, easing:'easeInCubic', complete:()=>card.remove() });
      }
    });
  };

  renderToContainer(lobbyContainer, 'empty-state');
  renderToContainer(modeContainer, 'mode-empty-state');
}

function buildPlayerCard(player) {
  const av = getAvatar(player.avatarId ?? 0);
  const card = document.createElement('div');
  card.className = 'player-card'; card.dataset.socketId = player.socketId;
  card.style.setProperty('--card-accent', av.border);
  card.style.setProperty('--card-glow', av.border + '44');
  card.innerHTML = `
    <div class="avatar-bubble" style="background:${av.color}22; border-color:${av.border}; overflow:hidden; display:flex; align-items:center; justify-content:center;">
      <img src="${av.img}" style="width:100%; height:100%; object-fit:contain;" />
    </div>
    <div class="flex-1 min-w-0">
      <p class="font-bold truncate text-sm" style="color:#f1f5f9;">${escapeHtml(player.name)}</p>
      <p class="text-xs truncate" style="color:#94a3b8;">${av.label}</p>
    </div>
    <div class="text-xs font-bold" style="color:#22d3ee;">${player.score||0} pts</div>
  `;
  return card;
}

function updateAllPlayerCardScores() {
  document.querySelectorAll('.player-card').forEach(card => {
    const p = state.players.find(pl => pl.socketId === card.dataset.socketId);
    const scoreEl = card.querySelector('div.text-xs.font-bold');
    if (p && scoreEl) {
      scoreEl.textContent = (p.score || 0) + ' pts';
      if (p.score < TOMATAZO_COST) {
        scoreEl.style.color = '#ef4444';
      } else {
        scoreEl.style.color = '#22d3ee';
      }
    }
  });
}

function updatePlayerCount(joiningPlayer) {
  const n = state.players.filter(p => !p.disconnected).length;
  const display = document.getElementById('player-count-display');
  const badge = document.getElementById('player-count-badge');
  if (joiningPlayer && n > 1) {
    RitmikaStyleFX.counter(display, n - 1, n, { duration: 600, delay: 200 });
  } else {
    display.textContent = n;
  }
  badge.textContent = `${n} / 8`;
  if (joiningPlayer) {
    anime({ targets: display, scale: [1, 1.3, 1], duration: 400, easing: 'easeOutBack' });
    anime({ targets: badge, scale: [1, 1.2, 1], duration: 400, easing: 'easeOutBack' });
  }
}

function updateTicker(msg) {
  const ticker = document.getElementById('event-ticker');
  if (!ticker) return;
  ticker.style.opacity = '0';
  setTimeout(() => { ticker.textContent = msg; anime({ targets: ticker, opacity:[0,1], duration:300 }); }, 150);
  const dot = document.querySelector('.live-dot');
  if (dot) { anime({ targets: dot, scale: [1, 1.8, 1], duration: 300, easing: 'easeOutBack' }); }
}

// ════════════════════════════════════════════
//  FX: TOMATAZO, EMOJI, SABOTAJE
// ════════════════════════════════════════════
function fireTomatazo(attackerName, targetName, cost) {
  // 1. Lanzamiento premium del tomate volador
  const tomato = document.createElement('div');
  tomato.className = 'tomato-projectile';
  tomato.innerHTML = '<img src="./assets/tomato_projectile.webp" alt="🍅" />';
  document.body.appendChild(tomato);

  const startSide = Math.random() > 0.5 ? 1 : -1;
  const sx = startSide === 1 ? -100 : window.innerWidth + 100;
  const sy = window.innerHeight * 0.5 + (Math.random() - 0.5) * window.innerHeight * 0.3;
  const ex = window.innerWidth * 0.3 + Math.random() * window.innerWidth * 0.4;
  const ey = window.innerHeight * 0.25 + Math.random() * window.innerHeight * 0.25;

  tomato.style.left = sx + 'px';
  tomato.style.top = sy + 'px';

  // Swoosh sound
  try {
    UISounds.playToneSweep(80, 1400, 0.25, 0.08);
  } catch (e) {}

  anime({
    targets: tomato,
    left: [sx, ex],
    top: [sy, ey],
    rotate: [0, startSide * 1080],
    scale: [0.5, 1.8, 3],
    duration: 650,
    easing: 'easeInQuad',
    complete: () => {
      tomato.remove();
    },
  });

  // 2. IMPACTO — splat premium que tapa la visión
  setTimeout(() => {
    const splatOverlay = document.getElementById('tomato-splat-overlay');
    if (!splatOverlay) return;

    // Screen shake violenta
    try {
      RitmikaStyleFX.screenShake(18, 600);
      RitmikaStyleFX.flashBang('#ef4444', 200);
    } catch (e) {}

    // Impact sound
    try {
      UISounds.playTone(60, 0.4, 'sawtooth', 0.15);
      UISounds.playToneSweep(200, 40, 0.3, 0.1);
    } catch (e) {}

    // Mostrar splat
    splatOverlay.classList.add('visible');

    // Posicionar las drip-lines aleatoriamente
    const dripLines = splatOverlay.querySelectorAll('.splat-drip-line');
    dripLines.forEach((line, i) => {
      line.style.left = (15 + Math.random() * 70) + '%';
      line.style.height = (50 + Math.random() * 100) + 'px';
      line.style.transitionDelay = (0.1 + i * 0.08) + 's';
    });

    // 3. El splat siempre tapa la pantalla (z-index alto)
    splatOverlay.style.zIndex = '100';

    // Mostrar indicador de penalización
    if (cost > 0) {
      const penaltyEl = document.createElement('div');
      penaltyEl.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); font-family:\'Paytone One\',sans-serif; font-size:4rem; font-weight:900; color:#ef4444; pointer-events:none; z-index:200; text-shadow:0 0 30px rgba(220,38,38,0.8), 6px 6px 0 #111827; opacity:0;';
      penaltyEl.textContent = '-\u2009' + cost + ' pts';
      document.body.appendChild(penaltyEl);
      anime({
        targets: penaltyEl,
        opacity: [0, 1, 1, 0],
        scale: [2, 1, 0.8],
        translateY: ['-50%', '-50%', '-80%'],
        duration: 2200,
        easing: 'easeOutCubic',
        complete: () => penaltyEl.remove(),
      });
    }

    // 4. Dripping — el splat se desvanece lentamente con goteo
    setTimeout(() => {
      splatOverlay.classList.remove('visible');
    }, 4000);
  }, 550);
}

function floatEmoji(emoji) {
  const el = document.createElement('div');
  el.className = 'emoji-float'; el.textContent = emoji;
  el.style.left = (20 + Math.random() * 60) + 'vw'; el.style.bottom = '80px'; el.style.opacity = '1';
  document.body.appendChild(el);
  anime({ targets:el, translateY:[0,-(window.innerHeight*0.7)], translateX:[(Math.random()-0.5)*100], rotate:[(Math.random()-0.5)*40], scale:[1,1.5,0.5], opacity:[1,1,0], duration:2500, easing:'easeOutCubic', complete:()=>el.remove() });
}

function triggerAudioSabotage() {
  const sabotagePhrases = [
    { text: '¡Auxilio! ¡Mis oídos! 🙉 ¡Suena peor que un gallo en el mercado!', file: 'sabotage_reaction_0.mp3' },
    { text: '¡Qué horror! ¡Mis oídos! 🙉 ¡Apaguen eso por favor!', file: 'sabotage_reaction_1.mp3' },
    { text: '¡Uy no! ¡Esa distorsión dolió más que patada de mula! 🫏', file: 'sabotage_reaction_2.mp3' },
    { text: '¡Traigan tapones para los oídos! ¡Alguien está saboteando la frecuencia! 🚨', file: 'sabotage_reaction_3.mp3' },
    { text: '¡Suena horrible! ¡Eso no es música, es una tortura cibernética! 🤖', file: 'sabotage_reaction_4.mp3' }
  ];
  const choice = sabotagePhrases[Math.floor(Math.random() * sabotagePhrases.length)];
  axoloSay(choice.text, choice.file, 4000, true);

  RitmikaStyleFX.screenShake(14, 600);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:#f0047f; opacity:0; pointer-events:none; z-index:998;';
  document.body.appendChild(overlay);
  anime({ targets:overlay, opacity:[0,0.25,0], duration:550, easing:'easeInOutSine', complete:()=>overlay.remove() });
}

function animatePlayerJoin(player) {
  RitmikaStyleFX.confettiBurst(window.innerWidth / 2, window.innerHeight * 0.3, { count: 30 });
  setTimeout(() => RitmikaStyleFX.confettiBurst(window.innerWidth * 0.3, window.innerHeight * 0.5, { count: 15 }), 200);
  setTimeout(() => RitmikaStyleFX.confettiBurst(window.innerWidth * 0.7, window.innerHeight * 0.5, { count: 15 }), 400);
  ['🎉','🎊','⭐','✨'].forEach((emoji, i) => setTimeout(() => floatEmoji(emoji), i*80));
  setTimeout(() => RitmikaStyleFX.axoloNod(2), 300);
}

//  TÍO AXOLO CHARACTER CUT-IN SYSTEM (Persona style)
// ════════════════════════════════════════════
let currentAxoloAudio = null;
let axoloQueue = [];
let _axoloAudioDoneResolve = null;
let cutinTimeout = null;
let _queueDrainTimeout = null;

// Programmatic Web Audio Synthesizer — singleton AudioContext to avoid leaks
let _swooshCtx = null;
function playSwooshSound() {
  try {
    if (!_swooshCtx) _swooshCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_swooshCtx.state === 'suspended') _swooshCtx.resume();
    const ctx = _swooshCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.45);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn('Web Audio swoosh failed:', e);
  }
}

// Global Activation Logic for Character Cut-in
function triggerTioAxolCutin(texto, duracion = 4000, emocion = 'talking') {
  const bar = document.getElementById('axolo-cutin-bar');
  const portrait = document.getElementById('axolo-cutin-portrait');
  const textBox = document.getElementById('axolo-cutin-text');
  
  if (!bar || !portrait || !textBox) return;
  
  // Clear any existing timeout immediately
  if (cutinTimeout) {
    clearTimeout(cutinTimeout);
    cutinTimeout = null;
  }
  
  // 1. Map emotion to AI-generated assets and dynamic background colors
  let assetName = 'neutral';
  let bgColor = '#ffe600'; // Default Yellow
  
  if (emocion === 'laughing') {
    assetName = 'laughing';
    bgColor = '#f0047f'; // Magenta
  } else if (emocion === 'mischievous') {
    assetName = 'mischievous';
    bgColor = '#9b00ff'; // Purple
  } else if (emocion === 'sad') {
    assetName = 'sad';
    bgColor = '#1e293b'; // Slate Blue
  } else if (emocion === 'angry') {
    assetName = 'angry';
    bgColor = '#ef4444'; // Red
  } else if (emocion === 'singing') {
    assetName = 'singing';
    bgColor = '#22d3ee'; // Cyan
  }
  
  // Adjust text color for dark backgrounds
  if (emocion === 'sad') {
    textBox.style.color = '#ffffff';
    textBox.style.textShadow = '2px 2px 0px rgba(0,0,0,0.5)';
  } else {
    textBox.style.color = '#111827';
    textBox.style.textShadow = '2px 2px 0px rgba(255,255,255,0.4)';
  }
  
  // 2. Load the vignette asset and change style
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
  textBox.textContent = texto;
  
  // 3. Slide in (add active class, remove exit classes)
  bar.classList.remove('slide-out');
  bar.classList.add('active');
  
  // 5. If a numerical duration was passed, schedule auto-hide
  if (typeof duracion === 'number') {
    cutinTimeout = setTimeout(() => {
      hideTioAxolCutin();
    }, duracion);
  }
}

// Exit transition logic
function hideTioAxolCutin() {
  const bar = document.getElementById('axolo-cutin-bar');
  if (!bar || !bar.classList.contains('active')) return;
  
  if (cutinTimeout) {
    clearTimeout(cutinTimeout);
    cutinTimeout = null;
  }
  
  // Slide out to the right off-screen
  bar.classList.remove('active');
  bar.classList.add('slide-out');
  
  // Clear classes after transition finishes
  setTimeout(() => {
    bar.classList.remove('slide-out');
  }, 450);
}

// NOTA: inicializarQRConexion se define como async abajo (sección CONEXIÓN QR DINÁMICA)

const AXOLO_PRESET_MAP = {
  // Talking (Yellow background)
  'lobby_welcome.mp3': 'talking',
  'lobby_welcome_0.mp3': 'talking',
  'podium_intro_ceremony.mp3': 'laughing',
  'podium_award_gallo.mp3': 'laughing',
  'podium_award_tomate.mp3': 'laughing',
  'podium_reveal_third.mp3': 'talking',
  'podium_reveal_second.mp3': 'talking',
  'podium_winner_buildup.mp3': 'talking',
  'podium_winner_reveal.mp3': 'laughing',
  'lobby_welcome_1.mp3': 'talking',
  'lobby_welcome_2.mp3': 'talking',
  'lobby_welcome_3.mp3': 'talking',
  'lobby_welcome_4.mp3': 'talking',
  'room_ready.mp3': 'talking',
  'room_ready_0.mp3': 'talking',
  'room_ready_1.mp3': 'talking',
  'room_ready_2.mp3': 'talking',
  'room_ready_3.mp3': 'talking',
  'catalog_ready.mp3': 'talking',
  'catalog_ready_0.mp3': 'talking',
  'catalog_ready_1.mp3': 'talking',
  'catalog_ready_2.mp3': 'talking',
  'idle_0.mp3': 'talking',
  'idle_1.mp3': 'talking',
  'idle_2.mp3': 'talking',
  'idle_3.mp3': 'talking',
  'idle_4.mp3': 'talking',
  'idle_5.mp3': 'talking',
  'idle_6.mp3': 'talking',
  'idle_7.mp3': 'talking',
  'new_game.mp3': 'talking',
  'new_game_0.mp3': 'talking',
  'new_game_1.mp3': 'talking',
  'new_game_2.mp3': 'talking',
  'blackout_end.mp3': 'talking',
  'blackout_end_0.mp3': 'talking',
  'blackout_end_1.mp3': 'talking',
  'blackout_end_2.mp3': 'talking',
  'round_1_start.mp3': 'talking',
  'round_1_start_0.mp3': 'talking',
  'round_1_start_1.mp3': 'talking',
  
  // Mischievous (Purple background)
  'round_2_start.mp3': 'mischievous',
  'round_2_start_0.mp3': 'mischievous',
  'round_2_start_1.mp3': 'mischievous',
  'round_3_start.mp3': 'mischievous',
  'round_3_start_0.mp3': 'mischievous',
  'round_3_start_1.mp3': 'mischievous',
  'challenge_intro.mp3': 'mischievous',
  'challenge_intro_0.mp3': 'mischievous',
  'challenge_intro_1.mp3': 'mischievous',
  'challenge_intro_2.mp3': 'mischievous',
  'blackout_intro.mp3': 'mischievous',
  'blackout_intro_0.mp3': 'mischievous',
  'blackout_intro_1.mp3': 'mischievous',
  'blackout_intro_2.mp3': 'mischievous',
  'roulette_intro_3.mp3': 'mischievous',
  'roulette_spin.mp3': 'mischievous',
  'roulette_spin_0.mp3': 'mischievous',
  'roulette_spin_1.mp3': 'mischievous',
  'roulette_spin_2.mp3': 'mischievous',
  'podium_award_vengador.mp3': 'mischievous',
  
  // Laughing / Celebrating (Magenta background)
  'roulette_win.mp3': 'laughing',
  'roulette_win_0.mp3': 'laughing',
  'roulette_win_1.mp3': 'laughing',
  'roulette_win_2.mp3': 'laughing',
  'final_victory.mp3': 'laughing',
  'final_victory_0.mp3': 'laughing',
  'final_victory_1.mp3': 'laughing',
  'final_victory_2.mp3': 'laughing',
  'podium_climax.mp3': 'laughing',
  'podium_climax_0.mp3': 'laughing',
  'podium_climax_1.mp3': 'laughing',
  'podium_climax_2.mp3': 'laughing',

  // Angry / Sabotage (Red/Dark Magenta background)
  'audio_sabotage.mp3': 'angry',
  'sabotage_reaction.mp3': 'angry',
  'sabotage_reaction_0.mp3': 'angry',
  'sabotage_reaction_1.mp3': 'angry',
  'sabotage_reaction_2.mp3': 'angry',
  'sabotage_reaction_3.mp3': 'angry',
  'sabotage_reaction_4.mp3': 'angry',
};

// Deleted old unused mouth animators to keep logic modular
function startMouthAnimation() {}
function stopMouthAnimation() {}
function axoloTalk() {}
function setAxoloPreset() {}

function _playAxoloAudio(texto, audioFileOrMood) {
  const cleanName = audioFileOrMood.replace(/\.(wav|mp3)$/i, '') + '.mp3';
  const audioUrl = `./assets/audio/${cleanName}`;
  currentAxoloAudio = new Audio(audioUrl);

  const emotion = AXOLO_PRESET_MAP[audioFileOrMood] || 'talking';
  triggerTioAxolCutin(texto, 'manual', emotion);
  duckSfx();

  currentAxoloAudio.addEventListener('play', () => {
    duckSfx();
  }, { once: true });

  currentAxoloAudio.addEventListener('ended', function() {
    const self = this;
    window.welcomePlaying = false;
    hideTioAxolCutin();
    unduckSfx();
    if (_axoloAudioDoneResolve) {
      const cb = _axoloAudioDoneResolve;
      _axoloAudioDoneResolve = null;
      cb();
    }
    if (axoloQueue.length > 0) {
      const next = axoloQueue.shift();
      _queueDrainTimeout = setTimeout(() => { _queueDrainTimeout = null; _playAxoloAudio(next.text, next.audioFile); }, 400);
    } else {
      if (currentAxoloAudio === self) currentAxoloAudio = null;
    }
  }, { once: true });

  currentAxoloAudio.addEventListener('pause', () => {
    hideTioAxolCutin();
    unduckSfx();
  }, { once: true });

  currentAxoloAudio.addEventListener('error', function() {
    const self = this;
    window.welcomePlaying = false;
    console.warn('[Voice] Audio not found:', audioUrl);
    setTimeout(() => {
      if (currentAxoloAudio !== self) return;
      hideTioAxolCutin();
      unduckSfx();
      if (axoloQueue.length > 0) {
        const next = axoloQueue.shift();
        _queueDrainTimeout = setTimeout(() => { _queueDrainTimeout = null; _playAxoloAudio(next.text, next.audioFile); }, 400);
      } else {
        currentAxoloAudio = null;
      }
    }, 3000);
  }, { once: true });

  currentAxoloAudio.play().catch(e => {
    console.warn('[Voice] Autoplay blocked or audio load failed:', e);
    window.welcomePlaying = false;
    currentAxoloAudio = null;
    
    // Fallback: hide the cutin after a few seconds if audio failed
    setTimeout(() => {
      hideTioAxolCutin();
      unduckSfx();
      if (axoloQueue.length > 0) {
        const next = axoloQueue.shift();
        _queueDrainTimeout = setTimeout(() => { _queueDrainTimeout = null; _playAxoloAudio(next.text, next.audioFile); }, 400);
      }
      if (_axoloAudioDoneResolve) {
        const cb = _axoloAudioDoneResolve;
        _axoloAudioDoneResolve = null;
        cb();
      }
    }, 3000);
  });
}

function _stopCurrentAxolo() {
  if (window.welcomePlaying) return;
  if (_queueDrainTimeout) { clearTimeout(_queueDrainTimeout); _queueDrainTimeout = null; }
  if (currentAxoloAudio) {
    currentAxoloAudio.pause();
    currentAxoloAudio = null;
  }
  hideTioAxolCutin();
  unduckSfx();
  axoloQueue = [];
  if (_axoloAudioDoneResolve) {
    const cb = _axoloAudioDoneResolve;
    _axoloAudioDoneResolve = null;
    cb();
  }
}

async function hacerHablarAlAxolo(texto, audioFileOrMood = 'neutral', interrupt = false) {
  const isAudioFile = typeof audioFileOrMood === 'string' &&
                      (audioFileOrMood.endsWith('.wav') || audioFileOrMood.endsWith('.mp3'));

  if (!isAudioFile) {
    console.warn(`[Voice] No audio asset mapped for: "${texto}" (received: ${audioFileOrMood}). Staying silent.`);
    return false;
  }

  try {
    if (interrupt) {
      if (window.welcomePlaying) return false;
      _stopCurrentAxolo();
      _playAxoloAudio(texto, audioFileOrMood);
      return true;
    }

    if (currentAxoloAudio) {
      if (window.welcomePlaying) return false;
      axoloQueue.length = 0;
      axoloQueue.push({ text: texto, audioFile: audioFileOrMood });
      return true;
    }

    if (window.welcomePlaying) return false;
    _playAxoloAudio(texto, audioFileOrMood);
    return true;
  } catch (err) {
    console.error('[Voice] Error playing ElevenLabs audio asset:', err);
    return false;
  }
}

async function axoloSay(text, moodOrDuration = 'neutral', duration = 4000, interrupt = false) {
  let audioFile = 'neutral';
  let bubbleDur = duration;

  if (typeof moodOrDuration === 'number') {
    bubbleDur = moodOrDuration;
  } else if (typeof moodOrDuration === 'string') {
    audioFile = moodOrDuration;
  }

  // Intercept Emo Mode generic phrases
  if (typeof state !== 'undefined' && state.gameMode === 'emo' && typeof EMO_MODE_PHRASES !== 'undefined') {
    let override = null;
    if (audioFile.startsWith('lobby_welcome')) {
      override = EMO_MODE_PHRASES.welcome[Math.floor(Math.random() * EMO_MODE_PHRASES.welcome.length)];
    } else if (audioFile.startsWith('sabotage_reaction')) {
      override = EMO_MODE_PHRASES.sabotage[0];
    } else if (audioFile.startsWith('award_tomate')) {
      override = EMO_MODE_PHRASES.sabotage[1];
    }
    
    if (override) {
      text = override.text;
      audioFile = override.file;
    }
  }

  const spokeWithAudio = await hacerHablarAlAxolo(text, audioFile, interrupt);

  if (!spokeWithAudio) {
    const emotion = AXOLO_PRESET_MAP[audioFile] || (typeof moodOrDuration === 'string' ? moodOrDuration : 'talking');
    triggerTioAxolCutin(text, bubbleDur, emotion);
  }
}


// Idle phrases
const idlePhrases = [
  { text: '¡Afinen esa voz, banda! 🎵', file: 'idle_0.mp3' },
  { text: '¿Listos para la carrilla? 😈', file: 'idle_1.mp3' },
  { text: '¡El que no canta, toma! 🍹', file: 'idle_2.mp3' },
  { text: '¡El Palenque los espera! 🏆', file: 'idle_3.mp3' },
  { text: '¿Qué esperan para darle al botón de jugar? ¡Me estoy secando! 🦎', file: 'idle_4.mp3' },
  { text: 'Saquen las botanas en lo que se deciden a empezar. 🍕', file: 'idle_5.mp3' },
  { text: 'Tengo el micrófono listo y el autotune apagado, apúrense. 🎚️', file: 'idle_6.mp3' },
  { text: '¡El público se impacienta y yo también! ¡Vamos a darle! 📣', file: 'idle_7.mp3' },
];
let phraseIdx = 0;
let idleInterval = setInterval(() => {
  if (state.round === 0) {
    const lobbyScreen = document.getElementById('lobby-screen');
    if (!lobbyScreen || !lobbyScreen.classList.contains('active')) return;
    let currentPhrases = idlePhrases;
    if (typeof state !== 'undefined' && state && state.gameMode === 'emo' && typeof EMO_MODE_PHRASES !== 'undefined' && EMO_MODE_PHRASES.idle) {
      currentPhrases = EMO_MODE_PHRASES.idle;
    }
    const choice = currentPhrases[phraseIdx++ % currentPhrases.length];
    axoloSay(choice.text, choice.file);
  }
}, 8000);
// ════════════════════════════════════════════
//  CONEXIÓN QR DINÁMICA
// ════════════════════════════════════════════
async function inicializarQRConexion() {
  const canvas = document.getElementById('qr-conexion-sala');
  if (!canvas) { console.warn('[QR] Canvas no encontrado en DOM'); return; }

  const port = window.location.port || '3000';
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  const isLocal = hostname === 'localhost' || 
                  hostname === '127.0.0.1' || 
                  hostname.startsWith('192.168.') || 
                  hostname.startsWith('10.') || 
                  hostname.startsWith('172.16.') || 
                  hostname.startsWith('172.17.') || 
                  hostname.startsWith('172.18.') || 
                  hostname.startsWith('172.19.') || 
                  hostname.startsWith('172.20.') || 
                  hostname.startsWith('172.21.') || 
                  hostname.startsWith('172.22.') || 
                  hostname.startsWith('172.23.') || 
                  hostname.startsWith('172.24.') || 
                  hostname.startsWith('172.25.') || 
                  hostname.startsWith('172.26.') || 
                  hostname.startsWith('172.27.') || 
                  hostname.startsWith('172.28.') || 
                  hostname.startsWith('172.29.') || 
                  hostname.startsWith('172.30.') || 
                  hostname.startsWith('172.31.') || 
                  hostname.endsWith('.local') ||
                  protocol === 'file:';

  let joinUrl;
  if (!isLocal && protocol !== 'file:') {
    joinUrl = `${window.location.origin}/join?code=${state.roomCode || ''}`;
  } else {
    joinUrl = `http://${state.localIP || hostname}:${port}/join?code=${state.roomCode || ''}`;
  }

  // Mostrar texto del URL inmediatamente como fallback
  const textoInstruccion = document.getElementById('texto-instruccion-unirse');
  if (textoInstruccion) {
    textoInstruccion.innerHTML = `Escanea el código QR o ingresa desde tu móvil a: <br/><span class="text-cyan-400 font-bold text-lg">${joinUrl}</span>`;
  }

  try {
    await QRCode.toCanvas(canvas, joinUrl, {
      width: 180,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    console.log('[QR] Canvas renderizado para:', joinUrl);
  } catch (err) {
    console.error('[QR] Error al generar el código QR de vinculación de sala:', err);
    // Fallback visual: mostrar el código de sala grande
    if (textoInstruccion) {
      textoInstruccion.innerHTML = `Código de sala: <span style="color:#ffe600; font-weight:900; font-size:1.8rem; letter-spacing:0.2em;">${state.roomCode || ''}</span><br/><span class="text-sm" style="color:#94a3b8;">Ingresa desde tu móvil a: <br/><span class="text-cyan-400 font-bold">${joinUrl}</span></span>`;
    }
  }
}



// ════════════════════════════════════════════
//  PARTICLES BACKGROUND
// ════════════════════════════════════════════
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx    = canvas.getContext('2d', { alpha: true });
  let W, H;
  const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  window.addEventListener('resize', resize); resize();
  const COLORS = ['#ec489933','#22d3ee33','#a855f733','#facc1522'];
  const particles = Array.from({ length: 35 }, () => ({
    x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.5+0.5,
    vx:(Math.random()-0.5)*0.3, vy:-(Math.random()*0.4+0.1),
    color: COLORS[Math.floor(Math.random()*COLORS.length)],
    alpha: Math.random()*0.7+0.3, life:0, maxLife: Math.random()*300+200,
  }));
  let rafId = null;
  let lastTs = 0;
  const FPS_INTERVAL = 1000 / 60;
  function draw(ts) {
    if (document.hidden) { rafId = null; return; }
    rafId = requestAnimationFrame(draw);
    const elapsed = ts - lastTs;
    if (elapsed < FPS_INTERVAL) return;
    lastTs = ts - (elapsed % FPS_INTERVAL);
    ctx.clearRect(0,0,W,H);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life++;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha*(1-p.life/p.maxLife); ctx.fill();
      if (p.life >= p.maxLife || p.y < 0) {
        p.x = Math.random()*W; p.y = H+10; p.life = 0; p.maxLife = Math.random()*300+200;
      }
    }
    ctx.globalAlpha = 1;
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !rafId) rafId = requestAnimationFrame(draw);
  });
  rafId = requestAnimationFrame(draw);
})();

// ════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════
function escapeHtml(str='') {
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}



/* Debug: presiona Ctrl+Shift+D para podio de prueba (solo desarrollo) */
// ── Keyboard shortcuts central ──────────────────────────────
document.addEventListener('keydown', e => {
  // Ctrl+Shift+S → Skip song (during karaoke)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (document.getElementById('karaoke-screen').classList.contains('active')) {
      const sq = state.singerQueue.length ? state.singerQueue : state.players.filter(p => !p.disconnected);
      const currentPlayer = sq[state.currentSingerIdx % sq.length] || sq[0];
      if (currentPlayer) startVotePhase(currentPlayer, state.currentSong);
    }
  }
  // Ctrl+Shift+P → Podium test (quick jump to end game)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    state.players = [
      { socketId: 'mock1', name: 'El Taquero', avatarId: 0, score: 350, genres: ['reggaeton'], artists: [], tomatazos: 1 },
      { socketId: 'mock2', name: 'La Chilena', avatarId: 1, score: 280, genres: ['banda'], artists: [], tomatazos: 4 },
      { socketId: 'mock3', name: 'Tequilita', avatarId: 2, score: 190, genres: ['pop'], artists: [], tomatazos: 0 },
      { socketId: 'mock4', name: 'Cumbiambero', avatarId: 4, score: 80, genres: ['cumbia'], artists: [], tomatazos: 2 }
    ];
    state.round = 3;
    showPodium();
  }
});

document.getElementById('btn-debug-skip-song').addEventListener('click', () => {
  const sq = state.singerQueue.length ? state.singerQueue : state.players.filter(p => !p.disconnected);
  const currentPlayer = sq[state.currentSingerIdx % sq.length] || sq[0];
  if (currentPlayer) startVotePhase(currentPlayer, state.currentSong);
});
