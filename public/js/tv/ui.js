// ═══ UI & ANIMACIONES ═══
// Módulo extraído de tv.html
// ==============================================

// ════════════════════════════════════════════
//  JACKBOXFX — Sistema Central de Animaciones
// ════════════════════════════════════════════
const JackboxFX = {
  // Aparición elástica desde escala 0 con rebote
  popIn(selector, opts = {}) {
    const delay    = opts.delay    ?? 0;
    const duration = opts.duration ?? 800;
    anime({
      targets:  selector,
      scale:    [0, 1.08, 1],
      opacity:  [0, 1],
      duration,
      delay,
      easing:   'easeOutElastic(1, .5)',
    });
  },

  // Shake horizontal para errores / sabotajes
  shakeError(selector) {
    anime({
      targets:   selector,
      translateX: [0, -12, 12, -10, 10, -6, 6, 0],
      duration:  500,
      easing:    'easeInOutSine',
    });
  },

  // Stagger popIn para listas de elementos
  staggerIn(selector, staggerMs = 120) {
    anime({
      targets:    selector,
      scale:      [0, 1.06, 1],
      opacity:    [0, 1],
      translateY: [20, 0],
      duration:   700,
      delay:      anime.stagger(staggerMs),
      easing:     'easeOutElastic(1, .5)',
    });
  },
};

// ════════════════════════════════════════════
//  SEQUENCED LOBBY WELCOME
// ════════════════════════════════════════════
let lobbyWelcomeDone = false;

function animateLobbyWelcome() {
  if (lobbyWelcomeDone) return;
  lobbyWelcomeDone = true;

  // La transición desde modos puede traer una frase a medias. Se desvanece
  // para entrar al lobby sin voz ni cut-in invadiendo la sala.
  if (window.AxoloNarrator && typeof window.AxoloNarrator.fadeOutAndStop === 'function') {
    window.AxoloNarrator.fadeOutAndStop(320);
  }

  // Hide elements for staggered reveal (only on first load)
  document.querySelectorAll('.lobby-stagger').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'scale(0.5)';
  });
  document.querySelectorAll('.lobby-slide').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
  });
  document.querySelectorAll('.lobby-fade').forEach(el => {
    el.style.opacity = '0';
  });

  const timeline = [
    { sel: '.lobby-stagger[data-stagger="0"]', fn: 'popIn', delay: 200 },
    { sel: '.lobby-stagger[data-stagger="1"]', fn: 'popIn', delay: 500 },
    { sel: '.lobby-slide[data-stagger="3"]',   fn: 'slideUp', delay: 900 },
    { sel: '.lobby-fade[data-stagger="4"]',    fn: 'popIn', delay: 1200 },
    { sel: '.lobby-slide[data-stagger="5"]',   fn: 'slideUp', delay: 1500 },
    { sel: '.lobby-fade[data-stagger="6"]',    fn: 'popIn', delay: 1700 },
  ];

  timeline.forEach(item => {
    setTimeout(() => {
      document.querySelectorAll(item.sel).forEach(el => {
        el.style.opacity = '';
        el.style.transform = '';
      });
      RitmikaStyleFX[item.fn](item.sel, { delay: 0 });
    }, item.delay);
  });

  setTimeout(() => {
    document.querySelectorAll('.code-letter').forEach((el, i) => {
      RitmikaStyleFX.dropIn(el, { delay: i * 120 });
    });
  }, 600);

  setTimeout(() => {
    if (window.pendingLobbyAudio) {
      axoloSay(window.pendingLobbyAudio.text, window.pendingLobbyAudio.file);
      window.pendingLobbyAudio = null;
    } else {
      const wChoice = LOBBY_WELCOME_PHRASES[Math.floor(Math.random() * LOBBY_WELCOME_PHRASES.length)];
      axoloSay(wChoice.text, wChoice.file);
    }
  }, 1200);
}

// ════════════════════════════════════════════
//  ROUND SPLASH CEREMONY
// ════════════════════════════════════════════
const ROUND_SPLASH_DATA = [
  { number: 'RONDA 1', title: 'Tu Elección, Tu Condena',  subtitle: 'La ruleta decide quién canta primero' },
  { number: 'RONDA 2', title: 'Fuego Cruzado',           subtitle: 'Asigna canciones a tus rivales' },
  { number: 'RONDA 3', title: 'Apagón Mental',           subtitle: 'Canta de memoria o muere en el intento' },
];

function showRoundSplash(round, callback) {
  const data = ROUND_SPLASH_DATA[round - 1] || ROUND_SPLASH_DATA[0];
  const splash = document.getElementById('round-splash');
  document.getElementById('splash-number-text').textContent = data.number;
  document.getElementById('splash-title-text').textContent  = data.title;
  document.getElementById('splash-subtitle-text').textContent = data.subtitle;

  splash.style.opacity = '1';
  splash.style.pointerEvents = 'all';

  UISounds.playChime();
  playSfx('./assets/audio/sting_round_start.mp3', 0.5);
  RitmikaStyleFX.bigReveal('#splash-number-text', { delay: 200, rotate: true });
  setTimeout(() => { RitmikaStyleFX.slideUp('#splash-title-text'); }, 600);
  setTimeout(() => { RitmikaStyleFX.popIn('#splash-subtitle-text'); }, 1000);

  setTimeout(() => {
    UISounds.playTone(880, 0.3, 'sine', 0.12);
    RitmikaStyleFX.flashBang('#ffffff', 200);
    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    ['splash-number-text','splash-title-text','splash-subtitle-text'].forEach(id => {
      const el = document.getElementById(id);
      el.style.opacity = '0';
      el.style.transform = '';
    });
    if (callback) callback();
  }, 2600);
}

// ════════════════════════════════════════════
//  COUNTDOWN 3-2-1
// ════════════════════════════════════════════
function showCountdown(callback) {
  const overlay = document.getElementById('countdown-overlay');
  const numberEl = document.getElementById('countdown-number');
  const steps = ['3', '2', '1', '¡YA!'];
  let idx = 0;

  overlay.style.opacity = '1';

  function showStep() {
    if (idx >= steps.length) {
      overlay.style.opacity = '0';
      if (callback) callback();
      return;
    }

    numberEl.textContent = steps[idx];
    numberEl.style.opacity = '0';
    numberEl.style.transform = 'scale(0.5)';

    if (steps[idx] !== '¡YA!') UISounds.tick();
    else UISounds.stinger();

    anime({
      targets: numberEl,
      scale: ['0.5', '1.2', '1'],
      opacity: [0, 1, 1],
      duration: 400,
      easing: 'easeOutBack',
      complete: () => {
        setTimeout(() => {
          anime({
            targets: numberEl,
            scale: ['1', '1.5'],
            opacity: [1, 0],
            duration: 250,
            easing: 'easeInCubic',
            complete: () => {
              idx++;
              if (steps[idx-1] === '¡YA!') {
                RitmikaStyleFX.flashBang('#ffe600', 300);
              }
              showStep();
            }
          });
        }, idx < steps.length ? 400 : 100);
      }
    });
  }

  showStep();
}



// El cut-in de Axolo debe verse en CUALQUIER pantalla (modos, rondas, podio),
// pero en el HTML vive dentro de #karaoke-screen. Se re-parenta al body.
document.addEventListener('DOMContentLoaded', () => {
  const ov = document.getElementById('axolo-cutin-overlay');
  if (ov && ov.parentElement !== document.body) document.body.appendChild(ov);
}, { once: true });

// ════════════════════════════════════════════
//  ASSETS ANIMADOS (pipeline ComfyUI/AnimateDiff)
//  Los clips viven en public/assets/anim/*.webm (VP9 + alfa). Si un clip no
//  existe o falla, se conserva la imagen estática: nunca se rompe la UI.
// ════════════════════════════════════════════
const ANIM_DIR = './assets/anim/';
const _animProto = {};
const _animFailed = {};

function animProto(key) {
  if (_animFailed[key]) return null;
  if (_animProto[key]) return _animProto[key];
  const v = document.createElement('video');
  v.src = ANIM_DIR + key + '.webm';
  v.autoplay = true;
  v.loop = true;
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('muted', '');
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  v.addEventListener('error', () => { _animFailed[key] = true; }, { once: true });
  _animProto[key] = v;
  return v;
}

/* Monta la animación dentro de `host` (cubre `cover`, tamaño 100%). */
function mountAnim(host, key, css) {
  if (!host) return null;
  const proto = animProto(key);
  if (!proto) return null;
  const prev = host.querySelector('video[data-anim]');
  if (prev && prev.dataset.anim === key) { prev.play().catch(()=>{}); return prev; }
  if (prev) prev.remove();
  const v = proto.cloneNode(false);
  v.dataset.anim = key;
  v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;' + (css || '');
  host.appendChild(v);
  v.play().catch(() => {
    v.remove();
    const still = host.querySelector('img');
    if (still) still.style.visibility = '';
  });
  return v;
}

/* Cambia una <img> por su versión animada (per-evento, con respaldo). */
function animateImg(imgEl, key, css) {
  if (!imgEl || !imgEl.parentNode) return null;
  if (imgEl.dataset.animMounted === key) return null;
  const proto = animProto(key);
  if (!proto) return null;
  const v = proto.cloneNode(false);
  v.dataset.anim = key;
  v.style.cssText = imgEl.style.cssText + ';' + (css || '');
  v.className = imgEl.className;
  if (imgEl.dataset.animMounted) {
    const old = imgEl.parentNode.querySelector('video[data-anim]');
    if (old) old.remove();
  }
  imgEl.dataset.animMounted = key;
  imgEl.style.visibility = 'hidden';
  imgEl.parentNode.insertBefore(v, imgEl.nextSibling);
  v.play().catch(() => { v.remove(); imgEl.style.visibility = ''; imgEl.dataset.animMounted = ''; });
  return v;
}

// ════════════════════════════════════════════
//  SCREEN SYSTEM
// ════════════════════════════════════════════
function showScreen(id, transitionType, onComplete) {
  const current = document.querySelector('.tv-screen.active');
  const next    = document.getElementById(id);
  if (!next || (current && current.id === id)) return;

  if (!current) {
    next.style.display = '';
    next.style.opacity = '';
    next.style.transform = '';
    next.classList.add('active');
    if (onComplete) onComplete();
    return;
  }

  const type = transitionType || 'slide';

  const transitions = {

    // Default slide: current out left, new in from right
    slide() {
      UISounds.whoosh();
      anime({
        targets: current,
        translateX: [0, '-100vw'],
        opacity: [1, 0],
        duration: 380,
        easing: 'easeInCubic',
        complete: () => {
          current.classList.remove('active');
          current.style.transform = '';
          current.style.opacity = '';
          current.style.display = '';
          next.style.transform = 'translateX(100vw)';
          next.style.opacity = '0';
          next.style.display = '';
          next.classList.add('active');
          anime({
            targets: next,
            translateX: ['100vw', '0px'],
            opacity: [0, 1],
            duration: 500,
            easing: 'easeOutElastic(1, .6)',
            complete: () => {
              next.style.transform = '';
              next.style.opacity = '';
              if (onComplete) onComplete();
            }
          });
        }
      });
    },

    // Flash: flash white, swap screens, popIn the new one
    flash() {
      current.classList.remove('active');
      current.style.display = '';
      current.style.opacity = '';
      current.style.transform = '';
      next.classList.add('active');
      next.style.display = '';
      next.style.opacity = '';
      next.style.transform = '';
      RitmikaStyleFX.flashBang('#ffffff', 300);
      RitmikaStyleFX.popIn('#' + id);
      if (onComplete) onComplete();
    },

    // Zoom out / in: current shrinks to 0, new expands from 0
    zoom() {
      anime({
        targets: current,
        scale: [1, 0],
        opacity: [1, 0],
        duration: 350,
        easing: 'easeInCubic',
        complete: () => {
          current.classList.remove('active');
          current.style.transform = '';
          current.style.opacity = '';
          current.style.display = '';
          next.style.transform = 'scale(0.3)';
          next.style.opacity = '0';
          next.style.display = '';
          next.classList.add('active');
          anime({
            targets: next,
            scale: ['0.3', '1.05', '1'],
            duration: 600,
            easing: 'easeOutElastic(1, .5)',
            complete: () => {
              next.style.transform = '';
              next.style.opacity = '';
              if (onComplete) onComplete();
            }
          });
        }
      });
    },

    // Fade: crossfade
    fade() {
      anime({
        targets: current,
        opacity: [1, 0],
        duration: 300,
        easing: 'easeInCubic',
        complete: () => {
          current.classList.remove('active');
          current.style.opacity = '';
          current.style.display = '';
          current.style.transform = '';
          next.style.opacity = '0';
          next.style.display = '';
          next.style.transform = '';
          next.classList.add('active');
          anime({
            targets: next,
            opacity: [0, 1],
            duration: 400,
            easing: 'easeOutCubic',
            complete: () => {
              next.style.opacity = '';
              if (onComplete) onComplete();
            }
          });
        }
      });
    },

  };

  (transitions[type] || transitions.slide)();
}


// Apply Mode Theme based on gameMode
window.applyModeTheme = function(forcedMode) {
  const modeToApply = forcedMode || (typeof state !== 'undefined' ? state.gameMode : 'clasico');
  if (modeToApply && modeToApply !== 'clasico') {
    document.body.setAttribute('data-mode', modeToApply);
  } else {
    document.body.removeAttribute('data-mode');
  }
};

// --- MODE THEME HELPERS ---
window.getModeRoundLabels = function() {
  if (typeof state !== 'undefined' && state.gameMode === 'emo') {
    return {
      badges: [
        'Ronda 1 — Mi Rola Triste',
        'Ronda 2 — Dedicada al Ex',
        'Ronda 3 — Apagón del Corazón'
      ],
      headings: [
        '¿Quién llora primero?',
        '¿A quién le vas a dedicar esta indirecta?',
        'Canta de memoria, como si todavía doliera.'
      ]
    };
  }
  if (typeof state !== 'undefined' && state.gameMode === 'ranchera') {
    return {
      badges: [
        'Ronda 1 — Tu Despecho',
        'Ronda 2 — La Indirecta',
        'Ronda 3 — Apagón del Mariachi'
      ],
      headings: [
        '¿Quién aguanta el despecho?',
        '¿A quién le vas a dedicar esta canción?',
        'Canta de memoria, como en el palenque.'
      ]
    };
  }
  if (typeof state !== 'undefined' && state.gameMode === 'nostalgia') {
    return {
      badges: [
        'Ronda 1 — Tu Hit de los 2000',
        'Ronda 2 — Mixtape para el Ex',
        'Ronda 3 — Apagón del Recuerdo'
      ],
      headings: [
        '¿Quién prende la pista?',
        '¿A quién le dedicas el mixtape?',
        'Canta de memoria, como en la prepa.'
      ]
    };
  }
  return null; // Fallback a clasico
};

window.getModeQueryParam = function() {
  if (typeof state !== 'undefined' && state.gameMode && state.gameMode !== 'clasico') {
    return `&mode=${state.gameMode}`;
  }
  return '';
};
