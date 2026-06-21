// ═══ CONSTANTES ═══
// Módulo extraído de tv.html
// ==============================================

// ════════════════════════════════════════════
//  CATALOG & FALLBACK
// ════════════════════════════════════════════
let bootMusic;

// Fallback catalog — used when API returns empty or fails
const FALLBACK_CATALOG = [
  { id:'f1', title:'La Incondicional',      artist:'Luis Miguel',          genre:'balada',   url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:210 },
  { id:'f2', title:'Amor Eterno',           artist:'Rocío Durcal',         genre:'balada',   url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:195 },
  { id:'f3', title:'La Chona',              artist:'Los Tucanes de Tijuana',genre:'banda',    url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:180 },
  { id:'f4', title:'El Rey',                artist:'Vicente Fernández',     genre:'ranchera', url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:200 },
  { id:'f5', title:'Gasolina',              artist:'Daddy Yankee',          genre:'reggaeton',url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:190 },
  { id:'f6', title:'Oye Mi Amor',           artist:'Maná',                  genre:'rock',     url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:215 },
  { id:'f7', title:'No Me Doy Por Vencido', artist:'Luis Fonsi',            genre:'pop',      url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:220 },
  { id:'f8', title:'Quiero Más',            artist:'Shakira',               genre:'pop',      url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:185 },
  { id:'f9', title:'Gimme! Gimme! Gimme!', artist:'ABBA',                  genre:'pop',      url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:240 },
  { id:'f10',title:'La Bicicleta',          artist:'Carlos Vives',          genre:'cumbia',   url:'https://www.w3schools.com/html/mov_bbb.mp4',  duration:195 },
];

// ════════════════════════════════════════════
//  BOOTLOADER STATE MACHINE
// ════════════════════════════════════════════
const boot = {
  steps: { 1: false, 2: false, 3: false, 4: false, 5: false },
  queue: [],
  processing: false,
  step(n, state, detail) {
    this.queue.push({n, state, detail});
    this.processQueue();
  },
  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    while(this.queue.length > 0) {
      while (!window.bootloaderVisible) {
        await new Promise(r => setTimeout(r, 100));
      }

      const item = this.queue.shift();
      const n = item.n;
      const state = item.state;
      const detail = item.detail;
      
      const el = document.getElementById('boot-step-' + n);
      const icon = document.getElementById('boot-icon-' + n);
      const det = document.getElementById('boot-detail-' + n);
      if (!el) continue;

      el.className = 'boot-check ' + state;
      if (state === 'active') { icon.textContent = '🔄'; el.querySelector('.boot-check-text').style.color = '#facc15'; }
      if (state === 'done') { icon.textContent = '✅'; this.steps[n] = true; el.querySelector('.boot-check-text').style.color = '#22c55e'; }
      if (state === 'error') { icon.textContent = '❌'; el.querySelector('.boot-check-text').style.color = '#ef4444'; }
      if (det && detail) det.textContent = detail;
      
      this.checkAll();
      
      // Delay visual para asegurar que las animaciones "premium" se aprecian
      // 800ms por cambio de estado
      await new Promise(r => setTimeout(r, 800));
    }
    this.processing = false;
  },
  checkAll() {
    if (this.steps[1] && this.steps[2] && this.steps[3] && this.steps[4] && !this.steps[5] && !this.simulating5) {
      this.simulating5 = true;
      this.step(5, 'active', 'Inicializando recursos premium...');
      this.step(5, 'active', 'Cargando modelos acústicos...');
      this.step(5, 'active', 'Afinando instrumentos del Tío Axolo...');
      this.step(5, 'active', 'Renderizando texturas 4K...');
      this.step(5, 'done', 'Motor gráfico y de audio listo');
      _audioPreloader.start();
      return;
    }
    const allDone = Object.values(this.steps).every(v => v);
    if (!allDone) return;
    const screen = document.getElementById('bootloader-screen');
    if (screen && screen.style.display === 'none') return;
    if (document.getElementById('start-show-btn')) return;

    const banner = document.getElementById('boot-done');
    const lobby = document.getElementById('lobby-screen');
    if (banner) banner.classList.add('show');
    
    const startBtn = document.createElement('button');
    startBtn.id = 'start-show-btn';
    startBtn.className = 'jb-yellow font-paytone text-3xl px-12 py-4 jb-card';
    startBtn.style.cursor = 'pointer';
    startBtn.style.position = 'absolute';
    startBtn.style.top = '50%';
    startBtn.style.left = '50%';
    startBtn.style.transform = 'translate(-50%, calc(-50% + 40px))';
    startBtn.style.zIndex = '9999';
    startBtn.textContent = '▶ INICIAR EL SHOW';
    startBtn.onclick = () => {
      startBtn.remove();
      if (banner) banner.classList.remove('show');
      _resumeAudioContext();
      
      // Unlock HTML5 Audio globally using a silent 1ms WAV file
      try {
        const unlockAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        unlockAudio.play().catch(()=>{});
      } catch(e) {}

      if (typeof bootMusic !== 'undefined' && bootMusic) bootMusic.play().catch(()=>{});
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(()=>{});
      }

      setTimeout(() => {
        // ══════════════════════════════════════════════
        // JACKBOX-STYLE WIPE TRANSITION
        // ══════════════════════════════════════════════
        if (bootMusic && !bootMusic.paused) {
          const fadeSteps = 30;
          const fadeInterval = 50;
          const targetVol = 0.06;
          const volStep = (bootMusic.volume - targetVol) / fadeSteps;
          let step = 0;
          const fadeOut = setInterval(() => {
            step++;
            bootMusic.volume = Math.max(targetVol, bootMusic.volume - volStep);
            if (step >= fadeSteps) {
              clearInterval(fadeOut);
              bootMusic.volume = targetVol;
            }
          }, fadeInterval);
        }

        const wipeContainer = document.createElement('div');
        wipeContainer.style.cssText = 'position:fixed;inset:0;z-index:999999;pointer-events:none;overflow:hidden;display:flex;';
        
        const leftWipe = document.createElement('div');
        leftWipe.style.cssText = 'position:absolute;top:0;left:-70%;width:70%;height:100%;background:#00e5ff;transform:skewX(12deg);border-right:15px solid #111827;box-shadow:20px 0 0 #111827;';
        
        const rightWipe = document.createElement('div');
        rightWipe.style.cssText = 'position:absolute;top:0;right:-70%;width:70%;height:100%;background:#ec4899;transform:skewX(12deg);border-left:15px solid #111827;box-shadow:-20px 0 0 #111827;';
        
        const centerLogo = document.createElement('div');
        centerLogo.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);font-family:"Paytone One",sans-serif;font-size:7rem;color:#ffe600;text-shadow:8px 8px 0 #111827, 0 0 40px rgba(0,0,0,0.8);z-index:10;white-space:nowrap;letter-spacing:4px;';
        centerLogo.textContent = '¡A JUGAR!';

        wipeContainer.appendChild(leftWipe);
        wipeContainer.appendChild(rightWipe);
        wipeContainer.appendChild(centerLogo);
        document.body.appendChild(wipeContainer);

        try { if(typeof UISounds !== 'undefined') UISounds.whoosh(); } catch(e){}

        if (typeof anime !== 'undefined') {
          anime({ targets: leftWipe, left: '-10%', duration: 450, easing: 'easeOutExpo' });
          anime({ targets: rightWipe, right: '-10%', duration: 450, easing: 'easeOutExpo' });
          
          setTimeout(() => {
            try { if(typeof UISounds !== 'undefined') UISounds.stinger(); } catch(e){}
            anime({ targets: centerLogo, scale: [0, 1.2, 1], rotate: ['-5deg', '5deg', '0deg'], duration: 800, easing: 'easeOutElastic(1, .5)' });
            
            const modeScreen = document.getElementById('mode-selection-screen');
            if (screen) { 
              screen.style.display = 'none'; 
              if (typeof destroyBootloader === 'function') destroyBootloader();
            }
            if (modeScreen) { modeScreen.classList.add('active'); }

            setTimeout(() => {
              try { if(typeof UISounds !== 'undefined') UISounds.whoosh(); } catch(e){}
              anime({ targets: leftWipe, left: '-100%', duration: 600, easing: 'easeInExpo' });
              anime({ targets: rightWipe, right: '-100%', duration: 600, easing: 'easeInExpo' });
              anime({ targets: centerLogo, scale: 0, duration: 400, easing: 'easeInExpo' });
              
              setTimeout(() => {
                wipeContainer.remove();
                if (typeof axoloSay === 'function' && typeof MODES_WELCOME_PHRASES !== 'undefined') {
                  const mwChoice = MODES_WELCOME_PHRASES[Math.floor(Math.random() * MODES_WELCOME_PHRASES.length)];
                  setTimeout(() => {
                    axoloSay(mwChoice.text, mwChoice.file);
                    window.welcomePlaying = true;
                    setTimeout(() => { window.welcomePlaying = false; }, 45000);
                  }, 800);
                }
              }, 700);
            }, 1400);
          }, 400);
        } else {
          if (screen) {
            screen.style.display = 'none';
            if (typeof destroyBootloader === 'function') destroyBootloader();
          }
          const modeScreen = document.getElementById('mode-selection-screen');
          if (modeScreen) { modeScreen.classList.add('active'); }
          wipeContainer.remove();
        }
      }, 120);
    }; // Fin onclick
    
    const bootContent = document.querySelector('.boot-content');
    if (bootContent) bootContent.appendChild(startBtn);
  },
  fail(n, msg) {
    const el = document.getElementById('boot-step-' + n);
    const icon = document.getElementById('boot-icon-' + n);
    const det = document.getElementById('boot-detail-' + n);
    if (!el) return;
    el.className = 'boot-check error';
    icon.textContent = '❌';
    el.querySelector('.boot-check-text').style.color = '#ef4444';
    if (det) det.textContent = msg;
    document.getElementById('boot-retry').style.display = 'block';
  }
};
boot.step(1, 'active');

// ─── Audio Preloader ──────────────────────────
// Downloads all MP3s into browser cache during bootloader so they play instantly later
const _audioPreloader = {
  _queue: [],
  _active: 0,
  _maxConcurrent: 6,
  _started: false,
  _total: 0,
  _loaded: 0,
  async start() {
    if (this._started) return;
    this._started = true;
    try {
      const res = await fetch('/api/audio-files');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const files = await res.json();
      if (!Array.isArray(files)) throw new Error('Invalid response');
      this._total = files.length;
      this._queue = files.map(f => './assets/audio/' + f);
      this._processQueue();
    } catch (e) {
      console.warn('[Preloader] Could not fetch audio list:', e.message);
    }
  },
  _processQueue() {
    while (this._active < this._maxConcurrent && this._queue.length > 0) {
      const url = this._queue.shift();
      this._active++;
      this._preloadOne(url);
    }
  },
  _preloadOne(url) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.addEventListener('canplaythrough', () => {
      this._loaded++;
      this._active--;
      this._updateDetail();
      this._processQueue();
    }, { once: true });
    audio.addEventListener('error', () => {
      this._active--;
      this._processQueue();
    }, { once: true });
    audio.load();
  },
  _updateDetail() {
    const det = document.getElementById('boot-detail-5');
    if (det && this._total > 0) {
      det.textContent = 'Precargando audio: ' + this._loaded + '/' + this._total;
    }
  }
};

// ─── Audio Context Resume ──
// Browsers block AudioContext until user gesture; this forces resume on first interaction
let _audioCtxResumed = false;
function _resumeAudioContext() {
  if (_audioCtxResumed) return;
  _audioCtxResumed = true;
  try {
    if (window.AudioContext || window.webkitAudioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    }
  } catch(e) {}
}

function _setupFirstInteraction() {
  const handler = () => {
    _resumeAudioContext();
    document.removeEventListener('click', handler);
    document.removeEventListener('touchstart', handler);
    document.removeEventListener('keydown', handler);
  };
  document.addEventListener('click', handler, { once: true });
  document.addEventListener('touchstart', handler, { once: true });
  document.addEventListener('keydown', handler, { once: true });
}

function _initConstants() {
  bootMusic = document.getElementById('boot-music');
  const preBootScreen = document.getElementById('pre-boot-screen');
  const enterBtn = document.getElementById('enter-ritmika-btn');

  if (preBootScreen && enterBtn) {
    enterBtn.onclick = () => {
      _resumeAudioContext();
      try {
        const unlockAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        unlockAudio.play().catch(()=>{});
      } catch(e) {}
      
      preBootScreen.style.display = 'none';
      window.bootloaderVisible = true;
      if (bootMusic) {
        bootMusic.volume = 0.4;
        bootMusic.play().catch(()=>{});
      }
      _setupFirstInteraction();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(()=>{});
      }
    };
  } else {
    if (bootMusic) {
      bootMusic.volume = 0.4;
      bootMusic.play().catch(()=>{});
    }
    window.bootloaderVisible = true;
    _setupFirstInteraction();
  }
}
_initConstants();

async function loadCatalog(retries = 3) {
  console.log('[Bootloader] loadCatalog() called');
  const catalogInfo = document.getElementById('catalog-info');
  boot.step(3, 'active');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const health = await res.json();
      if (health.catalog && health.catalogCount > 0) {
        const msg = '📀 ' + health.catalogCount + ' canciones disponibles';
        if (catalogInfo) catalogInfo.textContent = msg;
        try { updateTicker(msg); } catch (_) {}
        console.log('[Catálogo] OK:', health.catalogCount, 'canciones en DB');
        boot.step(3, 'done', health.catalogCount + ' canciones');
        return;
      } else {
        throw new Error('Catálogo vacío en servidor');
      }
    } catch (e) {
      console.error('[Catálogo] Intento ' + attempt + '/' + retries + ' falló:', e.message);
      if (attempt < retries) {
        if (catalogInfo) catalogInfo.textContent = '⚠️ Reintento ' + attempt + '/' + retries + ': ' + e.message;
        await new Promise(r => setTimeout(r, 3000));
      } else {
        const msg = '⚠️ Error: ' + e.message + ' — Se usarán canciones demo';
        if (catalogInfo) catalogInfo.textContent = msg;
        try { updateTicker(msg); } catch (_) {}
        console.warn('[Catálogo] Usando fallback tras', retries, 'intentos:', e.message);
        boot.step(3, 'done', '0 (demo)');
      }
    }
  }
}
window.reloadCatalog = function() { loadCatalog(3); };

// Pick best song for a player based on preferences (server-side filtering)
async function pickSongForPlayer(player) {
  function getExclude() {
    return state.songQueue.length > 0 ? state.songQueue.join(',') : '';
  }

  // Ronda 2: usar canción asignada por otro jugador (Fuego Cruzado)
  const assigned = state.assignedSongs[player.socketId];
  if (assigned) {
    delete state.assignedSongs[player.socketId];
    try {
      const res = await fetch('/api/songs?id=' + encodeURIComponent(assigned.songId));
      if (res.ok) {
        const song = await res.json();
        if (song && song.id && !state.songQueue.includes(song.id)) {
          state.songQueue.push(song.id);
          saveGameState();
          return song;
        }
      }
    } catch (_) {}
  }

  const playerGenres  = (player.genres || []).map(g => g.toLowerCase()).filter(Boolean);
  const playerArtists = (player.artists || []).map(a => a.toLowerCase()).filter(Boolean);

  // Priority 1: artist match (server-side filtering + random pick)
  if (playerArtists.length > 0) {
    try {
      let url = '/api/songs?artists=' + encodeURIComponent(playerArtists.join(',')) + '&random=true&limit=1';
      if (getExclude()) url += '&exclude=' + encodeURIComponent(getExclude());
      const res = await fetch(url);
      if (res.ok) {
        const songs = await res.json();
        if (songs && songs.length > 0) {
          state.songQueue.push(songs[0].id);
          saveGameState();
          return songs[0];
        }
      }
    } catch (_) {}
  }

  // Priority 2: genre match (server-side filtering + random pick)
  if (playerGenres.length > 0) {
    try {
      let url = '/api/songs?genres=' + encodeURIComponent(playerGenres.join(',')) + '&random=true&limit=1';
      if (getExclude()) url += '&exclude=' + encodeURIComponent(getExclude());
      const res = await fetch(url);
      if (res.ok) {
        const songs = await res.json();
        if (songs && songs.length > 0) {
          state.songQueue.push(songs[0].id);
          saveGameState();
          return songs[0];
        }
      }
    } catch (_) {}
  }

  // Priority 3: any random song (reset songQueue if exhausted)
  state.songQueue = [];
  try {
    const res = await fetch('/api/songs?random=true&limit=1');
    if (res.ok) {
      const songs = await res.json();
      if (songs && songs.length > 0) {
        state.songQueue.push(songs[0].id);
        saveGameState();
        return songs[0];
      }
    }
  } catch (_) {}

  // Priority 4: fallback to local demo catalog (filter by genre if available)
  let fallbackPool = FALLBACK_CATALOG.filter(s => !state.songQueue.includes(s.id));
  const fallbackGenrePool = playerGenres.length > 0
    ? fallbackPool.filter(s => playerGenres.includes(s.genre.toLowerCase()))
    : [];
  fallbackPool = fallbackGenrePool.length > 0 ? fallbackGenrePool : fallbackPool;
  if (fallbackPool.length > 0) {
    const song = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    state.songQueue.push(song.id);
    saveGameState();
    return song;
  }
  // If all fallback songs exhausted, reset and repeat
  const resetSong = FALLBACK_CATALOG[Math.floor(Math.random() * FALLBACK_CATALOG.length)];
  state.songQueue = [resetSong.id];
  saveGameState();
  return resetSong;
}

// ════════════════════════════════════════════
//  GAME STATE
// ════════════════════════════════════════════
const AVATARS = [
  { id:0, emoji:'🌮', label:'Taco Rockero',      color:'#f97316', border:'#ea580c', img:'./assets/avatars/avatar_0_taco_rockero.webp' },
  { id:1, emoji:'🌶️', label:'Chile Enmascarado', color:'#ef4444', border:'#dc2626', img:'./assets/avatars/avatar_1_chile_enmascarado.webp' },
  { id:2, emoji:'🍹', label:'Tequila Fiestero',  color:'#a855f7', border:'#9333ea', img:'./assets/avatars/avatar_2_tequila_fiestero.webp' },
  { id:3, emoji:'⭐', label:'Estrella de Rock',  color:'#facc15', border:'#eab308', img:'./assets/avatars/avatar_3_estrella_rock.webp' },
  { id:4, emoji:'🦜', label:'Loro Cumbiambero',  color:'#22c55e', border:'#16a34a', img:'./assets/avatars/avatar_4_loro_cumbiambero.webp' },
  { id:5, emoji:'🎸', label:'Guitarra Mágica',   color:'#3b82f6', border:'#2563eb', img:'./assets/avatars/avatar_5_guitarra_magica.webp' },
  { id:6, emoji:'👑', label:'Rey del Palenque',  color:'#ec4899', border:'#db2777', img:'./assets/avatars/avatar_6_rey_palenque.webp' },
  { id:7, emoji:'🐙', label:'Pulpo Salsero',     color:'#06b6d4', border:'#0891b2', img:'./assets/avatars/avatar_7_pulpo_salsero.webp' },
];
const getAvatar = id => AVATARS[id] || AVATARS[0];

const RETO_CHALLENGES = [
  '¡Canta llorando a moco tendido! 😭',
  '¡Canta como si fueras T-Rex con brazos cortos! 🦖',
  '¡Canta solo con vocales, sin consonantes! 🗣️',
  '¡Canta poniendo tu mejor voz de telenovela! 🎭',
  '¡Canta susurrando como si hubiera un bebé dormido! 🤫',
  '¡Canta haciendo sentadillas al mismo tiempo! 💪',
  '¡Canta con acento de otro país! 🌍',
  '¡Canta con la boca llena de aire de pez globo! 🐡',
  '¡Canta con los ojos cerrados y sin moverte! 🧘',
  '¡Canta solo la mitad de cada palabra! 🤐',
];

// ════════════════════════════════════════════
//  FRASES POR GÉNERO — Personalidad del Tío Axolo
// ════════════════════════════════════════════
const GENRE_BARKS = {
  reggaeton: [
    { text: '¡Perreo intelectual, la neta! 🍑🔥', file: 'genre_reggaeton_0.mp3' },
    { text: '¡El Benito estaría orgulloso... o llorando! 🎤', file: 'genre_reggaeton_1.mp3' },
    { text: '¡Más sabor que un trompo al pastor! 🌮', file: 'genre_reggaeton_2.mp3' },
    { text: '¡Eso no era nota, era accidente de tráfico musical! 🚗💥', file: 'genre_reggaeton_3.mp3' },
    { text: '¡Tiembla Bellakath, que ya te salió competencia de la buena! 🐱', file: 'genre_reggaeton_4.mp3' },
    { text: '¡Traes el flow pesado, pero el micrófono te quedó un poco ligero! 💸', file: 'genre_reggaeton_5.mp3' },
    { text: '¡Eso sí es chacaleo del bueno, mi estimado ajolote! 🐊', file: 'genre_reggaeton_6.mp3' },
    { text: '¡Flow de tianguis de domingo: barato pero con mucho estilo! 🛍️', file: 'genre_reggaeton_7.mp3' },
    { text: '¡Eso fue puro dembow de la vieja escuela... o de la prepa! 🎒', file: 'genre_reggaeton_8.mp3' },
    { text: '¡Nos pusiste a perrear hasta el subsuelo, carnal! 🕺', file: 'genre_reggaeton_9.mp3' },
    { text: '¡Hasta Yandel se asustó con ese perreo! 😱', file: 'genre_reggaeton_10.mp3' },
    { text: '¡Esa nota estuvo más abajo que el subsuelo, rey! ⬇️', file: 'genre_reggaeton_11.mp3' },
    { text: '¡Le metiste más autotune que J Balvin en concierto! 🤖', file: 'genre_reggaeton_12.mp3' },
    { text: '¡Con ese flow no pasas ni del casting de Venga la Alegría! 📺', file: 'genre_reggaeton_13.mp3' },
    { text: '¡Te faltó calle, perro, pero sobró actitud! 🐶', file: 'genre_reggaeton_14.mp3' },
    { text: '¡Traes el ritmo en la sangre, pero la sangre de horchata! 🥤', file: 'genre_reggaeton_15.mp3' },
    { text: '¡Eso fue un perreo galáctico, nos mandaste a volar de lo feo! 🚀', file: 'genre_reggaeton_16.mp3' },
    { text: '¡Mejor dedícate a otra cosa, el dembow no te quiere! 🛑', file: 'genre_reggaeton_17.mp3' },
    { text: '¡Ese autotune pide a gritos la jubilación anticipada! 👴', file: 'genre_reggaeton_18.mp3' },
    { text: '¡Ni Maluma baby se atrevería a soltar ese desastre! 👶', file: 'genre_reggaeton_19.mp3' }
  ],
  banda: [
    { text: '¡El Recodo te manda sus condolencias! 🎺😂', file: 'genre_banda_0.mp3' },
    { text: '¡Eso sonó más raro que tuba en discoteca! 🪗', file: 'genre_banda_1.mp3' },
    { text: '¡El palenque está llorando... de risa! 🤠', file: 'genre_banda_2.mp3' },
    { text: '¡Eso fue banda, pero más bien banda ancha de desafine! 📡', file: 'genre_banda_3.mp3' },
    { text: '¡Siento que me caigo de la troca con semejantes notas! 🛻', file: 'genre_banda_4.mp3' },
    { text: '¡Sírvanme otro mezcal para aguantar la segunda estrofa! 🥃', file: 'genre_banda_5.mp3' },
    { text: '¡Ese grito dolió más que la cruda del lunes! 🥴', file: 'genre_banda_6.mp3' },
    { text: '¡Hasta a Chuy Lizárraga se le salieron las lágrimas de oírte! 😢', file: 'genre_banda_7.mp3' },
    { text: '¡Traes todo el sentimiento del rancho, lástima el afinador! 🌾', file: 'genre_banda_8.mp3' },
    { text: '¡Eso sonó a banda sinaloense, pero después de un terremoto! 🌋', file: 'genre_banda_9.mp3' },
    { text: '¡Julión Álvarez te mandó bloquear de WhatsApp! 🚫', file: 'genre_banda_10.mp3' },
    { text: '¡Parece que estabas arreando vacas en vez de cantar! 🐄', file: 'genre_banda_11.mp3' },
    { text: '¡Esa trompeta sonó a elefante constipado! 🐘', file: 'genre_banda_12.mp3' },
    { text: '¡Ni con seis caguamas te sale bien esa rola! 🍻', file: 'genre_banda_13.mp3' },
    { text: '¡Si fueras del Recodo, ya te habrían regresado al rancho! 🚜', file: 'genre_banda_14.mp3' },
    { text: '¡Con ese ritmo espantaste hasta a las moscas del establo! 🪰', file: 'genre_banda_15.mp3' },
    { text: '¡Suena a banda del recodo... pero en un simulacro de sismo! 🚨', file: 'genre_banda_16.mp3' },
    { text: '¡Te juro que la tambora lloró cuando empezaste a cantar! 🥁', file: 'genre_banda_17.mp3' },
    { text: '¡Ay dolor! Ya me volviste a dar, pero en los tímpanos. 🤕', file: 'genre_banda_18.mp3' },
    { text: '¡El sombrero te queda grande y la canción también, compa! 🤠', file: 'genre_banda_19.mp3' }
  ],
  ranchera: [
    { text: '¡Don Vicente te escuchó y pidió otro tequila! 🥃', file: 'genre_ranchera_0.mp3' },
    { text: '¡Eso estuvo tan emocionante que se me fue el hipo! 😭', file: 'genre_ranchera_1.mp3' },
    { text: '¡El charro más valiente no aguantó esa nota! 🐎', file: 'genre_ranchera_2.mp3' },
    { text: '¡Gritaste el gallo antes de que saliera el sol! 🐓', file: 'genre_ranchera_3.mp3' },
    { text: '¡Se me hace que ese mariachi era de mentiras, carnal! 🎺', file: 'genre_ranchera_4.mp3' },
    { text: '¡Cantas con el sentimiento de quien debe la tanda! 💸', file: 'genre_ranchera_5.mp3' },
    { text: '¡Esa nota estuvo más desafinada que guitarra de Garibaldi! 🎸', file: 'genre_ranchera_6.mp3' },
    { text: '¡Con ese grito espantaste a los caballos del patrón! 🐴', file: 'genre_ranchera_7.mp3' },
    { text: '¡Le pusiste garra, pero nos quedamos sin gallinero de tanto gallo! 🐔', file: 'genre_ranchera_8.mp3' },
    { text: '¡Para cantar así se necesita tequila, mezcal y mucha anestesia! 💉', file: 'genre_ranchera_9.mp3' },
    { text: '¡Ese mariachi ya pidió asilo político en otro lado! 🏃', file: 'genre_ranchera_10.mp3' },
    { text: '¡Hasta los agaves se secaron con ese falsete! 🌵', file: 'genre_ranchera_11.mp3' },
    { text: '¡Le echaste más crema que a los tacos, pero sin sabor! 🌮', file: 'genre_ranchera_12.mp3' },
    { text: '¡Don Chente desde el cielo te está mandando un rayo! ⚡', file: 'genre_ranchera_13.mp3' },
    { text: '¡Se me rompió el jarrito de barro de puro dolor auditivo! 🏺', file: 'genre_ranchera_14.mp3' },
    { text: '¡Por tu culpa el mariachi loco quiere dejar de bailar! 💃', file: 'genre_ranchera_15.mp3' },
    { text: '¡Traes dolor, traes despecho, pero te falta garganta! 🗣️', file: 'genre_ranchera_16.mp3' },
    { text: '¡Pobre caballo blanco, de escucharte ya no quiso correr! 🐎', file: 'genre_ranchera_17.mp3' },
    { text: '¡Ese grito de mariachi sonó a llanta frenando en seco! 🚗', file: 'genre_ranchera_18.mp3' },
    { text: '¡Un tequilazo doble para el público, que esto duele! 🥃', file: 'genre_ranchera_19.mp3' }
  ],
  rock: [
    { text: '¡Maná te hubiera dado el micrófono... para callarte! 🎸', file: 'genre_rock_0.mp3' },
    { text: '¡Eso no fue rock, fue terremoto con guitarra! 🌋', file: 'genre_rock_1.mp3' },
    { text: '¡Hasta las bocinas pidieron piedad! 🔊', file: 'genre_rock_2.mp3' },
    { text: '¡Kurt Cobain se revolvió en su tumba, pero de alegría! 🤘', file: 'genre_rock_3.mp3' },
    { text: '¡Mucho ruido y pocas nueces, como concierto de rock urbano! 🥁', file: 'genre_rock_4.mp3' },
    { text: '¡Traes toda la actitud de rockstar, lástima por las cuerdas vocales! 🎤', file: 'genre_rock_5.mp3' },
    { text: '¡Eso fue metal pesado, sobre todo por lo pesado de escuchar! ⛓️', file: 'genre_rock_6.mp3' },
    { text: '¡Alex Lora te daría un abrazo por el puro valor! 🫂', file: 'genre_rock_7.mp3' },
    { text: '¡Sonó como solo de guitarra eléctrica sin afinar desde el 85! 📅', file: 'genre_rock_8.mp3' },
    { text: '¡Ese headbanging estuvo chido, el canto... dejémoslo en intento! 🫠', file: 'genre_rock_9.mp3' },
    { text: '¡Ni Metallica en sus peores días sonaba tan destructivo! 💥', file: 'genre_rock_10.mp3' },
    { text: '¡El único rock que haces es cuando te tropiezas con una piedra! 🪨', file: 'genre_rock_11.mp3' },
    { text: '¡Rompiste la guitarra, el bajo, y mis tímpanos de paso! 🎸', file: 'genre_rock_12.mp3' },
    { text: '¡Ese solo vocal sonó a frenazo de camión de basura! 🚛', file: 'genre_rock_13.mp3' },
    { text: '¡Axl Rose te mandó saludos... y una orden de restricción! 📜', file: 'genre_rock_14.mp3' },
    { text: '¡El espíritu del rock and roll está pidiendo auxilio! 🆘', file: 'genre_rock_15.mp3' },
    { text: '¡Tanto ruido y tan poca música, parece microbús sin escape! 🚌', file: 'genre_rock_16.mp3' },
    { text: '¡Eso fue heavy metal... pero pesado de aguantar! 🪨', file: 'genre_rock_17.mp3' },
    { text: '¡Ni rompiendo la guitarra salvas esa presentación! 🎸', file: 'genre_rock_18.mp3' },
    { text: '¡Los decibeles al máximo y la afinación en negativo! 📉', file: 'genre_rock_19.mp3' }
  ],
  pop: [
    { text: '¡Taylor Swift acaba de bloquear tu número! 📵', file: 'genre_pop_0.mp3' },
    { text: '¡Eso estuvo tan pop como refresco caliente! 🥤', file: 'genre_pop_1.mp3' },
    { text: '¡Los BTS están viendo el partido de fut! ⚽', file: 'genre_pop_2.mp3' },
    { text: '¡Spotify te quitó 3 reproducciones por eso! 📉', file: 'genre_pop_3.mp3' },
    { text: '¡Sonó tan fresa que me empalagó el oído! 🍓', file: 'genre_pop_4.mp3' },
    { text: '¡Luismi ya canceló su próximo concierto por tu culpa! 🎤', file: 'genre_pop_5.mp3' },
    { text: '¡Pop de plástico, pero del que se recicla! ♻️', file: 'genre_pop_6.mp3' },
    { text: '¡Ese falsete estuvo más falso que billete de 300 pesos! 💵', file: 'genre_pop_7.mp3' },
    { text: '¡Parece que cantas pop en inglés pero con pronunciación de secundaria! 🏫', file: 'genre_pop_8.mp3' },
    { text: '¡Un autotune no te caería nada mal para la próxima, de veras! 🎚️', file: 'genre_pop_9.mp3' },
    { text: '¡Más desafinado que corista de quinceañera! 👗', file: 'genre_pop_10.mp3' },
    { text: '¡Esa coreografía estuvo chida, lástima que estamos calificando la voz! 💃', file: 'genre_pop_11.mp3' },
    { text: '¡Hasta Timbiriche te hubiera sacado del grupo! 🎤', file: 'genre_pop_12.mp3' },
    { text: '¡Cantaste tan fresa que me dio alergia musical! 🍓', file: 'genre_pop_13.mp3' },
    { text: '¡Belinda ya se desmayó de escuchar eso, y no por el sapito! 🐸', file: 'genre_pop_14.mp3' },
    { text: '¡Pop latino, de ese que te hace cambiar de estación! 📻', file: 'genre_pop_15.mp3' },
    { text: '¡Súper fresa, lástima que la fresa venía pasada! 🍓', file: 'genre_pop_16.mp3' },
    { text: '¡Ni todos los brillos del mundo tapan esos gallos! ✨', file: 'genre_pop_17.mp3' },
    { text: '¡Qué bonito bailas, ojalá cantaras la mitad de bien! 💃', file: 'genre_pop_18.mp3' },
    { text: '¡Ese agudo rompió tres copas y dos amistades! 🥂', file: 'genre_pop_19.mp3' }
  ],
  cumbia: [
    { text: '¡Los Ángeles Azules te piden que guardes el micrófono! 💃', file: 'genre_cumbia_0.mp3' },
    { text: '¡Más sabroso que elote con chile y limón! 🌽', file: 'genre_cumbia_1.mp3' },
    { text: '¡Eso movió el esqueleto y también el estómago! 🦴', file: 'genre_cumbia_2.mp3' },
    { text: '¡La Sonora Dinamita explotó de vergüenza ajena! 💣', file: 'genre_cumbia_3.mp3' },
    { text: '¡Traes el ritmo en los pies, pero la afinación en otra galaxia! 🌌', file: 'genre_cumbia_4.mp3' },
    { text: '¡Sabor a barrio, sabor a sonidero tapando la calle! 🎺', file: 'genre_cumbia_5.mp3' },
    { text: '¡Eso fue cumbia lagunera, bien rasposa! 🐊', file: 'genre_cumbia_6.mp3' },
    { text: '¡Hasta el microbús se detuvo a bailar con ese ritmo! 🚌', file: 'genre_cumbia_7.mp3' },
    { text: '¡Cumbia de la buena, ideal para barrer el piso con el compadre! 🧹', file: 'genre_cumbia_8.mp3' },
    { text: '¡Traes el güiro bien dominado, al menos eso se escuchó bien! 🥁', file: 'genre_cumbia_9.mp3' },
    { text: '¡Ese pasito tun tun te salió más bien pasito pum pum! 💥', file: 'genre_cumbia_10.mp3' },
    { text: '¡Si esto fuera un sonidero, ya te hubieran desconectado la bocina! 🔌', file: 'genre_cumbia_11.mp3' },
    { text: '¡Traes la cumbia en las venas, pero la circulación tapada! 🩸', file: 'genre_cumbia_12.mp3' },
    { text: '¡Celso Piña estaría tocando el acordeón... para no oírte! 🪗', file: 'genre_cumbia_13.mp3' },
    { text: '¡Qué cumbión tan mareador, me dio vértigo de lo mal que sonó! 😵', file: 'genre_cumbia_14.mp3' },
    { text: '¡Baila la cumbia... y mejor no cantes la cumbia! 💃', file: 'genre_cumbia_15.mp3' },
    { text: '¡Ese güiro tiene más ritmo que tus cuerdas vocales! 🥁', file: 'genre_cumbia_16.mp3' },
    { text: '¡Nos pusiste a sudar, pero de puro nervio al escucharte! 💦', file: 'genre_cumbia_17.mp3' },
    { text: '¡La pista está llena, pero todos huyendo del sonido! 🏃', file: 'genre_cumbia_18.mp3' },
    { text: '¡Sabor tropical que se quedó en el refrigerador! 🧊', file: 'genre_cumbia_19.mp3' }
  ],
  balada: [
    { text: '¡Luis Miguel lloró... pero no de emoción! 😢', file: 'genre_balada_0.mp3' },
    { text: '¡Eso fue más dramático que telenovela de Televisa! 📺', file: 'genre_balada_1.mp3' },
    { text: '¡El amor duele, pero esa nota duele más! 💔', file: 'genre_balada_2.mp3' },
    { text: '¡Alejandro Sanz se fue de tour por no escuchar eso! 🌍', file: 'genre_balada_3.mp3' },
    { text: '¡Perfecto para cortarse las venas con galletas de animalitos! 🍪', file: 'genre_balada_4.mp3' },
    { text: '¡Ese drama no lo tiene ni la Rosa de Guadalupe! 🌹', file: 'genre_balada_5.mp3' },
    { text: '¡Le pusiste sentimiento, pero te faltó tantita escala musical! 🎼', file: 'genre_balada_6.mp3' },
    { text: '¡Esa nota alta fue un grito de auxilio, confiesa! 🚨', file: 'genre_balada_7.mp3' },
    { text: '¡Sonó triste, sobre todo para los que tenemos oídos! 🦻', file: 'genre_balada_8.mp3' },
    { text: '¡La dedicatoria estuvo chida, el canto amerita divorcio exprés! 💍', file: 'genre_balada_9.mp3' },
    { text: '¡Lloré, pero porque me acordé que todavía faltan más por cantar! 😭', file: 'genre_balada_10.mp3' },
    { text: '¡Ese drama no lo compra ni TV Azteca! 📺', file: 'genre_balada_11.mp3' },
    { text: '¡Cristian Castro te manda sus alas para que vueles lejos del micro! 🕊️', file: 'genre_balada_12.mp3' },
    { text: '¡Te dolió tanto la rola que hasta el aire te faltó, mijo! 😮‍💨', file: 'genre_balada_13.mp3' },
    { text: '¡Pura cortavenas, pero de las que infectan! 🩹', file: 'genre_balada_14.mp3' },
    { text: '¡Tanto drama que ya me siento en el capítulo final! 📺', file: 'genre_balada_15.mp3' },
    { text: '¡Cantas al desamor, pero enamoras a la desgracia! 💔', file: 'genre_balada_16.mp3' },
    { text: '¡Traigan los pañuelos, que mis oídos están sangrando! 🩸', file: 'genre_balada_17.mp3' },
    { text: '¡Esa lágrima fue real, pero de dolor físico al oírte! 😭', file: 'genre_balada_18.mp3' },
    { text: '¡Una balada que pasará a la historia como arma letal! 💣', file: 'genre_balada_19.mp3' }
  ],
  electronica: [
    { text: '¡Daft Punk se quitó el casco de vergüenza! 🤖', file: 'genre_electronica_0.mp3' },
    { text: '¡Eso sonó como Windows 98 crasheando! 💻', file: 'genre_electronica_1.mp3' },
    { text: '¡El drop estuvo más plano que mi cartera! 💸', file: 'genre_electronica_2.mp3' },
    { text: '¡Avicii estaría orgulloso... o confundido! 🎧', file: 'genre_electronica_3.mp3' },
    { text: '¡Sonó como licuadora con piedras en la cocina! 🌪️', file: 'genre_electronica_4.mp3' },
    { text: '¡Traes el beat de guaracha, pero te faltó el ritmo! 🕺', file: 'genre_electronica_5.mp3' },
    { text: '¡Eso no fue rave, fue cortocircuito en el transformador! ⚡', file: 'genre_electronica_6.mp3' },
    { text: '¡Hasta el DJ se puso audífonos para taparse las orejas! 🎚️', file: 'genre_electronica_7.mp3' },
    { text: '¡Mucha luces, mucho humo, pero poca melodía, mi buen! 🌫️', file: 'genre_electronica_8.mp3' },
    { text: '¡El sintetizador intentó salvarte, pero ni él pudo tanto! 🎹', file: 'genre_electronica_9.mp3' },
    { text: '¡Ese sintetizador sonó como gato peleando en el techo! 🐈', file: 'genre_electronica_10.mp3' },
    { text: '¡La rola era house pero nos dejaste a todos out! 🏠', file: 'genre_electronica_11.mp3' },
    { text: '¡Ni Skrillex se atrevería a soltar ese ruido tan random! 🎛️', file: 'genre_electronica_12.mp3' },
    { text: '¡Parecía que se te quedó trabado el teclado de la computadora! ⌨️', file: 'genre_electronica_13.mp3' },
    { text: '¡Mucho punchis punchis, pero el talento andaba en el baño! 🚽', file: 'genre_electronica_14.mp3' },
    { text: '¡Apaguen esa consola, que huele a cable quemado! 🔌', file: 'genre_electronica_15.mp3' },
    { text: '¡Mucho láser, mucho humo, cero talento musical! 🕶️', file: 'genre_electronica_16.mp3' },
    { text: '¡Ese beat estuvo tan raro que se me reinició el Windows! 💻', file: 'genre_electronica_17.mp3' },
    { text: '¡Rave de pesadilla, de aquí al psicólogo todos! 🧠', file: 'genre_electronica_18.mp3' },
    { text: '¡La máquina hace la mitad del trabajo y ni así pudiste! 🤖', file: 'genre_electronica_19.mp3' }
  ],
  default: [
    { text: '¡Eso fue... algo! ¡No sé si cantar o rezar! 🙏', file: 'genre_default_0.mp3' },
    { text: '¡Los vecinos ya llamaron al 911! 🚨', file: 'genre_default_1.mp3' },
    { text: '¡Hasta el perro de la cuadra aúlla diferente! 🐕', file: 'genre_default_2.mp3' },
    { text: '¡Eso tuvo más quiebres que la economía nacional! 📊', file: 'genre_default_3.mp3' },
    { text: '¡La afinación está en vacaciones! ✈️', file: 'genre_default_4.mp3' },
    { text: '¡Corazón valiente, oídos sufridos! ❤️', file: 'genre_default_5.mp3' },
    { text: '¡Eso estuvo más raro que tamal de pizza! 🍕', file: 'genre_default_6.mp3' },
    { text: '¡Le faltó sal a ese taco de canción! 🧂', file: 'genre_default_7.mp3' },
    { text: '¡Traes el espíritu afinado, el resto... va en camino! 🚶', file: 'genre_default_8.mp3' },
    { text: '¡Eso fue cantar a capela... pero sin afinación alguna! 🔇', file: 'genre_default_9.mp3' },
    { text: '¡Ni Google Translate entiende lo que acabas de cantar! 🌐', file: 'genre_default_10.mp3' },
    { text: '¡Qué valor, qué coraje, qué falta de talento! 👏', file: 'genre_default_11.mp3' },
    { text: '¡Esto es un karaoke, no un concurso de gritos en el mercado! 🛒', file: 'genre_default_12.mp3' },
    { text: '¡Me duelen los oídos, los ojos y la dignidad! 🙈', file: 'genre_default_13.mp3' },
    { text: '¡Otra así y mejor desconecto el servidor! 🔌', file: 'genre_default_14.mp3' },
    { text: '¡Un talento oculto... y mejor que siga bien escondido! 🥷', file: 'genre_default_15.mp3' },
    { text: '¡El micrófono acaba de meter una demanda por abuso! 🎤', file: 'genre_default_16.mp3' },
    { text: '¡Cantas con el alma, porque con la voz de plano no! 👻', file: 'genre_default_17.mp3' },
    { text: '¡Una actuación inolvidable, aunque queramos olvidarla! 🧠', file: 'genre_default_18.mp3' },
    { text: '¡Te mereces un aplauso, pero en la cara y con una silla! 🪑', file: 'genre_default_19.mp3' }
  ]
};
const LOBBY_WELCOME_PHRASES = [
  { text: "¡Bienvenidos a Rítmika! Escaneen el código para empezar la fiesta 🪅", file: "lobby_welcome_0.mp3" },
  { text: "¡Qué onda banda! Bienvenidos a Rítmika. Acerquen sus celulares y conéctense al party. 🎉", file: "lobby_welcome_1.mp3" },
  { text: "¡Ya se la saben! Bienvenidos a Rítmika. Saquen los chescos y escaneen el código para jugar. 🥤", file: "lobby_welcome_2.mp3" },
  { text: "¡Buenas, buenas! Tío Axolo les da la bienvenida a Rítmika. Conéctense que esto se va a descontrolar. 🥳", file: "lobby_welcome_3.mp3" },
  { text: "¡Arrancamos Rítmika! Prepárense para cantar, reír y lanzar tomates. Escaneen el QR ya mismo. 🍅", file: "lobby_welcome_4.mp3" }
];

const ROOM_READY_PHRASES = [
  { text: "¡La sala está lista! Escanéen el código y únanse al juego! 📱", file: "room_ready_0.mp3" },
  { text: "¡Sala abierta y lista! Ya pueden unirse. ¿Quién se atreve a ser el primero? 🚀", file: "room_ready_1.mp3" },
  { text: "¡Tenemos código y tenemos ganas! Únanse al lobby con el código en pantalla. 🎰", file: "room_ready_2.mp3" },
  { text: "¡Lobby listo! Conecten sus controles móviles para iniciar la diversión. 📲", file: "room_ready_3.mp3" }
];

const ROULETTE_SPINS = [
  { text: '¡El destino decide quién sufre primero! 🎡✨', file: 'roulette_spin_0.mp3' },
  { text: '¡Girando la ruleta! A ver a quién le cae la voladora... 🎰', file: 'roulette_spin_1.mp3' },
  { text: '¡Suerte para todos! La rueda está buscando su próxima víctima. 🎡✨', file: 'roulette_spin_2.mp3' }
];

const ROULETTE_WINS = [
  { text: '¡Te toca cantar! ¡La suerte eligió! ¡Que el palenque decida tu destino! 🎤', file: 'roulette_win_0.mp3' },
  { text: '¡El elegido del destino! Pasa al frente y que dios te acompañe. 🙏', file: 'roulette_win_1.mp3' },
  { text: '¡El boleto ganador es tuyo! Conquista el escenario o muere en el intento. 🏆', file: 'roulette_win_2.mp3' }
];

const CHALLENGE_INTROS = [
  { text: '¡Reto de actuación activado! ¡A cantar con estilo! 🎭', file: 'challenge_intro_0.mp3' },
  { text: '¡Hora del reto! Cántenle con ganas y pónganle drama. 🎭', file: 'challenge_intro_1.mp3' },
  { text: '¡Reto especial! Demuestren que además de afinación, traen actitud escénica. 🌟', file: 'challenge_intro_2.mp3' }
];

const BLACKOUT_INTROS = [
  { text: '¡Apagón mental! ¡Se acabó la letra! ¡Canta de memoria o muere en el intento! 🧠', file: 'blackout_intro_0.mp3' },
  { text: '¡Luces fuera! Apagón mental activado. ¿Te sabes la rola de memoria? 🧠⚡', file: 'blackout_intro_1.mp3' },
  { text: '¡La pantalla se va a negro! Demuestra si eres un verdadero fan o pura pose. 🕶️', file: 'blackout_intro_2.mp3' }
];

const BLACKOUT_ENDS = [
  { text: '¡De vuelta! ¿Sobreviviste? 🎤', file: 'blackout_end_0.mp3' },
  { text: '¡Regresó la señal! ¿Te dio un ataque de pánico o todo chido? 😅', file: 'blackout_end_1.mp3' },
  { text: '¡Fin del apagón! A ver si lograste salvar la rola. 📻', file: 'blackout_end_2.mp3' }
];

const FINAL_VICTORIES = [
  { text: '¡Felicidades al ganador, te la rifaste de veras! 🏆', file: 'final_victory_0.mp3' },
  { text: '¡Tenemos campeón absoluto! Eres el mero mero del palenque. 🥇', file: 'final_victory_1.mp3' },
  { text: '¡Te coronaste! La banda te aclama y el Tío Axolo te aplaude. 👏🎉', file: 'final_victory_2.mp3' }
];

const PODIUM_CLIMAXES = [
  { text: '¡Y así termina la noche más épica del año! ¡El Rey del Palenque ha sido coronado! ¡Gracias banda por esta noche de gloria, carrilla y algún que otro tomate! ¡Hasta la próxima fiesta! 🏆', file: 'podium_climax_0.mp3' },
  { text: '¡Qué noche, señores! El palenque se cierra pero las risas se quedan. ¡Felicidades a los ganadores y gracias a todos por aguantar la carrilla! 🎉', file: 'podium_climax_1.mp3' },
  { text: '¡La fiesta llegó a su fin! Coronamos al rey, abucheamos al gallo y nos divertimos como locos. ¡Nos vemos en la próxima ronda de Rítmika! ¡Adiós! 👋', file: 'podium_climax_2.mp3' }
];

const CATALOG_READIES = [
  { text: '¡El catálogo de canciones está listo! 🎵', file: 'catalog_ready_0.mp3' },
  { text: '¡Todas las rolas cargadas y listas para sonar! 🎶', file: 'catalog_ready_1.mp3' },
  { text: '¡Ya pueden buscar sus temas preferidos! Catálogo listo. 📂', file: 'catalog_ready_2.mp3' }
];

const NEW_GAMES = [
  { text: '¡Nueva partida! 🎮 Esperando jugadores...', file: 'new_game_0.mp3' },
  { text: '¡Mesa limpia! Nueva partida iniciada. Vayan entrando todos. 🎮', file: 'new_game_1.mp3' },
  { text: '¡Reiniciamos la diversión! Esperando que se unan los cantantes. 🚀', file: 'new_game_2.mp3' }
];

const AXOLO_MODE_INTROS = {
  clasico: { text: "¡Modo Clásico! Rondas, ruleta y la carrilla de siempre. ¡A darle! 🎤", file: "mode_intro_clasico.mp3" },
  ranchera: { text: "¡Noche de despecho! Puro dolor, mariachi y tequila. ¡Agárrense! 🥃", file: "mode_intro_ranchera.mp3" },
  nostalgia: { text: "¡Modo Nostalgia 2000s! Saca tu discman y tu lado emo, que esto se va a poner intenso. 🖤", file: "mode_intro_nostalgia.mp3" },
  anime: { text: "¡Otaku Fest! A cantar los mejores openings antes de que caiga el meteorito. 🌸", file: "mode_intro_anime.mp3" }
};

const AXOLO_MODE_SELECTED = {
  clasico: { text: "¡Vámonos recio con lo Clásico! 🚀", file: "mode_selected_clasico.mp3" },
  ranchera: { text: "¡A llorar se ha dicho, puro mariachi! 🎺", file: "mode_selected_ranchera.mp3" },
  nostalgia: { text: "¡Sacando el fleco emo y el delineador! 🎸", file: "mode_selected_nostalgia.mp3" },
  anime: { text: "¡Prepara tus jutsus que nos vamos a Japón! 🎌", file: "mode_selected_anime.mp3" }
};

const MODES_WELCOME_PHRASES = [
  { text: "¡Bienvenidos a Rítmika, banda! Les tengo varios modos para que se la pasen increíble. El Clásico es la experiencia completa con ruleta, canciones variadas y mucha carrilla. Anime es puro opening para los otakus. Ranchera es para los despechados con mariachi incluido. Nostalgia te lleva a los 2000s con tu discman y tu lado emo. Y Emo... bueno, para los intensos. ¡Elijan su modo y vamos a arrancar esta fiesta!", file: "modes_welcome_0.mp3" },
  { text: "¡Qué onda, banda! Bienvenidos a Rítmika, el karaoke más loco del palenque. Miren, les tengo el Modo Clásico que es la experiencia completa: ruleta, canciones de todos los géneros y mucha carrilla. Si son otakus, ahí está el modo Anime con puros openings. Si traen despecho, modo Ranchera con puro mariachi. Los nostálgicos tienen el modo Nostalgia pa\u0027 los 2000s, y los intensos su modo Emo. ¡Elijan el suyo y que empiece la fiesta!", file: "modes_welcome_1.mp3" },
  { text: "¡Llegaron, llegaron! Bienvenidos a Rítmika, el show de karaoke más escandaloso de la cuadra. Antes de arrancar, elijan su modo de sufrimiento. El Clásico es para valientes, con ruleta y de todos los géneros. Anime es puro opening, Ranchera es puro despecho, Nostalgia es pa\u0027 los 2000s, y Emo... bueno, para los que traen el alma rota. ¡A elegir y a cantar!", file: "modes_welcome_2.mp3" },
  { text: "¡Buenas noches, palenque! El Tío Axolo les trae la bienvenida más calurosa. Aquí tenemos varios modos pa\u0027 que cada quien sufra a su manera. El Clásico tiene de todo, Anime es pa\u0027 los otakus, Ranchera es pa\u0027 los despechados, Nostalgia te lleva a los 2000s, y Emo es pa\u0027 los intensos. ¡Eligan el suyo y que empiece el sufrimiento!", file: "modes_welcome_3.mp3" },
  { text: "¡Arrancamos la noche, banda! Bienvenidos a Rítmika, donde cantar es opcional pero el ridículo es obligatorio. Miren, les tengo varios modos: el Clásico es la experiencia completa, Anime es puro opening, Ranchera es puro mariachi, Nostalgia te lleva a los 2000s, y Emo es para los que traen el fleco tapando un ojo. ¡Eligan su modo y a sufrir!", file: "modes_welcome_4.mp3" },
  { text: "¡Bien, bien, bien! Bienvenidos a Rítmika, el karaoke donde la amistad se pone a prueba. Les tengo varios modos pa\u0027 que elijan cómo quieren pasarla. El Clásico es el clásico de siempre, Anime es pa\u0027 los que ven dibujos japoneses, Ranchera es pa\u0027 los despechados, Nostalgia te transporta a los 2000s, y Emo es pa\u0027 los dramáticos. ¡A elegir!", file: "modes_welcome_5.mp3" },
  { text: "¡Qué tal, qué tal! Bienvenidos al palenque de Rítmika. Soy el Tío Axolo y les vengo a explicar los modos de juego. Tenemos el Clásico que es la experiencia completa con ruleta y todo. Anime para los otakus, Ranchera para los despechados, Nostalgia para los nostálgicos de los 2000s, y Emo para los que lloran con la lluvia. ¡Eligan y arrancamos!", file: "modes_welcome_6.mp3" },
  { text: "¡Bienvenidos, bienvenidos! Rítmika está listo para la fiesta y el Tío Axolo tiene varios modos pa\u0027 que elijan. El Clásico es para los que quieren la experiencia completa, Anime es puro opening y neón, Ranchera es puro dolor y mariachi, Nostalgia te lleva a los 2000s con tu Discman, y Emo es para los intensos del alma. ¡Eligan su modo y que no empiece el llanto!", file: "modes_welcome_7.mp3" },
  { text: "¡Aquí estamos otra vez, banda! Bienvenidos a Rítmika, donde la voz se premia y el ridículo se castiga... o al revés. Les tengo varios modos: el Clásico tiene ruleta y canciones de todos lados, Anime es pa\u0027 los que hablan en gallo japonés, Ranchera es pa\u0027 los que traen despecho, Nostalgia es pa\u0027 los del 2000s, y Emo es pa\u0027 los que se escuchan tristes en el espejo. ¡A elegir!", file: "modes_welcome_8.mp3" },
  { text: "¡Wepa, wepa! Bienvenidos a Rítmika, el karaoke más loco de toda la colonia. El Tío Axolo les presenta los modos de juego. El Clásico es la experiencia completa con ruleta, Anime es puro opening, Ranchera es puro despecho, Nostalgia te lleva a los 2000s, y Emo es para los que traen el delineador puesto. ¡Eligan su modo y que arranque la fiesta!", file: "modes_welcome_9.mp3" }
];

const AXOLO_SINGER_INTROS = [
  { text: '¡Al micrófono! ¡Que el palenque tiemble! 🎤🔥', file: 'intro_0.mp3' },
  { text: '¡Tiene el turno! ¡O canta o paga las chelas! 🍺', file: 'intro_1.mp3' },
  { text: '¡Silencio, que va a demostrar de qué está hecho! 🎭', file: 'intro_2.mp3' },
  { text: '¡El destino habló y tú tienes que obedecer! 🎰', file: 'intro_3.mp3' },
  { text: '¡Abran paso, que viene la verdadera estrella de la noche! ⭐', file: 'intro_4.mp3' },
  { text: '¡A tomar el escenario! Prepárense para lo que venga. 🚀', file: 'intro_5.mp3' },
  { text: '¡Es el momento de la verdad! ¡Sin miedo al éxito, carnal! 💪', file: 'intro_6.mp3' },
  { text: '¡Agárrense, que viene con todo el flow sonidero! 🔊', file: 'intro_7.mp3' },
  { text: '¡Que pase al frente! ¡Que empiece la magia o el sufrimiento! 🎩', file: 'intro_8.mp3' },
  { text: '¡La ruleta ha hablado y condena a nuestro cantante a deleitarnos! 🎭', file: 'intro_9.mp3' },
  { text: '¡Pásale a lo barrido, que aquí no hay piedad! 🧹', file: 'intro_10.mp3' },
  { text: '¡Agarra el micrófono como si fuera tu última caguama! 🍺', file: 'intro_11.mp3' },
  { text: '¡Demuestra que esos años cantando en la regadera valieron la pena! 🚿', file: 'intro_12.mp3' },
  { text: '¡El que sigue! Que no tiemblen las corvas. 🦵', file: 'intro_13.mp3' },
  { text: '¡Prepárense para una obra maestra... o para el fin del mundo! 🌎', file: 'intro_14.mp3' },
  { text: '¡Respira profundo, porque allá arriba no hay piedad! 😮‍💨', file: 'intro_15.mp3' },
  { text: '¡El reflector te llama, a ver si no te quema! 💡', file: 'intro_16.mp3' },
  { text: '¡Toma el micro y reza tus oraciones! 🙏', file: 'intro_17.mp3' },
  { text: '¡Público exigente hoy, así que saca los pasos prohibidos! 🕺', file: 'intro_18.mp3' },
  { text: '¡Si fallas, ya hay tomates listos en el refri! 🍅', file: 'intro_19.mp3' }
];

const AXOLO_VOTE_PROMPTS = [
  { text: '¡La actuación terminó! Ahora a votar, ¿se rifó o se chingó? 🗳️', file: 'vote_prompt_0.mp3' },
  { text: '¡Ya terminó el tormento! Saquen puntuación, sin lástima. 🎯', file: 'vote_prompt_1.mp3' },
  { text: '¡Tiempo de juzgar! ¿Le entra al karaoke o mejor se dedica a otra cosa? 😈', file: 'vote_prompt_2.mp3' },
  { text: '¡Voten, voten! Que la justicia divina caiga sobre el escenario. ⚖️', file: 'vote_prompt_3.mp3' },
  { text: '¡Boletas de calificación! Del 10 al 100, ¿qué tanto sufrieron? 📊', file: 'vote_prompt_4.mp3' },
];

const AXOLO_VOTE_REACTIONS = {
  100: [
    { text: '¡GRAMMY! ¡GRAMMY! ¡Le lloran los micrófonos! 🏆', file: 'vote_100_0.mp3' },
    { text: '¡ESO SÍ ES MÚSICA, no lo que ponen en el radio! 🎵', file: 'vote_100_1.mp3' },
    { text: '¡Se ganó el tequila y la admiración de Tío Axolo! 🥃', file: 'vote_100_2.mp3' },
    { text: '¡Se la rifó como los grandes del escenario! ⭐', file: 'vote_100_3.mp3' },
    { text: '¡Qué bárbaro, cantas mejor que el promedio nacional! 🇲🇽', file: 'vote_100_4.mp3' },
    { text: '¡Traes un vozarrón que hasta a mí me dio escalofríos! 🥶', file: 'vote_100_5.mp3' },
    { text: '¡Eso no fue cantar, fue dar cátedra musical! 🎓', file: 'vote_100_6.mp3' },
    { text: '¡Pónganle una estatua a este compa en su barrio! 🗽', file: 'vote_100_7.mp3' },
    { text: '¡Impecable! ¡Sublime! ¡Te quiero mucho! ❤️', file: 'vote_100_8.mp3' },
    { text: '¡De aquí directo a llenar el Foro Sol! 🏟️', file: 'vote_100_9.mp3' },
    { text: '¡Mis respetos, eso fue oro puro en el micrófono! 🥇', file: 'vote_100_10.mp3' },
    { text: '¡Me puse de pie en la sala, qué nivel de presentación! 🧍‍♂️', file: 'vote_100_11.mp3' },
    { text: '¡Firmame un autógrafo antes de que te vuelvas famoso! 📝', file: 'vote_100_12.mp3' },
    { text: '¡Si hubiera boletos, yo pagaba primera fila! 🎟️', file: 'vote_100_13.mp3' },
    { text: '¡Talento del bueno, sin exagerar ni un gramo! ✨', file: 'vote_100_14.mp3' }
  ],
  60: [
    { text: '¡Ni fu ni fa, pero al menos no sangran los oídos! 👍', file: 'vote_60_0.mp3' },
    { text: '¡Pasable, como el café de la oficina! ☕', file: 'vote_60_1.mp3' },
    { text: '¡Sobrevivió, que no es poco mérito! 😅', file: 'vote_60_2.mp3' },
    { text: '¡No estuvo mal, pero tampoco me hagas comprar el disco! 💿', file: 'vote_60_3.mp3' },
    { text: '¡Cumpliste como los buenos, a secas! 📝', file: 'vote_60_4.mp3' },
    { text: '¡Digamos que salvaste la noche por los pelos! 💈', file: 'vote_60_5.mp3' },
    { text: '¡Un desempeño decente, te ganaste media chela! 🍺', file: 'vote_60_6.mp3' },
    { text: '¡Suficiente para aprobar la materia, pero sin honores! 🎓', file: 'vote_60_7.mp3' },
    { text: '¡Cantaste como en martes: ni muy muy, ni tan tan! 🗓️', file: 'vote_60_8.mp3' },
    { text: '¡Hubo fallas técnicas, pero la actitud te salvó de milagro! 🛠️', file: 'vote_60_9.mp3' },
    { text: '¡No deslumbraste, pero al menos no apagaste la fiesta! 🕯️', file: 'vote_60_10.mp3' },
    { text: '¡Palomita en la boleta, pero sin derecho a beca! ✅', file: 'vote_60_11.mp3' },
    { text: '¡Estuvo regular, te faltó ensayar en la regadera! 🚿', file: 'vote_60_12.mp3' },
    { text: '¡Aceptable, supongo que has tenido mejores días! 🤷', file: 'vote_60_13.mp3' },
    { text: '¡Ni fu ni fa, quedaste empatado con el silencio! 😐', file: 'vote_60_14.mp3' }
  ],
  30: [
    { text: '¡Le echó ganas, que no es lo mismo que talento! 💪', file: 'vote_30_0.mp3' },
    { text: '¡Intento valiente, resultado... cuestionable! 🤔', file: 'vote_30_1.mp3' },
    { text: '¡El esfuerzo se nota, la afinación no tanto! 🎯', file: 'vote_30_2.mp3' },
    { text: '¡Estuviste a dos notas de invocar la lluvia! 🌧️', file: 'vote_30_3.mp3' },
    { text: '¡La intención es lo que cuenta, dicen por ahí! 🤷', file: 'vote_30_4.mp3' },
    { text: '¡Uff, faltó aire y sobró confianza! 😮‍💨', file: 'vote_30_5.mp3' },
    { text: '¡Sonó como motor de vocho en subida, compa! 🚗', file: 'vote_30_6.mp3' },
    { text: '¡De panzazo y rozando la tragedia, carnal! 🤕', file: 'vote_30_7.mp3' },
    { text: '¡Traías el volumen al cien pero el talento en modo avión! ✈️', file: 'vote_30_8.mp3' },
    { text: '¡Se agradece la participación, ahora siéntate por favor! 🪑', file: 'vote_30_9.mp3' },
    { text: '¡Eso sonó a lamento boliviano, pero mal cantado! 😢', file: 'vote_30_10.mp3' },
    { text: '¡Menos mal que no cobran entrada para escucharte! 💸', file: 'vote_30_11.mp3' },
    { text: '¡Si cantaras como respiras, seríamos millonarios! 💰', file: 'vote_30_12.mp3' },
    { text: '¡Faltó poquito para que fuera bueno... bueno, faltó mucho! 🤏', file: 'vote_30_13.mp3' },
    { text: '¡Un aplauso por el valor, porque de voz andamos escasos! 👏', file: 'vote_30_14.mp3' }
  ],
  10: [
    { text: '¡GALLO SUPREMO DETECTADO! 🐓 ¡Los gallos de Sonora cantaron mejor!', file: 'vote_10_0.mp3' },
    { text: '¡Eso no fue cantar, fue torturar las notas musicales! 😂', file: 'vote_10_1.mp3' },
    { text: '¡Los vecinos ya pusieron denuncia por escándalo! 📝', file: 'vote_10_2.mp3' },
    { text: '¡Hijo de su... qué fue eso! ¡Mis oídos de ajolote! 🙉', file: 'vote_10_3.mp3' },
    { text: '¡Eso sonó como gato pisado en reversa! 🐱🚗', file: 'vote_10_4.mp3' },
    { text: '¡Una afinación tan ausente como mi ex! 💔', file: 'vote_10_5.mp3' },
    { text: '¡Te sugiero pedir perdón al micrófono de inmediato! 🎤🙇', file: 'vote_10_6.mp3' },
    { text: '¡Por favor, que alguien llame a control de animales! 🐕', file: 'vote_10_7.mp3' },
    { text: '¡Mis respetos... por tener el valor de hacer el ridículo así! 🤡', file: 'vote_10_8.mp3' },
    { text: '¡Ni con autotune divino se arregla ese desastre! 👼', file: 'vote_10_9.mp3' },
    { text: '¡Cantas tan feo que hasta la cebolla lloró! 🧅', file: 'vote_10_10.mp3' },
    { text: '¡Un minuto de silencio por mis tímpanos fallecidos! 🪦', file: 'vote_10_11.mp3' },
    { text: '¡Eso fue un crimen de lesa humanidad musical! 🚓', file: 'vote_10_12.mp3' },
    { text: '¡Ni el micrófono te quiere ya, devuélvelo por favor! 🎤', file: 'vote_10_13.mp3' },
    { text: '¡Rompiste la barrera del sonido... y del buen gusto! 💥', file: 'vote_10_14.mp3' }
  ]
};

function getGenreBark(player) {
  const genre = (player.genres || [])[0] || 'default';
  const barks  = GENRE_BARKS[genre] || GENRE_BARKS.default;
  return barks[Math.floor(Math.random() * barks.length)];
}

function getVoteReaction(score) {
  let key = 10;
  if (score >= 80) key = 100;
  else if (score >= 50) key = 60;
  else if (score >= 25) key = 30;
  const lines = AXOLO_VOTE_REACTIONS[key];
  return lines[Math.floor(Math.random() * lines.length)];
}


const SAVE_KEY = 'ritmika_game_state';
const SAVE_TTL = 4 * 60 * 60 * 1000; // 4 horas
