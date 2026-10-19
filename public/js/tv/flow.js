// ═══ DIRECTOR DE FLUJO ═══
// Fuente única de verdad para las fases del juego.
//
// Objetivos:
//  - Ninguna transición ocurre mientras Axolo está hablando.
//  - Las pausas se calculan sobre el audio real, no con tiempos fijos.
//  - La partida avanza sola; el host puede adelantarla desde el celular.
//  - La TV no necesita foco, teclado ni control remoto.
// ==============================================

const FlowDirector = (function () {
  const PHASE_META = {
    lobby:            { label: 'Sala de espera',       hint: 'El host inicia desde su celular' },
    starting:         { label: 'Iniciando partida',    hint: '' },
    roulette_wait:    { label: 'Ruleta',               hint: 'La ruleta gira sola' },
    roulette_spin:    { label: 'Girando la ruleta',    hint: '' },
    singer_result:    { label: 'Turno asignado',       hint: 'La canción empieza sola' },
    karaoke_intro:    { label: 'Preparando canción',   hint: 'Tío Axolo está presentando' },
    karaoke:          { label: 'En vivo',              hint: 'La votación abre al terminar' },
    vote_pending:     { label: 'Cerrando canción',     hint: '' },
    vote:             { label: 'Votación abierta',     hint: 'Cierra automáticamente' },
    scoreboard:       { label: 'Resultados',           hint: 'El siguiente turno avanza solo' },
    round_transition: { label: 'Cambio de ronda',      hint: '' },
    podium:           { label: 'Premiación',           hint: 'La ceremonia avanza sola' },
    podium_final:     { label: 'Podio final',          hint: 'El host puede iniciar otra partida' },
  };

  const flow = {
    phase: 'lobby',
    token: 0,
    action: null,
    run: null,
    singerSocketId: null,
    canAct: false,
    autoAt: 0,
    job: null,
    jobTimer: null,
  };

  function voiceBusy() {
    if (window.AxoloNarrator && typeof window.AxoloNarrator.isBusy === 'function') {
      return window.AxoloNarrator.isBusy();
    }
    return !!currentAxoloAudio ||
      (typeof axoloQueue !== 'undefined' && axoloQueue.length > 0) ||
      !!_queueDrainTimeout;
  }

  function whenVoiceIdle(maxMs) {
    if (window.AxoloNarrator && typeof window.AxoloNarrator.whenIdle === 'function') {
      return window.AxoloNarrator.whenIdle({ maxMs: maxMs || 30000 });
    }
    return new Promise(resolve => {
      const started = Date.now();
      (function poll() {
        if (!voiceBusy()) return resolve(true);
        if (Date.now() - started > (maxMs || 30000)) return resolve(false);
        setTimeout(poll, 120);
      })();
    });
  }

  function meta() {
    return PHASE_META[flow.phase] || { label: flow.phase, hint: '' };
  }

  function broadcast(reason) {
    renderBadge();
    if (typeof socket === 'undefined' || !socket || typeof state === 'undefined' || !state.roomCode) return;
    const now = Date.now();
    socket.emit('tv:broadcast', {
      roomCode: state.roomCode,
      event: 'PHASE_STATE',
      data: {
        phase: flow.phase,
        label: meta().label,
        hint: meta().hint,
        action: flow.action,
        canAct: flow.canAct,
        singerSocketId: flow.singerSocketId,
        autoInMs: flow.canAct && flow.autoAt ? Math.max(0, flow.autoAt - now) : null,
        narration: voiceBusy(),
        reason: reason || '',
      },
    });
  }

  function cancelJob() {
    if (flow.jobTimer) {
      clearTimeout(flow.jobTimer);
      flow.jobTimer = null;
    }
    flow.job = null;
  }

  function tick() {
    flow.jobTimer = null;
    const job = flow.job;
    if (!job) return;
    if (job.token !== flow.token) { cancelJob(); return; }

    const elapsed = Date.now() - job.startedAt;
    if (job.minMs > elapsed) {
      flow.jobTimer = setTimeout(tick, Math.min(200, job.minMs - elapsed));
      return;
    }

    if (job.waitVoice && voiceBusy()) {
      if (elapsed < job.minMs + job.maxVoiceWaitMs) {
        flow.jobTimer = setTimeout(tick, 120);
        return;
      }
      // Salvavidas: un MP3 corrupto no puede congelar la partida.
      console.warn('[Flow] Audio de Axolo excedió la espera máxima; continuando fase', flow.phase);
    }

    if (!flow.canAct) {
      flow.canAct = true;
      flow.autoAt = job.holdMs > 0 ? Date.now() + job.holdMs : 0;
      broadcast('ready');
    }

    if (!flow.autoAt || Date.now() >= flow.autoAt) {
      const run = flow.run;
      cancelJob();
      if (typeof run === 'function') {
        try { run(); } catch (err) { console.error('[Flow] Error al avanzar fase:', err); }
      }
      return;
    }

    renderBadge();
    flow.jobTimer = setTimeout(tick, Math.min(250, Math.max(40, flow.autoAt - Date.now())));
  }

  function enter(phase, opts) {
    opts = opts || {};
    flow.token++;
    cancelJob();
    flow.phase = phase;
    flow.action = opts.action || null;
    flow.run = opts.run || null;
    flow.singerSocketId = opts.singerSocketId || null;
    flow.canAct = false;
    flow.autoAt = 0;
    broadcast('enter:' + phase);
    return flow.token;
  }

  function armAuto(opts) {
    opts = opts || {};
    if (typeof flow.run !== 'function') return;
    cancelJob();
    flow.canAct = false;
    flow.autoAt = 0;
    flow.job = {
      token: flow.token,
      startedAt: Date.now(),
      minMs: opts.minMs || 0,
      holdMs: opts.holdMs || 0,
      waitVoice: opts.waitVoice !== false,
      maxVoiceWaitMs: opts.maxVoiceWaitMs || 30000,
    };
    broadcast('armed');
    tick();
  }

  // Acorta la espera actual (ej. todos votaron o todos asignaron canción).
  // Nunca salta el audio: solo reduce el tiempo mínimo de pantalla.
  function hasten(minMs, holdMs) {
    if (!flow.job) {
      if (typeof flow.run !== 'function') return;
      flow.job = {
        token: flow.token,
        startedAt: Date.now(),
        minMs: 0,
        holdMs: 0,
        waitVoice: true,
        maxVoiceWaitMs: 30000,
      };
    }
    flow.job.minMs = Math.max(0, minMs || 0);
    flow.job.startedAt = Date.now() - flow.job.minMs;
    flow.job.holdMs = Math.max(0, holdMs || 0);
    if (flow.canAct) flow.autoAt = flow.job.holdMs ? Date.now() + flow.job.holdMs : 0;
    if (flow.jobTimer) clearTimeout(flow.jobTimer);
    flow.jobTimer = setTimeout(tick, 40);
  }

  function request(action) {
    if (!flow.action || action !== flow.action) return false;
    if (!flow.canAct || typeof flow.run !== 'function') return false;
    const run = flow.run;
    cancelJob();
    flow.canAct = false;
    flow.autoAt = 0;
    broadcast('request:' + action);
    setTimeout(() => {
      try { run(); } catch (err) { console.error('[Flow] Error en acción manual:', err); }
    }, 0);
    return true;
  }

  // Deja una fase lista sin avance automático (podio final, lobby...).
  function makeReady() {
    cancelJob();
    flow.canAct = true;
    flow.autoAt = 0;
    broadcast('ready:manual');
  }

  function sendToPlayer(socketId) {
    if (!socketId || typeof socket === 'undefined' || !socket) return;
    const now = Date.now();
    socket.emit('tv:send_to_player', {
      targetSocketId: socketId,
      event: 'PHASE_STATE',
      data: {
        phase: flow.phase,
        label: meta().label,
        hint: meta().hint,
        action: flow.action,
        canAct: flow.canAct,
        singerSocketId: flow.singerSocketId,
        autoInMs: flow.canAct && flow.autoAt ? Math.max(0, flow.autoAt - now) : null,
        narration: voiceBusy(),
        reason: 'resync',
      },
    });
  }

  function current() {
    return {
      phase: flow.phase,
      action: flow.action,
      canAct: flow.canAct,
      singerSocketId: flow.singerSocketId,
      autoInMs: flow.canAct && flow.autoAt ? Math.max(0, flow.autoAt - Date.now()) : null,
    };
  }

  // ── Indicador visual en TV ────────────────────────────────
  let badgeEl = null;
  let badgeTimer = null;

  function ensureBadge() {
    if (badgeEl && document.body.contains(badgeEl)) return badgeEl;
    const style = document.createElement('style');
    style.id = 'flow-badge-css';
    style.textContent = [
      '#flow-auto-badge{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9998;',
      'display:flex;align-items:center;gap:10px;padding:8px 18px;background:rgba(15,23,42,.94);',
      'border:3px solid #111827;box-shadow:5px 5px 0 #111827;font-family:Fredoka,sans-serif;',
      'pointer-events:none;user-select:none;transition:opacity .25s ease;}',
      '#flow-auto-badge.hidden{opacity:0;}',
      '#flow-auto-badge .flow-dot{width:10px;height:10px;border-radius:50%;background:#22c55e;',
      'box-shadow:0 0 10px #22c55e;flex-shrink:0;animation:flow-pulse 1.4s ease-in-out infinite;}',
      '#flow-auto-badge.talking .flow-dot{background:#ffe600;box-shadow:0 0 10px #ffe600;}',
      '#flow-auto-badge.ready .flow-dot{background:#22c55e;}',
      '#flow-auto-badge .flow-phase{font-size:13px;font-weight:900;color:#f8fafc;letter-spacing:1px;text-transform:uppercase;}',
      '#flow-auto-badge .flow-hint{font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:.5px;}',
      '#flow-auto-badge .flow-count{font-size:14px;font-weight:900;color:#facc15;min-width:34px;text-align:right;}',
      '@keyframes flow-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}',
    ].join('');
    document.head.appendChild(style);
    badgeEl = document.createElement('div');
    badgeEl.id = 'flow-auto-badge';
    badgeEl.className = 'hidden';
    badgeEl.innerHTML =
      '<span class="flow-dot"></span>' +
      '<span class="flow-phase"></span>' +
      '<span class="flow-hint"></span>' +
      '<span class="flow-count"></span>';
    document.body.appendChild(badgeEl);
    return badgeEl;
  }

  function renderBadge() {
    const el = ensureBadge();
    if (!el) return;
    const hide = flow.phase === 'lobby' || flow.phase === 'starting' || flow.phase === 'podium' || flow.phase === 'podium_final';
    if (hide) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const info = meta();
    const phaseEl = el.querySelector('.flow-phase');
    const hintEl = el.querySelector('.flow-hint');
    const countEl = el.querySelector('.flow-count');
    phaseEl.textContent = info.label;
    el.classList.toggle('talking', voiceBusy());
    el.classList.toggle('ready', flow.canAct);

    if (!flow.action) {
      hintEl.textContent = info.hint || '';
      countEl.textContent = '';
      return;
    }

    if (flow.canAct && flow.autoAt) {
      const secs = Math.max(0, Math.ceil((flow.autoAt - Date.now()) / 1000));
      hintEl.textContent = 'Avance automático';
      countEl.textContent = secs + 's';
    } else if (flow.canAct) {
      hintEl.textContent = 'Listo';
      countEl.textContent = '';
    } else if (voiceBusy()) {
      hintEl.textContent = 'Axolo está hablando…';
      countEl.textContent = '';
    } else {
      hintEl.textContent = info.hint || 'Preparando…';
      countEl.textContent = '';
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        ensureBadge();
        renderBadge();
        if (!badgeTimer) badgeTimer = setInterval(renderBadge, 300);
      }, { once: true });
    } else {
      ensureBadge();
      renderBadge();
      badgeTimer = setInterval(renderBadge, 300);
    }
  }

  return {
    enter,
    armAuto,
    hasten,
    request,
    makeReady,
    cancelJob,
    whenVoiceIdle,
    sendToPlayer,
    current,
    isReady: () => flow.canAct,
    isVoiceBusy: voiceBusy,
    getPhase: () => flow.phase,
    getSingerSocketId: () => flow.singerSocketId,
  };
})();
