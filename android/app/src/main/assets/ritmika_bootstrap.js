/*
 * Rítmika TV — Bootstrap de arranque.
 *
 * Se registra con WebViewCompat.addDocumentStartJavaScript(...) (y si el WebView
 * es muy viejo, se inyecta en onPageFinished) y arregla la navegación con
 * control remoto en las pantallas previas al juego.
 *
 * ¿Por qué hace falta? El listener de tv.html empieza con
 * `const activeScreen = document.querySelector('.tv-screen.active'); if
 * (!activeScreen) return;`. El pre-boot, el bootloader y el botón "INICIAR EL
 * SHOW" no viven en un `.tv-screen`, así que Enter se ignoraba y el usuario
 * quedaba atrapado sin poder continuar.
 *
 * El CSS del modo ligero vive en tv.html (bloque `#tv-lite-css`), activado por
 * `?native=1`. Aquí solo se deja la marca por si el HTML viene de un servidor
 * viejo que aún no incluye el query param.
 */
(function () {
  if (window.__ritmikaBootstrap) return;
  window.__ritmikaBootstrap = true;

  window.RITMIKA_TV_NATIVE = true;
  window.RITMIKA_LITE = true;

  function markLite() {
    try {
      var html = document.documentElement;
      if (html) html.classList.add('ritmika-tv-lite');
    } catch (e) {}
  }
  markLite();
  document.addEventListener('DOMContentLoaded', markLite, { once: true });

  /*
   * Rastrea el media que se reproduce para poder pausarlo desde Kotlin cuando
   * la app pasa a segundo plano (onStop). Sin esto, la música de menú y los
   * efectos seguían sonando fuera de la app.
   */
  function installMediaTracker() {
    try {
      var proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      if (!proto || proto.__ritmikaTracked) return;
      proto.__ritmikaTracked = true;

      var tracked = [];
      var originalPlay = proto.play;
      if (typeof originalPlay === 'function') {
        proto.play = function () {
          try {
            if (tracked.indexOf(this) === -1) tracked.push(this);
            if (tracked.length > 32) tracked.shift();
          } catch (e) {}
          return originalPlay.apply(this, arguments);
        };
      }

      window.__ritmikaPauseTrackedMedia = function () {
        for (var i = 0; i < tracked.length; i++) {
          try { tracked[i].pause(); } catch (e) {}
        }
        tracked = [];
      };
    } catch (e) {}
  }
  installMediaTracker();
  document.addEventListener('DOMContentLoaded', installMediaTracker, { once: true });

  /*
   * Diagnóstico en pantalla (esquina superior izquierda, siempre visible).
   * Sin acceso a logcat en la TV, esta etiqueta es la única forma de ver qué
   * viewport/densidad tiene realmente el WebView y si el escalado es correcto.
   */
  function installDiagnostics() {
    if (window.__ritmikaDiag || window.RITMIKA_DIAG === false) return;
    window.__ritmikaDiag = true;

    function bridgeString(method) {
      try {
        if (window.AndroidNative && typeof window.AndroidNative[method] === 'function') {
          return window.AndroidNative[method]();
        }
      } catch (e) {}
      return 'n/a';
    }

    function snapshot() {
      try {
        var probe = document.createElement('div');
        probe.setAttribute('style',
          'position:fixed;top:-20000px;left:-20000px;width:100vw;height:100vh;');
        (document.body || document.documentElement).appendChild(probe);
        var probeW = probe.offsetWidth;
        var probeH = probe.offsetHeight;
        probe.parentNode.removeChild(probe);

        var vv = window.visualViewport;
        var lines = [
          'Ritmika ' + bridgeString('appVersion'),
          'CSS ' + Math.round(window.innerWidth) + 'x' + Math.round(window.innerHeight) +
            ' dpr' + (window.devicePixelRatio || 1),
          '100vw/vh ' + probeW + 'x' + probeH,
          'docEl ' + document.documentElement.clientWidth + 'x' +
            document.documentElement.clientHeight,
          'scr ' + bridgeString('screenMetrics')
        ];
        if (vv) {
          lines.push('visual ' + Math.round(vv.width) + 'x' + Math.round(vv.height) +
            ' s' + (vv.scale || 1));
        }

        var el = document.getElementById('ritmika-diag');
        if (!el) {
          el = document.createElement('div');
          el.id = 'ritmika-diag';
          el.setAttribute('style',
            'position:fixed;top:0;left:0;z-index:2147483647;' +
            'background:rgba(0,0,0,0.86);color:#00ff88;' +
            'font:700 22px/1.35 monospace;padding:10px 14px;' +
            'pointer-events:none;white-space:pre;text-align:left;');
          (document.body || document.documentElement).appendChild(el);
        }
        el.textContent = lines.join('\n');
      } catch (e) {}
    }

    if (document.body) snapshot();
    document.addEventListener('DOMContentLoaded', snapshot, { once: true });
    window.addEventListener('load', snapshot, { once: true });
    setTimeout(snapshot, 2500);
    setTimeout(snapshot, 6000);
  }
  installDiagnostics();

  function hasActiveScreen() {
    try {
      return !!document.querySelector('.tv-screen.active');
    } catch (e) {
      return false;
    }
  }

  /*
   * Botones realmente pintados. No sirve `offsetParent` porque devuelve null
   * en elementos `position:fixed` y en varios de los paneles del juego.
   */
  function visibleButtons() {
    var all = document.querySelectorAll('button');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (!all[i].disabled && all[i].getClientRects().length > 0) out.push(all[i]);
    }
    return out;
  }

  function focusFirstButton() {
    var active = document.activeElement;
    if (active && active.tagName === 'BUTTON' && active.getClientRects().length > 0) {
      return true;
    }
    var btns = visibleButtons();
    if (!btns.length) return false;
    try { btns[0].focus(); } catch (e) {}
    return true;
  }

  /*
   * Mientras no haya una pantalla de juego activa (pre-boot, bootloader,
   * "INICIAR EL SHOW"), mantenemos el foco sobre el único botón disponible para
   * que el recuadro de foco se vea y Enter funcione.
   */
  document.addEventListener('DOMContentLoaded', function () {
    var tries = 0;
    var timer = setInterval(function () {
      if (hasActiveScreen() || ++tries > 240) {
        clearInterval(timer);
        return;
      }
      focusFirstButton();
    }, 250);
  }, { once: true });

  /*
   * Enter / Espacio en las pantallas previas al juego. Si ya hay una pantalla
   * de juego activa, tv.html se encarga y no intervenimos.
   */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    if (hasActiveScreen()) return;

    var active = document.activeElement;
    var isButton = active && active !== document.body &&
      (active.tagName === 'BUTTON' || active.getAttribute('role') === 'button');

    if (isButton) {
      e.preventDefault();
      e.stopPropagation();
      try { active.click(); } catch (err) {}
      return;
    }

    var btn = visibleButtons()[0];
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      try { btn.focus(); btn.click(); } catch (err) {}
    }
  }, true);

  console.log('[RitmikaTV] bootstrap listo');
})();
