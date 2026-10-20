// ══════════════════════════════════════════════════════════
//  RÍTMIKA · PREMIUM FX
//  Capa de presentación para ruleta, retos, apagón y tomatazos.
//  Envuelve funciones existentes: no reemplaza la lógica del juego.
// ══════════════════════════════════════════════════════════
(function () {
  'use strict';

  const HD_TOMATO = '/assets/tomato_projectile_hd.webp';
  const HD_SPLAT = '/assets/tomato_splat_hd.webp';
  const STAIN_SPLAT = '/assets/tomato_splat.svg';
  const FALLBACK_TOMATO = '/assets/tomato_projectile.webp';
  const FALLBACK_SPLAT = '/assets/tomato_splat.webp';

  function isPerformance() {
    return window.RITMIKA_PERF_MODE === 'performance' ||
      document.documentElement.classList.contains('ritmika-perf');
  }

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function assetSrc(img, hd, fallback) {
    img.src = hd;
    img.addEventListener('error', function onError() {
      img.removeEventListener('error', onError);
      img.src = fallback;
    }, { once: true });
  }

  // ─────────────────────────────────────────────
  //  Escenario de la ruleta
  // ─────────────────────────────────────────────
  function injectRouletteStage() {
    const screen = document.getElementById('roulette-screen');
    if (!screen || screen.dataset.rfxStage === '1') return;
    screen.dataset.rfxStage = '1';

    const beamLeft = el('div', 'rfx-stage-beam is-left');
    const beamRight = el('div', 'rfx-stage-beam is-right');
    const spot = el('div', 'rfx-stage-spot');
    const grain = el('div', 'rfx-stage-grain');
    screen.insertBefore(beamRight, screen.firstChild);
    screen.insertBefore(beamLeft, beamRight);
    screen.insertBefore(spot, beamRight);
    screen.insertBefore(grain, beamRight);
  }

  function decorateWheel() {
    const wrap = document.getElementById('roulette-wrap');
    if (!wrap) return;
    if (!wrap.querySelector('.rfx-wheel-glow')) {
      wrap.insertBefore(el('div', 'rfx-wheel-glow'), wrap.firstChild);
    }
    if (!wrap.querySelector('.rfx-winner-rays')) {
      wrap.insertBefore(el('div', 'rfx-winner-rays'), wrap.firstChild);
    }
    if (!wrap.querySelector('.rfx-wheel-aura')) {
      wrap.insertBefore(el('div', 'rfx-wheel-aura'), wrap.firstChild);
    }
  }

  let chipObserver = null;

  function observeChips() {
    const list = document.getElementById('roulette-players-mini');
    if (!list) return;
    if (chipObserver) chipObserver.disconnect();
    chipObserver = new MutationObserver(() => decorateChips());
    chipObserver.observe(list, { childList: true });
  }

  function decorateChips() {
    const list = document.getElementById('roulette-players-mini');
    if (!list) return;
    if (chipObserver) chipObserver.disconnect();

    const chips = [...list.querySelectorAll('.roulette-player-chip')];
    const ranked = chips
      .map(chip => {
        const scoreEl = chip.querySelector('.chip-score');
        const score = parseInt((scoreEl && scoreEl.textContent) || '0', 10) || 0;
        return { chip, score };
      })
      .sort((a, b) => b.score - a.score);

    chips.forEach(chip => {
      const img = chip.querySelector('img');
      if (img && img.style.borderColor) {
        chip.style.setProperty('--chip-color', img.style.borderColor);
      }
      if (!chip.querySelector('.chip-rank')) {
        const rank = el('span', 'chip-rank', '01');
        chip.insertBefore(rank, chip.firstChild);
      }
    });

    ranked.forEach(({ chip }, index) => {
      const rank = chip.querySelector('.chip-rank');
      if (rank) rank.textContent = String(index + 1).padStart(2, '0');
      list.appendChild(chip);
    });

    if (chipObserver) chipObserver.observe(list, { childList: true });
  }

  function prepareRoulette() {
    injectRouletteStage();
    decorateWheel();
    decorateChips();
    observeChips();
    const screen = document.getElementById('roulette-screen');
    if (screen) {
      screen.classList.remove('is-revealing');
      screen.classList.remove('is-spinning');
    }
    const ticker = document.getElementById('event-ticker');
    if (ticker && (!ticker.textContent || /votaci[oó]n|votó|EN VIVO/i.test(ticker.textContent))) {
      ticker.textContent = '🎰 La ruleta está por decidir...';
    }
  }

  // ─────────────────────────────────────────────
  //  Reto de actuación
  // ─────────────────────────────────────────────
  function buildChallengeCard() {
    const banner = document.getElementById('challenge-banner');
    if (!banner) return null;
    const textEl = document.getElementById('challenge-text');
    if (!textEl) return null;
    if (banner.dataset.rfxBuilt === '1') {
      return { banner: banner, text: textEl };
    }

    banner.dataset.rfxBuilt = '1';
    banner.innerHTML = '';

    const stamp = el('span', 'rfx-challenge-stamp', 'RETO');
    const head = el('div', 'rfx-challenge-head');
    head.appendChild(el('span', 'rfx-challenge-icon', '🎭'));
    head.appendChild(el('span', 'rfx-challenge-label', 'RETO DE ACTUACIÓN'));
    const meter = el('div', 'rfx-challenge-meter');
    meter.appendChild(el('div', 'rfx-challenge-meter-fill'));

    banner.appendChild(stamp);
    banner.appendChild(head);
    banner.appendChild(textEl);
    banner.appendChild(meter);
    return { banner: banner, text: textEl };
  }

  function spawnChallengeSparks(banner) {
    if (isPerformance()) return;
    const rect = banner.getBoundingClientRect();
    const palette = ['#ffe600', '#00e5ff', '#f0047f', '#ffffff', '#a855f7'];
    for (let i = 0; i < 12; i++) {
      const spark = el('span', 'rfx-challenge-spark');
      spark.style.left = (20 + Math.random() * (rect.width - 40)) + 'px';
      spark.style.top = (rect.height * 0.35 + Math.random() * 20) + 'px';
      spark.style.background = palette[i % palette.length];
      spark.style.setProperty('--sx', ((Math.random() - 0.5) * 180) + 'px');
      spark.style.setProperty('--sy', (-40 - Math.random() * 90) + 'px');
      spark.style.setProperty('--sr', (Math.random() * 360) + 'deg');
      spark.style.animation = 'rfx-spark-fly 1.15s ease-out ' + (Math.random() * 0.25) + 's both';
      banner.appendChild(spark);
      setTimeout(() => spark.remove(), 1600);
    }
  }

  function enhanceChallenge() {
    const parts = buildChallengeCard();
    if (!parts) return;
    const { banner, text } = parts;
    banner.classList.remove('is-live');
    void banner.offsetWidth;
    banner.classList.add('is-live');

    const stamp = banner.querySelector('.rfx-challenge-stamp');
    if (stamp) {
      stamp.style.animation = 'none';
      void stamp.offsetWidth;
      stamp.style.animation = 'rfx-splat-in 0.5s cubic-bezier(0.2,1.4,0.4,1) both';
    }
    spawnChallengeSparks(banner);

    if (!isPerformance()) {
      try { UISounds.reveal(); } catch (e) {}
      try {
        RitmikaStyleFX.confettiBurst(window.innerWidth * 0.5, window.innerHeight * 0.72, {
          count: 26, colors: ['#ffe600', '#f0047f', '#a855f7', '#00e5ff'],
        });
      } catch (e) {}
    }
    if (text) text.setAttribute('aria-live', 'polite');
  }

  // ─────────────────────────────────────────────
  //  Tomatazo premium
  // ─────────────────────────────────────────────
  function makeProjectile() {
    const wrap = el('div', 'tomato-projectile');
    const img = document.createElement('img');
    img.alt = '🍅';
    assetSrc(img, HD_TOMATO, FALLBACK_TOMATO);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    wrap.appendChild(img);
    return wrap;
  }

  function spawnTrail(fromX, fromY, toX, toY, side) {
    if (isPerformance()) return;
    const dots = 7;
    for (let i = 0; i < dots; i++) {
      setTimeout(() => {
        const t = i / dots;
        const arc = Math.sin(t * Math.PI) * 120;
        const dot = el('div', 'rfx-trail-dot');
        dot.style.position = 'fixed';
        dot.style.left = (fromX + (toX - fromX) * t + (Math.random() - 0.5) * 14) + 'px';
        dot.style.top = (fromY + (toY - fromY) * t - arc + (Math.random() - 0.5) * 14) + 'px';
        dot.style.zIndex = '899';
        dot.style.opacity = String(0.75 - t * 0.5);
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 320);
      }, i * 55);
    }
  }

  function clearSplatFx(overlay) {
    overlay.querySelectorAll('.splat-layer, .rfx-juice, .rfx-impact-shock, .rfx-impact-word, .rfx-impact-meta, .rfx-impact-burst')
      .forEach(node => node.remove());
  }

  function impactSplat(attackerName, targetName, cost) {
    const overlay = document.getElementById('tomato-splat-overlay');
    if (!overlay) return;
    clearSplatFx(overlay);

    const main = overlay.querySelector('.splat-asset');
    if (main) {
      assetSrc(main, STAIN_SPLAT, FALLBACK_SPLAT);
      main.style.animation = 'none';
      void main.offsetWidth;
      main.style.animation = '';
    }

    try {
      RitmikaStyleFX.screenShake(20, 650);
      RitmikaStyleFX.flashBang('#ef4444', 190);
    } catch (e) {}

    try {
      UISounds.playTone(58, 0.42, 'sawtooth', 0.16);
      UISounds.playToneSweep(220, 38, 0.34, 0.12);
      UISounds.playTone(1200, 0.08, 'square', 0.06);
    } catch (e) {}

    overlay.classList.add('visible');
    overlay.style.zIndex = '100';

    if (!isPerformance()) {
      const shock = el('div', 'rfx-impact-shock');
      overlay.appendChild(shock);
      anime({
        targets: shock,
        scale: [0.2, 2.4],
        opacity: [0.95, 0],
        borderWidth: [14, 2],
        duration: 550,
        easing: 'easeOutQuart',
      });

      const burst = document.createElement('img');
      burst.className = 'rfx-impact-burst';
      burst.alt = '';
      assetSrc(burst, HD_SPLAT, FALLBACK_SPLAT);
      burst.style.opacity = '0';
      overlay.appendChild(burst);
      anime({
        targets: burst,
        opacity: [0, 1, 0.9, 0],
        scale: [0.35, 1.06, 1.02, 1.42],
        rotate: [-12, 2, 0, 3],
        duration: 1100,
        easing: 'easeOutCubic',
      });

      const word = el('div', 'rfx-impact-word');
      const wordInner = el('span', '', '¡TOMATAZO!');
      word.appendChild(wordInner);
      word.style.opacity = '0';
      overlay.appendChild(word);
      anime({
        targets: word,
        opacity: [0, 1, 1, 0],
        duration: 1500,
        easing: 'easeOutQuad',
      });
      anime({
        targets: wordInner,
        scale: [0.3, 1.15, 1, 0.96],
        translateY: [0, -4, -8, -22],
        rotate: [-14, -6, -7, -5],
        duration: 1500,
        easing: 'cubicBezier(0.2, 1.6, 0.4, 1)',
      });

      const meta = el('div', 'rfx-impact-meta');
      const metaInner = el('span', '', '');
      metaInner.textContent = (attackerName || 'Alguien') + '  ➜  ' + (targetName || 'su víctima');
      meta.appendChild(metaInner);
      meta.style.opacity = '0';
      overlay.appendChild(meta);
      anime({
        targets: meta,
        opacity: [0, 1, 1, 0],
        translateY: [18, 0, 0, -8],
        duration: 2400,
        easing: 'easeOutCubic',
      });

      for (let i = 0; i < 3; i++) {
        const layer = document.createElement('img');
        layer.className = 'splat-layer';
        assetSrc(layer, STAIN_SPLAT, FALLBACK_SPLAT);
        const size = 12 + Math.random() * 12;
        const angle = Math.random() * 360;
        const radius = 26 + Math.random() * 14;
        layer.style.width = size + 'vmin';
        layer.style.height = size + 'vmin';
        layer.style.left = (50 + Math.cos(angle * Math.PI / 180) * radius * 0.55) + '%';
        layer.style.top = (46 + Math.sin(angle * Math.PI / 180) * radius * 0.6) + '%';
        layer.style.transform = 'translate(-50%, -50%) rotate(' + angle + 'deg)';
        layer.style.opacity = String(0.28 + Math.random() * 0.22);
        layer.style.animationDelay = (0.04 + i * 0.035) + 's';
        overlay.appendChild(layer);
      }

      for (let i = 0; i < 16; i++) {
        const juice = el('div', 'rfx-juice');
        const size = 5 + Math.random() * 12;
        juice.style.width = size + 'px';
        juice.style.height = size + 'px';
        juice.style.left = (46 + (Math.random() - 0.5) * 20) + '%';
        juice.style.top = (44 + (Math.random() - 0.5) * 16) + '%';
        juice.style.setProperty('--jx', ((Math.random() - 0.5) * 420) + 'px');
        juice.style.setProperty('--jy', (-40 + Math.random() * 280) + 'px');
        juice.style.animation = 'rfx-juice-fly ' + (0.6 + Math.random() * 0.6) + 's ease-out ' + (Math.random() * 0.18) + 's both';
        overlay.appendChild(juice);
      }
    }

    if (cost > 0) {
      const penaltyEl = el('div');
      penaltyEl.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); font-family:\'Paytone One\',sans-serif; font-size:clamp(3rem,5vw,5rem); font-weight:900; color:#ef4444; pointer-events:none; z-index:200; text-shadow:0 0 30px rgba(220,38,38,0.85), 6px 6px 0 #111827; opacity:0; white-space:nowrap;';
      penaltyEl.textContent = '\u2212' + cost + ' PTS';
      document.body.appendChild(penaltyEl);
      anime({
        targets: penaltyEl,
        opacity: [0, 1, 1, 0],
        scale: [2.2, 1, 0.86],
        translateY: ['-50%', '-50%', '-82%'],
        duration: 2100,
        easing: 'easeOutCubic',
        complete: () => penaltyEl.remove(),
      });
    }

    setTimeout(() => {
      overlay.classList.remove('visible');
      setTimeout(() => clearSplatFx(overlay), 400);
    }, 4000);
  }

  function premiumTomatazo(attackerName, targetName, cost) {
    const safeCost = Number.isFinite(Number(cost)) ? Number(cost) : 0;
    const tomato = makeProjectile();
    document.body.appendChild(tomato);

    const startSide = Math.random() > 0.5 ? 1 : -1;
    const sx = startSide === 1 ? -110 : window.innerWidth + 110;
    const sy = window.innerHeight * 0.52 + (Math.random() - 0.5) * window.innerHeight * 0.26;
    const ex = window.innerWidth * 0.42 + (Math.random() - 0.5) * window.innerWidth * 0.22;
    const ey = window.innerHeight * 0.32 + (Math.random() - 0.5) * window.innerHeight * 0.16;

    tomato.style.left = sx + 'px';
    tomato.style.top = sy + 'px';

    spawnTrail(sx, sy, ex, ey, startSide);

    try { UISounds.playToneSweep(90, 1500, 0.24, 0.09); } catch (e) {}

    anime({
      targets: tomato,
      left: [sx, ex],
      top: [sy, ey],
      rotate: [0, startSide * 1140],
      scale: [0.45, 1.35, 2.9],
      duration: 640,
      easing: 'easeInQuad',
      complete: () => tomato.remove(),
    });

    setTimeout(() => impactSplat(attackerName, targetName, safeCost), 590);
  }

  // ─────────────────────────────────────────────
  //  Cableado con el flujo existente
  // ─────────────────────────────────────────────
  const originalShowScreen = window.showScreen;
  if (typeof originalShowScreen === 'function') {
    window.showScreen = function (id, transitionType, onComplete) {
      const result = originalShowScreen.apply(this, arguments);
      if (id === 'roulette-screen') {
        requestAnimationFrame(prepareRoulette);
      } else if (id === 'karaoke-screen') {
        const karaoke = document.getElementById('karaoke-screen');
        if (karaoke) karaoke.classList.remove('rfx-blackout');
      }
      return result;
    };
  }

  const originalBuildWheel = window.buildRouletteWheel;
  if (typeof originalBuildWheel === 'function') {
    window.buildRouletteWheel = function () {
      const result = originalBuildWheel.apply(this, arguments);
      requestAnimationFrame(() => { decorateWheel(); decorateChips(); });
      return result;
    };
  }

  const originalStartRoulette = window.startRoulette;
  if (typeof originalStartRoulette === 'function') {
    window.startRoulette = function () {
      const screen = document.getElementById('roulette-screen');
      if (screen) {
        screen.classList.remove('is-revealing');
        screen.classList.remove('is-spinning');
      }
      return originalStartRoulette.apply(this, arguments);
    };
  }

  const originalSpin = window.spinRoulette;
  if (typeof originalSpin === 'function') {
    window.spinRoulette = function () {
      const screen = document.getElementById('roulette-screen');
      if (screen) {
        screen.classList.remove('is-revealing');
        screen.classList.add('is-spinning');
      }
      setTimeout(() => {
        if (screen) screen.classList.remove('is-spinning');
      }, 3100);
      return originalSpin.apply(this, arguments);
    };
  }

  const originalRouletteResult = window.showRouletteResult;
  if (typeof originalRouletteResult === 'function') {
    window.showRouletteResult = async function (player) {
      const screen = document.getElementById('roulette-screen');
      if (screen) {
        screen.classList.remove('is-spinning');
        screen.classList.add('is-revealing');
      }

      const kicker = document.querySelector('#selected-player-banner > p:first-child');
      if (kicker) {
        kicker.classList.add('rfx-winner-kicker');
        kicker.textContent = '🏆 ¡EL DESTINO HABLÓ!';
      }

      if (!isPerformance()) {
        try {
          RitmikaStyleFX.confettiBurst(window.innerWidth * 0.5, window.innerHeight * 0.46, { count: 60 });
        } catch (e) {}
        try { UISounds.chime(); } catch (e) {}
      }

      const result = await originalRouletteResult.apply(this, arguments);

      setTimeout(() => {
        if (screen && !document.getElementById('roulette-screen').classList.contains('active')) {
          screen.classList.remove('is-revealing');
        }
      }, 9000);
      return result;
    };
  }

  const originalChallenge = window.fireChallenge;
  if (typeof originalChallenge === 'function') {
    window.fireChallenge = function () {
      const result = originalChallenge.apply(this, arguments);
      enhanceChallenge();
      return result;
    };
  }

  // fireTomatazo is defined in lobby.js; keep socket.js dispatch working.
  window.fireTomatazo = premiumTomatazo;

  document.addEventListener('DOMContentLoaded', function () {
    injectRouletteStage();
    decorateWheel();
    decorateChips();
    observeChips();
    buildChallengeCard();
  });
})();
