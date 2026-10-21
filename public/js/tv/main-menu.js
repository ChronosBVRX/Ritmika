// ═══════════════════════════════════════════════════════════
//  RÍTMIKA · PALENQUE ARCADE — MENÚ PRINCIPAL
//  Selección de show, hero cinematográfico, ajustes y transición.
// ═══════════════════════════════════════════════════════════

// El sistema de teclado/gamepad de tv.html lee esta variable global.
let selectedMode = 'clasico';

const MM_MODES = {
  clasico: {
    name: 'Clásico',
    display: 'CLÁSICO',
    kicker: 'SHOW 01 · EL SHOW DE TODOS',
    tagline: 'Todos los éxitos. Cero piedad.',
    description: 'El karaoke definitivo: 4,515 canciones, retos, tomatazos y sabotajes. La fiesta que ya conoces, ahora con más carrilla.',
    icon: './assets/icon_classic.webp',
    axolo: './assets/tio_axolo_body.webp',
    hero: './assets/menu/hero_clasico.webp',
    accent: '#ffe600',
    accent2: '#00e5ff',
    tag: 'MODO ESTRELLA',
    songs: '4,515 ROLAS',
    meta: ['2–8 JUGADORES', '3 RONDAS', '20–30 MIN'],
    locked: false,
  },
  emo: {
    name: 'Fiesta Emo',
    display: 'FIESTA EMO',
    kicker: 'SHOW 02 · DRAMA GARANTIZADO',
    tagline: 'No es una fase. Es una fiesta.',
    description: 'Pop punk, delineador negro y corazones rotos. La noche en que todos cantan como si nadie los escuchara.',
    icon: './assets/icon_emo.webp',
    axolo: './assets/axolo_emo.webp',
    hero: './assets/menu/hero_emo.webp',
    accent: '#f0047f',
    accent2: '#a855f7',
    tag: 'DRAMA PREMIUM',
    songs: '58 ROLAS',
    meta: ['2–8 JUGADORES', '3 RONDAS', '25 MIN'],
    locked: false,
  },
  ranchera: {
    name: 'Dolidas & Rancheras',
    display: 'DOLIDAS & RANCHERAS',
    kicker: 'SHOW 03 · DESPECHO DE ALTURA',
    tagline: 'Pa’ cantar con el alma y el pañuelo.',
    description: 'Mariachi, palenque y despecho premium. Aquí se llora bonito, se canta fuerte y se perdona… o no.',
    icon: './assets/icon_ranchera.webp',
    axolo: './assets/axolo_ranchera.webp',
    hero: './assets/menu/hero_ranchera.webp',
    accent: '#f59e0b',
    accent2: '#f0047f',
    tag: 'PALENQUE LEGENDARIO',
    songs: '1,057 ROLAS',
    meta: ['2–8 JUGADORES', '3 RONDAS', '25 MIN'],
    locked: false,
  },
  nostalgia: {
    name: 'Nostalgia Pop',
    display: 'NOSTALGIA POP',
    kicker: 'SHOW 04 · VIAJE A LOS 2000',
    tagline: 'Saca el flip phone y el brillo labial.',
    description: 'Y2K, discos compactos y pop de plástico. Un viaje a la época del Messenger, los celulares plegables y el playback.',
    icon: './assets/icon_nostalgia.webp',
    axolo: './assets/axolo_nostalgia.webp',
    hero: './assets/menu/hero_nostalgia.webp',
    accent: '#22d3ee',
    accent2: '#ec4899',
    tag: 'AÑOS 2000',
    songs: '299 ROLAS',
    meta: ['2–8 JUGADORES', '3 RONDAS', '25 MIN'],
    locked: false,
  },
  anime: {
    name: 'Fiesta Anime',
    display: 'FIESTA ANIME',
    kicker: 'SHOW 05 · EN EL HORNO',
    tagline: 'Openings, endings y poder de protagonista.',
    description: 'El próximo gran show de Rítmika. Torii, sakura y energía de opening. Los changos del código todavía lo están armando.',
    icon: './assets/icon_anime.webp',
    axolo: './assets/axolo_anime.webp',
    hero: './assets/menu/hero_anime.webp',
    accent: '#38bdf8',
    accent2: '#f43f5e',
    tag: 'PRÓXIMAMENTE',
    songs: 'MUY PRONTO',
    meta: ['MODO FUTURO', 'EN EL HORNO'],
    locked: true,
  },
};

const MainMenu = (function () {
  const STORAGE = {
    music: 'ritmika_menu_music',
    motion: 'ritmika_reduced_motion',
    quickSongs: 'ritmika_quick_songs',
  };

  const screen = document.getElementById('mode-selection-screen');
  const lobby = document.getElementById('lobby-screen');
  if (!screen) {
    return { init() {}, isMusicEnabled: () => true };
  }

  const els = {};
  let activeBg = 'a';
  let creating = false;
  let hoverTimer = null;
  let modalOpen = false;
  let modalTrigger = null;
  let musicOn = true;
  let reducedMotion = false;
  let quickSongs = false;
  let wasActive = screen.classList.contains('active');
  let initialized = false;

  function $(id) { return document.getElementById(id); }

  function readBool(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return raw === '1';
    } catch { return fallback; }
  }

  function writeBool(key, value) {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch {}
  }

  function cache() {
    els.bgA = $('mm-hero-bg-a');
    els.bgB = $('mm-hero-bg-b');
    els.bgFlash = $('mm-hero-flash');
    els.icon = $('mm-mode-icon');
    els.axolo = $('mm-axolo-img');
    els.kicker = $('mm-mode-kicker');
    els.name = $('mm-mode-name');
    els.tagline = $('mm-mode-tagline');
    els.desc = $('mm-mode-desc');
    els.meta = $('mm-meta');
    els.tag = $('mm-mode-tag');
    els.songs = $('mm-mode-songs');
    els.cta = $('btn-crear-sala-modo');
    els.ctaMode = $('mm-cta-mode');
    els.ctaLabel = $('mm-cta-label');
    els.hero = $('mm-hero');
    els.version = $('mm-version');
    els.tickerSongs = $('mm-ticker-songs');
    els.cards = Array.from(screen.querySelectorAll('.mode-card'));
  }

  function preload() {
    Object.values(MM_MODES).forEach(mode => {
      const img = new Image();
      img.src = mode.hero;
    });
  }

  function setAccent(mode) {
    screen.style.setProperty('--mm-accent', mode.accent);
    screen.style.setProperty('--mm-accent-2', mode.accent2);
    const rgb = hexToRgb(mode.accent);
    screen.style.setProperty('--mm-accent-soft', `rgba(${rgb},0.22)`);
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : '255,230,0';
  }

  function sfx(name, ...args) {
    try {
      if (typeof UISounds !== 'undefined' && UISounds && typeof UISounds[name] === 'function') {
        UISounds[name](...args);
      }
    } catch {}
  }

  function crossfade(src) {
    if (!els.bgA || !els.bgB) return;
    const current = activeBg === 'a' ? els.bgA : els.bgB;
    if (current && current.getAttribute('src') === src && current.classList.contains('is-active')) return;
    const nextKey = activeBg === 'a' ? 'b' : 'a';
    const next = nextKey === 'a' ? els.bgA : els.bgB;
    const prev = activeBg === 'a' ? els.bgA : els.bgB;
    next.dataset.want = src;
    const reveal = () => {
      if (next.dataset.want !== src) return;
      next.classList.add('is-active');
      prev.classList.remove('is-active');
      activeBg = nextKey;
    };
    if (next.getAttribute('src') === src && next.complete && next.naturalWidth) {
      requestAnimationFrame(reveal);
      return;
    }
    next.onload = reveal;
    next.onerror = reveal;
    next.src = src;
  }

  function bumpIcon() {
    if (!els.icon || window.RITMIKA_PERF_MODE === 'performance') return;
    if (typeof anime !== 'undefined') {
      anime.remove(els.icon);
      anime({ targets: els.icon, scale: [0.42, 1.14, 1], rotate: [-14, 4, 0], duration: 520, easing: 'easeOutElastic(1, .5)' });
    }
  }

  function bumpAxolo() {
    if (!els.axolo || window.RITMIKA_PERF_MODE === 'performance') return;
    if (typeof anime !== 'undefined') {
      anime.remove(els.axolo);
      anime({ targets: els.axolo, opacity: [0, 1], translateY: [60, 0], scale: [0.92, 1], duration: 560, easing: 'easeOutBack' });
    }
  }

  function sweepFlash() {
    if (!els.bgFlash || window.RITMIKA_PERF_MODE === 'performance') return;
    els.bgFlash.classList.remove('is-flashing');
    void els.bgFlash.offsetWidth;
    els.bgFlash.classList.add('is-flashing');
  }

  function renderMode(modeId, opts) {
    opts = opts || {};
    const mode = MM_MODES[modeId];
    if (!mode) return;

    selectedMode = modeId;
    window.selectedMode = modeId;
    setAccent(mode);

    els.cards.forEach(card => {
      const isSelected = card.dataset.mode === modeId;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      card.tabIndex = isSelected ? 0 : -1;
    });

    els.kicker.textContent = mode.kicker;
    els.name.textContent = mode.display;
    els.tagline.textContent = mode.tagline;
    els.desc.textContent = mode.description;
    els.tag.textContent = mode.tag;
    els.songs.innerHTML = '<b>' + mode.songs + '</b>';
    if (els.tickerSongs) els.tickerSongs.textContent = mode.songs;
    els.meta.innerHTML = mode.meta.map(item => `<span class="mm-chip">${item}</span>`).join('');
    els.icon.src = mode.icon;
    els.icon.alt = mode.name;
    els.axolo.src = mode.axolo;
    els.axolo.alt = 'Tío Axolo en ' + mode.name;

    els.cta.disabled = !!mode.locked;
    els.ctaMode.textContent = mode.locked ? 'EN EL HORNO' : mode.display;
    els.ctaLabel.textContent = mode.locked ? 'PRÓXIMAMENTE' : 'CREAR SALA';

    crossfade(mode.hero);

    if (!opts.instant) {
      sweepFlash();
      bumpIcon();
      bumpAxolo();
      if (typeof anime !== 'undefined' && window.RITMIKA_PERF_MODE !== 'performance') {
        anime.remove(els.kicker.parentElement);
        anime({
          targets: els.kicker.parentElement,
          opacity: [0.35, 1],
          translateY: [14, 0],
          duration: 360,
          easing: 'easeOutBack',
        });
      }
      sfx('tick');
    }
  }

  function select(modeId, opts) {
    if (!MM_MODES[modeId]) return;
    if (modeId === selectedMode && !(opts && opts.force)) {
      if (opts && opts.instant) renderMode(modeId, opts);
      return;
    }
    renderMode(modeId, opts);
  }

  function bindCards() {
    els.cards.forEach(card => {
      const modeId = card.dataset.mode;
      card.addEventListener('mouseenter', () => {
        if (modalOpen || modeId === selectedMode) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => select(modeId), 140);
      });
      card.addEventListener('mouseleave', () => clearTimeout(hoverTimer));
      card.addEventListener('focus', () => {
        if (!modalOpen) select(modeId);
      });
      card.addEventListener('click', (event) => {
        clearTimeout(hoverTimer);
        select(modeId, { force: true });
        if (MM_MODES[modeId] && MM_MODES[modeId].locked) {
          lockedNope(card);
          return;
        }
        // Enter/Espacio (click sintético, detail 0) confirma y crea.
        // El mouse solo previsualiza.
        if (event.detail === 0) {
          createRoom();
        } else if (els.cta) {
          setTimeout(() => els.cta.focus({ preventScroll: true }), 60);
        }
      });
    });
  }

  function lockedNope(card) {
    sfx('playTone', 150, 0.3, 'sawtooth', 0.12);
    if (typeof anime !== 'undefined') {
      anime.remove(card);
      anime({ targets: card, translateX: [0, -10, 10, -8, 8, 0], duration: 420, easing: 'easeInOutSine' });
      anime({ targets: els.cta, translateX: [0, -8, 8, -6, 6, 0], duration: 420, easing: 'easeInOutSine' });
    }
    const badge = els.tag;
    if (badge) {
      badge.animate(
        [{ transform: 'rotate(-2deg) scale(1)' }, { transform: 'rotate(4deg) scale(1.12)' }, { transform: 'rotate(-2deg) scale(1)' }],
        { duration: 420, easing: 'ease-out' }
      );
    }
  }

  function bindUtility() {
    const how = $('mm-btn-how');
    const settings = $('mm-btn-settings');
    const credits = $('mm-btn-credits');
    const audio = $('mm-btn-audio');
    const lobbySettings = $('btn-lobby-settings');
    const hasNativeSettings = !!(window.AndroidNative &&
      typeof window.AndroidNative.openSettings === 'function');

    if (how) how.addEventListener('click', () => openModal('how'));
    if (settings) {
      settings.addEventListener('click', () => {
        if (!openNativeSettings()) openModal('settings');
      });
    }
    if (credits) credits.addEventListener('click', () => openModal('credits'));

    if (audio) {
      const nativeAudio = window.AndroidNative;
      const available = !!(nativeAudio &&
        typeof nativeAudio.isAudioPanelAvailable === 'function' &&
        nativeAudio.isAudioPanelAvailable());
      audio.style.display = available ? '' : 'none';
      if (available) {
        audio.addEventListener('click', () => openAudioPanel());
      }
    }

    if (lobbySettings) {
      lobbySettings.style.display = hasNativeSettings ? '' : 'none';
      if (hasNativeSettings) {
        lobbySettings.addEventListener('click', () => openNativeSettings());
      }
    }

    if (els.cta) els.cta.addEventListener('click', createRoom);
    const back = $('btn-back-to-modes');
    if (back) back.addEventListener('click', backToMenu);
    document.addEventListener('fullscreenchange', () => {
      const btn = document.querySelector('[data-mm-toggle="fullscreen"]');
      if (btn) setToggle(btn, !!document.fullscreenElement);
    });
  }

  function openNativeSettings() {
    const native = window.AndroidNative;
    if (!native || typeof native.openSettings !== 'function') return false;
    const perf = (window.RitmikaPerf && typeof window.RitmikaPerf.getMode === 'function')
      ? window.RitmikaPerf.getMode()
      : 'auto';
    try {
      return native.openSettings(!!musicOn, !!reducedMotion, perf);
    } catch {
      return false;
    }
  }

  function openAudioPanel() {
    const nativeAudio = window.AndroidNative;
    if (!nativeAudio || typeof nativeAudio.openAudioPanel !== 'function') return false;
    // Solo fuera de una partida activa: menú o lobby. Durante una canción
    // no abrimos una Activity que pause el WebView y desincronice la fase.
    const menuActive = screen.classList.contains('active');
    const lobbyActive = !!(lobby && lobby.classList.contains('active'));
    if (!menuActive && !lobbyActive) return false;
    try {
      return nativeAudio.openAudioPanel();
    } catch {
      return false;
    }
  }

  // El control remoto (KEYCODE_MENU) llama a esta función desde MainActivity.
  window.__ritmikaOpenAudioPanel = openAudioPanel;
  window.__ritmikaOpenSettings = openNativeSettings;

  window.__ritmikaSetMenuMusic = (enabled) => {
    musicOn = enabled === true;
    writeBool(STORAGE.music, musicOn);
    applyMusicPreference();
  };

  window.__ritmikaSetReducedMotion = (enabled) => {
    reducedMotion = enabled === true;
    writeBool(STORAGE.motion, reducedMotion);
    applyMotionPreference();
  };

  function socketReady() {
    return typeof socket !== 'undefined' && socket && socket.connected;
  }

  function createRoom() {
    if (creating) return;
    const mode = MM_MODES[selectedMode];
    if (!mode) return;
    if (mode.locked) {
      lockedNope(els.cards.find(c => c.dataset.mode === selectedMode));
      return;
    }
    if (!socketReady()) {
      if (typeof updateTicker === 'function') updateTicker('Sin conexión al servidor. Reintentando…');
      sfx('playTone', 150, 0.35, 'sawtooth', 0.1);
      return;
    }

    creating = true;
    if (els.cta) {
      els.cta.disabled = true;
      els.ctaLabel.textContent = 'CREANDO SALA…';
      els.ctaMode.textContent = 'UN MOMENTO';
    }
    sfx('stinger');

    if (typeof state !== 'undefined') state.gameMode = selectedMode;
    if (typeof applyModeTheme === 'function') applyModeTheme(selectedMode);
    socket.emit('tv:create_room', { mode: selectedMode });

    transitionTo('lobby');
  }

  function backToMenu() {
    if (!socketReady()) return;
    sfx('click');
    socket.emit('tv:close_room');
    transitionTo('menu');
  }

  function transitionTo(target) {
    if (window._mmTransitioning) return;
    window._mmTransitioning = true;

    if (window.RITMIKA_PERF_MODE === 'performance') {
      applyTransition(target, null);
      window._mmTransitioning = false;
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'mm-transition';
    const colors = target === 'lobby'
      ? ['#ffe600', '#00e5ff', '#f0047f']
      : ['#00e5ff', '#f0047f', '#ffe600'];
    const bands = colors.map((color, i) => {
      const band = document.createElement('div');
      band.className = 'mm-transition-band';
      band.style.background = color;
      band.style.left = (i * 30 - 10) + '%';
      overlay.appendChild(band);
      return band;
    });

    const stamp = document.createElement('div');
    stamp.className = 'mm-transition-stamp';
    stamp.textContent = target === 'lobby' ? '¡SALA CREADA!' : '¡DE VUELTA AL SHOW!';
    overlay.appendChild(stamp);
    document.body.appendChild(overlay);

    if (typeof anime === 'undefined') {
      applyTransition(target, stamp);
      overlay.remove();
      window._mmTransitioning = false;
      return;
    }

    bands.forEach((band, i) => {
      anime({
        targets: band,
        translateX: ['-160%', '0%'],
        duration: 460,
        delay: i * 70,
        easing: 'easeOutExpo',
      });
    });

    setTimeout(() => {
      anime({ targets: stamp, scale: [0, 1.12, 1], rotate: [-12, 2, -6], duration: 520, easing: 'easeOutElastic(1, .5)' });
      sfx('chime');
    }, 330);

    setTimeout(() => {
      applyTransition(target, stamp);
      setTimeout(() => {
        anime({
          targets: bands,
          translateX: ['0%', '160%'],
          duration: 480,
          delay: anime.stagger(60),
          easing: 'easeInExpo',
          complete: () => overlay.remove(),
        });
        anime({ targets: stamp, opacity: [1, 0], scale: [1, 0.7], duration: 280, easing: 'easeInCubic' });
        setTimeout(() => { window._mmTransitioning = false; }, 600);
      }, 260);
    }, 780);
  }

  function applyTransition(target, stamp) {
    if (target === 'lobby') {
      screen.classList.remove('active');
      if (lobby) lobby.classList.add('active');
      if (typeof FlowDirector !== 'undefined') FlowDirector.enter('lobby', { label: 'Sala de espera' });
      if (typeof animateLobbyWelcome === 'function') animateLobbyWelcome();
    } else {
      if (lobby) lobby.classList.remove('active');
      screen.classList.add('active');
    }
    }

  function onShow() {
    applyMusicPreference();
    creating = false;
    if (els.cta) {
      els.cta.disabled = false;
      els.ctaLabel.textContent = 'CREAR SALA';
    }
    renderMode(selectedMode, { instant: true });
    setTimeout(() => {
      if (!screen.classList.contains('active') || modalOpen) return;
      if (els.cta && !els.cta.disabled) els.cta.focus({ preventScroll: true });
    }, 720);
  }

  function applyMusicPreference() {
    const audio = (typeof bootMusic !== 'undefined' && bootMusic)
      ? bootMusic
      : document.getElementById('boot-music');
    if (!audio) return;
    window.__RITMIKA_MENU_MUSIC = musicOn;
    if (!musicOn) {
      try { audio.pause(); } catch {}
      return;
    }
    if (audio.paused && screen.classList.contains('active')) {
      try { audio.volume = 0.34; audio.play().catch(() => {}); } catch {}
    }
  }

  // ── Modales ────────────────────────────────────────────────
  function ensureModal() {
    if (document.getElementById('mm-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'mm-modal';
    modal.className = 'mm-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '<div class="mm-modal-panel"><button class="mm-modal-close" id="mm-modal-close" aria-label="Cerrar">✕</button><div class="mm-modal-body" id="mm-modal-body"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.getElementById('mm-modal-close').addEventListener('click', closeModal);
    document.getElementById('mm-modal-body').addEventListener('click', onModalBodyClick);
  }

  function openModal(kind) {
    ensureModal();
    const modal = document.getElementById('mm-modal');
    const body = document.getElementById('mm-modal-body');
    if (!modal || !body) return;
    const trigger = document.activeElement;
    modalTrigger = (trigger && trigger !== document.body && screen.contains(trigger)) ? trigger : null;
    sfx('whoosh');
    body.innerHTML = modalContent(kind);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modalOpen = true;
    const focusClose = () => {
      if (!modalOpen) return;
      const close = document.getElementById('mm-modal-close');
      if (close) close.focus({ preventScroll: true });
    };
    focusClose();
    setTimeout(focusClose, 120);
  }

  function closeModal() {
    const modal = document.getElementById('mm-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modalOpen = false;
    const target = modalTrigger;
    modalTrigger = null;
    const focusBack = () => {
      const fallback = els.cta;
      const pick = (target && document.contains(target) && !target.disabled && target.getClientRects().length)
        ? target
        : fallback;
      if (pick) pick.focus({ preventScroll: true });
    };
    focusBack();
    setTimeout(focusBack, 80);
  }

  function modalContent(kind) {
    if (kind === 'how') {
      return `
        <p class="mm-modal-kicker">INSTRUCCIONES DE LA CASA</p>
        <h2 class="mm-modal-title">CÓMO SE JUEGA</h2>
        <div class="mm-steps">
          <div class="mm-step"><span class="mm-step-num">1</span><span class="mm-step-icon">📱</span><h4>ÚNETE</h4><p>Escanea el QR del lobby o entra con el código desde tu celular.</p></div>
          <div class="mm-step"><span class="mm-step-num">2</span><span class="mm-step-icon">🎭</span><h4>PREPÁRATE</h4><p>Elige avatar, géneros y tus gallos. El Tío Axolo hace el resto.</p></div>
          <div class="mm-step"><span class="mm-step-num">3</span><span class="mm-step-icon">🎤</span><h4>CANTA Y VOTA</h4><p>Tres rondas, retos, tomatazos y sabotajes. El público decide tu destino.</p></div>
        </div>
        <div class="mm-note">🍅 <b>Tomatazo:</b> cuesta 10 pts y resta 15 al cantante. 🎭 <b>Reto:</b> el público decide si lo cumplió (+15). 📢 <b>Sabotaje:</b> corta el audio 3 s. La ruleta y la votación avanzan solas; el host puede acelerarlas desde su celular.</div>
        <p style="margin-top:16px;color:#64748b;font-size:12px;letter-spacing:1px;text-transform:uppercase;">2–8 jugadores · 3 rondas · 20–30 min · Modo Fiesta 90 s</p>
      `;
    }
    if (kind === 'settings') {
      return `
        <p class="mm-modal-kicker">CONTROL DE LA SALA</p>
        <h2 class="mm-modal-title">AJUSTES</h2>
        <div class="mm-settings">
          ${settingRow('music', 'Música del menú', 'Ambiente para elegir el show', musicOn)}
          ${settingRow('fullscreen', 'Pantalla completa', 'Para que nadie vea el escritorio', !!document.fullscreenElement)}
          ${settingRow('motion', 'Movimiento reducido', 'Menos animaciones para TVs lentas', reducedMotion)}
          ${settingRow('quickSongs', 'Canciones', quickSongs ? 'Fiesta: 90 s por canción' : 'Canción completa', quickSongs)}
          ${perfRow(window.RitmikaPerf ? window.RitmikaPerf.getMode() : 'auto')}
        </div>
        <div class="mm-note" style="margin-top:16px;">Los ajustes se guardan en esta TV. La música se detiene sola en la partida para no pelear con Axolo ni con las canciones.</div>
      `;
    }
    return `
      <div class="mm-credits">
        <p class="mm-modal-kicker">HECHO CON CARRILLA Y AMOR</p>
        <h2 class="mm-modal-title" style="margin-bottom:8px;">CRÉDITOS</h2>
        <img src="./assets/logo_ritmika.webp" alt="Rítmika" />
        <h3>RÍTMIKA</h3>
        <p>Un karaoke party game estilo Jackbox, con sabor a palenque, neón y carrilla mexicana. Tío Axolo pone la voz; tú pones el ridículo.</p>
        <div class="mm-credit-tags">
          <span>Node.js + Socket.io</span>
          <span>SQLite · 4,515 rolas</span>
          <span>ComfyUI · SDXL</span>
          <span>Paytone One + Fredoka</span>
          <span>Hecho en México</span>
        </div>
        <p style="margin-top:18px;color:#64748b;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Rítmika · v1.0.1</p>
      </div>
    `;
  }

  function settingRow(key, title, sub, value) {
    return `<div class="mm-setting-row"><div class="mm-setting-copy"><strong>${title}</strong><small>${sub}</small></div><button class="mm-toggle" data-mm-toggle="${key}" aria-pressed="${value ? 'true' : 'false'}">${value ? 'ACTIVADO' : 'DESACTIVADO'}</button></div>`;
  }

  function perfLabel(mode) {
    if (mode === 'performance') return 'RENDIMIENTO';
    if (mode === 'quality') return 'CALIDAD';
    return 'AUTOMÁTICO';
  }

  function perfRow(mode) {
    return `<div class="mm-setting-row"><div class="mm-setting-copy"><strong>Rendimiento</strong><small>Animaciones, filtros y loops</small></div><button class="mm-toggle" data-mm-perf="1">${perfLabel(mode)}</button></div>`;
  }

  function onModalBodyClick(event) {
    const perfBtn = event.target.closest('[data-mm-perf]');
    if (perfBtn) {
      const order = ['auto', 'performance', 'quality'];
      const current = window.RitmikaPerf ? window.RitmikaPerf.getMode() : 'auto';
      const next = order[(order.indexOf(current) + 1) % order.length];
      if (window.RitmikaPerf) window.RitmikaPerf.setMode(next);
      perfBtn.textContent = perfLabel(next);
      return;
    }

    const btn = event.target.closest('[data-mm-toggle]');
    if (!btn) return;
    const key = btn.dataset.mmToggle;
    if (key === 'music') {
      musicOn = !musicOn;
      writeBool(STORAGE.music, musicOn);
      applyMusicPreference();
      setToggle(btn, musicOn);
      if (musicOn) sfx('chime');
    } else if (key === 'fullscreen') {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setTimeout(() => setToggle(btn, !!document.fullscreenElement), 120);
    } else if (key === 'motion') {
      reducedMotion = !reducedMotion;
      writeBool(STORAGE.motion, reducedMotion);
      applyMotionPreference();
      setToggle(btn, reducedMotion);
    } else if (key === 'quickSongs') {
      quickSongs = !quickSongs;
      writeBool(STORAGE.quickSongs, quickSongs);
      setToggle(btn, quickSongs);
      const note = btn.closest('.mm-setting-row')?.querySelector('small');
      if (note) note.textContent = quickSongs ? 'Fiesta: 90 s por canción' : 'Canción completa';
    }
  }

  function setToggle(btn, value) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', value ? 'true' : 'false');
    btn.textContent = value ? 'ACTIVADO' : 'DESACTIVADO';
  }

  function applyMotionPreference() {
    document.documentElement.classList.toggle('mm-reduced-motion', reducedMotion);
  }

  function onModalKeydown(event) {
    if (!modalOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      const modal = document.getElementById('mm-modal');
      const focusables = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const idx = focusables.indexOf(document.activeElement);
      const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight' ||
        (event.key === 'Tab' && !event.shiftKey);
      const next = forward
        ? (idx + 1) % focusables.length
        : (idx <= 0 ? focusables.length - 1 : idx - 1);
      focusables[next].focus({ preventScroll: true });
    }
  }

  function observeScreen() {
    const observer = new MutationObserver(() => {
      const active = screen.classList.contains('active');
      if (active && !wasActive) onShow();
      if (!active && wasActive && modalOpen) closeModal();
      wasActive = active;
    });
    observer.observe(screen, { attributes: true, attributeFilter: ['class'] });

    const modal = document.getElementById('mm-modal');
    if (modal) modal.addEventListener('transitionend', () => {});
  }

  function init() {
    if (initialized) return;
    initialized = true;
    cache();
    if (!els.cta || !els.name) return;
    musicOn = readBool(STORAGE.music, true);
    reducedMotion = readBool(STORAGE.motion, false);
    quickSongs = readBool(STORAGE.quickSongs, false);
    applyMotionPreference();
    preload();
    bindCards();
    bindUtility();
    ensureModal();
    document.addEventListener('keydown', onModalKeydown, true);

    renderMode(selectedMode, { instant: true });
    observeScreen();
    applyMusicPreference();
    if (screen.classList.contains('active')) onShow();
  }

  return {
    init,
    selectMode: select,
    isMusicEnabled: () => musicOn,
    isReducedMotion: () => reducedMotion,
    isQuickSongs: () => quickSongs,
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MainMenu.init(), { once: true });
} else {
  MainMenu.init();
}
