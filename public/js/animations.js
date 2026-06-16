// ─── UI SOUND EFFECTS ────────────────────────────────
const UISounds = (() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new AudioCtx();
    return ctx;
  }

  function playTone(freq, duration, type = 'sine', volume = 0.15) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      gain.gain.setValueAtTime(volume, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration);
    } catch (e) {}
  }

  function playToneSweep(startFreq, endFreq, duration, volume = 0.12) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + duration);
      gain.gain.setValueAtTime(volume, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration);
    } catch (e) {}
  }

  // Polyphonic chime (multiple tones)
  function playChime() {
    playTone(523, 0.15, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 80);
    setTimeout(() => playTone(784, 0.2, 'sine', 0.12), 160);
  }

  function playTick() {
    playTone(880, 0.05, 'square', 0.08);
  }

  function playClick() {
    playTone(440, 0.04, 'square', 0.06);
  }

  function playReveal() {
    playToneSweep(300, 1200, 0.3, 0.1);
    setTimeout(() => playTone(1200, 0.2, 'sine', 0.08), 300);
  }

  function playStinger() {
    playToneSweep(200, 800, 0.15, 0.12);
    setTimeout(() => playToneSweep(300, 1000, 0.2, 0.1), 150);
  }

  function playWhoosh() {
    const c = getCtx();
    const bufferSize = c.sampleRate * 0.3;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.08, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    source.connect(gain);
    gain.connect(c.destination);
    source.start(c.currentTime);
  }

  return {
    click:     playClick,
    tick:      playTick,
    chime:     playChime,
    whoosh:    playWhoosh,
    reveal:    playReveal,
    stinger:   playStinger,
    playTone,
    playChime,
  };
})();

const RitmikaStyleFX = (() => {
  let confettiCanvas = null, confettiCtx = null, confettiPieces = [], confettiFrame = null;

  function initConfettiCanvas() {
    if (confettiCanvas) return;
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'ritmika-confetti';
    confettiCanvas.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:9999;';
    document.body.appendChild(confettiCanvas);
    confettiCtx = confettiCanvas.getContext('2d');
    resizeConfetti();
    window.addEventListener('resize', resizeConfetti);
  }

  function resizeConfetti() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }

  return {
    // ── Jackbox Pop-Art Animations ──
    popOutOnHover: (el) => {
      if(typeof anime !== 'undefined') {
        anime({
          targets: el,
          scale: 1.15,
          duration: 400,
          easing: 'easeOutElastic(1, .5)'
        });
      } else {
        el.style.transform = 'scale(1.15)';
      }
    },
    popInOnLeave: (el) => {
      if(typeof anime !== 'undefined') {
        anime({
          targets: el,
          scale: 1,
          duration: 300,
          easing: 'easeOutQuad'
        });
      } else {
        el.style.transform = 'scale(1)';
      }
    },
    punchOnPress: (el) => {
      if(typeof anime !== 'undefined') {
        anime({
          targets: el,
          translateX: [0, 8, 0],
          translateY: [0, 8, 0],
          duration: 300,
          easing: 'easeOutBack'
        });
      }
    },
    
    popIn(selector, opts = {}) {
      anime({
        targets: selector,
        scale: [0, opts.scale ?? 1.08, 1],
        opacity: [0, 1],
        duration: opts.duration ?? 700,
        delay: opts.delay ?? 0,
        easing: 'easeOutElastic(1, .5)',
      });
    },

    dropIn(selector, opts = {}) {
      const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (el) el.style.opacity = '0';
      anime({
        targets: selector,
        translateY: [-120, 0],
        opacity: [0, 1],
        duration: 800,
        delay: opts.delay ?? 0,
        easing: 'easeOutElastic(1, .6)',
      });
    },

    slideUp(selector, opts = {}) {
      anime({
        targets: selector,
        translateY: [60, 0],
        opacity: [0, 1],
        duration: 600,
        delay: opts.delay ?? 0,
        easing: 'easeOutBack',
      });
    },

    counter(el, start, end, opts = {}) {
      anime({
        targets: { val: start },
        val: [start, end],
        duration: opts.duration ?? 800,
        delay: opts.delay ?? 0,
        easing: 'easeOutCubic',
        round: 1,
        update: (a) => {
          el.textContent = (opts.prefix ?? '') + Math.round(a.animations[0].currentValue) + (opts.suffix ?? '');
        },
      });
    },

    confettiBurst(x, y, opts = {}) {
      const count = opts.count ?? 40;
      const colors = opts.colors ?? ['#ec4899','#22d3ee','#facc15','#a855f7','#f97316','#22c55e','#ef4444','#3b82f6'];
      initConfettiCanvas();
      const cx = x ?? window.innerWidth / 2;
      const cy = y ?? window.innerHeight / 2;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 8;
        confettiPieces.push({
          x: cx, y: cy, w: 6 + Math.random() * 8, h: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: Math.random() * Math.PI * 2,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
          vrot: (Math.random() - 0.5) * 0.2, gravity: 0.12,
          life: 0, maxLife: 60 + Math.random() * 40, opacity: 1,
        });
      }
      if (confettiFrame) return;
      const draw = () => {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        let alive = false;
        confettiPieces = confettiPieces.filter(p => {
          p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.rot += p.vrot; p.life++;
          p.opacity = Math.max(0, 1 - p.life / p.maxLife);
          if (p.life < p.maxLife && p.y < confettiCanvas.height + 20) {
            alive = true;
            confettiCtx.save();
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate(p.rot);
            confettiCtx.globalAlpha = p.opacity;
            confettiCtx.fillStyle = p.color;
            confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            confettiCtx.restore();
          }
          return p.life < p.maxLife && p.y < confettiCanvas.height + 20;
        });
        if (alive) confettiFrame = requestAnimationFrame(draw);
        else confettiFrame = null;
      };
      confettiFrame = requestAnimationFrame(draw);
    },

    flashBang(color = '#ffffff', duration = 250) {
      const flash = document.createElement('div');
      flash.style.cssText = `position:fixed; inset:0; background:${color}; opacity:0; pointer-events:none; z-index:9998;`;
      document.body.appendChild(flash);
      anime({
        targets: flash, opacity: [0, 1, 0], duration, easing: 'easeOutQuad',
        complete: () => flash.remove(),
      });
    },

    screenShake(intensity = 8, duration = 400) {
      const target = '.tv-screen.active, .screen.active';
      anime({
        targets: target,
        translateX: [0, -intensity, intensity, -intensity * 0.7, intensity * 0.7, -intensity * 0.4, intensity * 0.4, 0],
        duration, easing: 'easeInOutSine',
        complete: () => { document.querySelectorAll(target).forEach(el => el.style.transform = ''); },
      });
    },

    staggerGroup(selector, staggerMs = 100, opts = {}) {
      anime({
        targets: selector,
        scale: [0, 1.06, 1],
        opacity: [0, 1],
        duration: opts.duration ?? 600,
        delay: anime.stagger(staggerMs),
        easing: 'easeOutElastic(1, .5)',
      });
    },

    glowPulse(selector, color = '#ec4899', duration = 1500) {
      anime.remove(selector);
      anime({
        targets: selector,
        boxShadow: [`0 0 20px ${color}44`, `0 0 40px ${color}88`, `0 0 20px ${color}44`],
        duration, loop: true, easing: 'easeInOutSine', direction: 'alternate',
      });
    },

    axoloNod(count = 2) {
      anime({
        targets: '#axolo-container',
        translateY: [
          { value: 0, duration: 0 },
          { value: -14, duration: 200 },
          { value: 0, duration: 200 },
        ],
        loop: count, easing: 'easeOutCubic',
      });
    },

    bigReveal(selector, opts = {}) {
      anime({
        targets: selector,
        scale: [0.3, 1.05, 1],
        opacity: [0, 1],
        rotate: opts.rotate ? [-15, 3, 0] : 0,
        duration: 900,
        delay: opts.delay ?? 0,
        easing: 'easeOutElastic(1, .4)',
      });
    },
  };
})();
