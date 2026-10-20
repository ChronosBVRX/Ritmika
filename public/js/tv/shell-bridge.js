// ═══════════════════════════════════════════════════════════
//  RÍTMIKA · PUENTE DEL SHELL NATIVO
//  El WebView sigue siendo el motor de sala/socket/juego;
//  este puente alimenta el menú/lobby nativo de Android.
// ═══════════════════════════════════════════════════════════

(function () {
  const shellMode = /[?&]shell=1/.test(location.search);
  if (!shellMode) return;
  if (typeof AndroidNative === 'undefined' || !AndroidNative.onShellState) return;

  let lastJson = '';
  let pushTimer = null;

  function enterShellScreen() {
    try {
      const pre = document.getElementById('pre-boot-screen');
      if (pre) pre.style.display = 'none';
      const boot = document.getElementById('bootloader-screen');
      if (boot) boot.style.display = 'none';
      document.querySelectorAll('.tv-screen').forEach(s => s.classList.remove('active'));
      const menu = document.getElementById('mode-selection-screen');
      if (menu) menu.classList.add('active');
      if (typeof MainMenu !== 'undefined') MainMenu.init();
      if (typeof bootMusic !== 'undefined' && bootMusic) {
        bootMusic.volume = 0.25;
        bootMusic.play().catch(() => {});
      }
      console.log('[Shell] pantalla nativa lista');
    } catch (e) {
      console.warn('[Shell] enterShellScreen', e);
    }
  }

  function collect() {
    const active = document.querySelector('.tv-screen.active');
    const podium = document.getElementById('podium-screen');
    let screen = 'boot';
    if (active) {
      if (active.id === 'mode-selection-screen') screen = 'menu';
      else if (active.id === 'lobby-screen') screen = 'lobby';
      else screen = 'game';
    } else if (podium) {
      screen = 'game';
    }

    const players = (typeof state !== 'undefined' ? state.players : [])
      .filter(p => !p.disconnected)
      .map(p => ({ name: p.name || '', avatarId: p.avatarId ?? 0, score: p.score || 0 }));

    let qr = null;
    try {
      const canvas = document.getElementById('qr-conexion-sala');
      if (canvas && canvas.width > 0) qr = canvas.toDataURL('image/png');
    } catch (_) {}

    let music = true;
    let motion = false;
    let perf = 'auto';
    try {
      music = localStorage.getItem('ritmika_menu_music') !== '0';
      motion = localStorage.getItem('ritmika_reduced_motion') === '1';
      perf = localStorage.getItem('ritmika_perf_mode') || 'auto';
    } catch (_) {}

    const start = document.getElementById('start-btn');
    return {
      screen,
      selectedMode: typeof selectedMode !== 'undefined' ? selectedMode : 'clasico',
      roomCode: typeof state !== 'undefined' ? (state.roomCode || '') : '',
      mode: typeof state !== 'undefined' ? (state.gameMode || 'clasico') : 'clasico',
      joinUrl: (typeof state !== 'undefined' && state.joinUrl) || window.__ritmikaJoinUrl || '',
      qr,
      players,
      canStart: !!start && !start.classList.contains('hidden') && !start.disabled,
      music,
      motion,
      perf,
      round: typeof state !== 'undefined' ? state.round : 0,
    };
  }

  function push(force) {
    try {
      const json = JSON.stringify(collect());
      if (force || json !== lastJson) {
        lastJson = json;
        AndroidNative.onShellState(json);
      }
    } catch (e) {
      console.warn('[Shell] state', e);
    }
  }

  window.__ritmikaShellPush = () => push(true);

  window.__nativeShellSelectMode = (mode) => {
    console.log('[Shell] select', mode);
    if (typeof MainMenu !== 'undefined' && typeof MainMenu.selectMode === 'function') {
      MainMenu.selectMode(mode, { instant: true, force: true });
      console.log('[Shell] web selected', typeof selectedMode !== 'undefined' ? selectedMode : '?');
    }
  };
  window.__nativeShellCreateRoom = () => {
    if (typeof MainMenu !== 'undefined' && typeof MainMenu.createRoom === 'function') MainMenu.createRoom();
  };
  window.__nativeShellStartGame = () => {
    const start = document.getElementById('start-btn');
    if (start) start.click();
  };
  window.__nativeShellBackToMenu = () => {
    const back = document.getElementById('btn-back-to-modes');
    if (back) back.click();
  };
  window.__nativeShellUnlockAudio = () => {
    try {
      if (typeof bootMusic !== 'undefined' && bootMusic) {
        bootMusic.volume = 0.25;
        bootMusic.play().catch(() => {});
      }
    } catch (_) {}
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        if (ctx.state === 'suspended') ctx.resume();
      }
    } catch (_) {}
  };

  function boot() {
    enterShellScreen();
    push(true);
    if (pushTimer) clearInterval(pushTimer);
    pushTimer = setInterval(() => push(false), 1000);
    setTimeout(() => push(true), 900);
    setTimeout(() => push(true), 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
