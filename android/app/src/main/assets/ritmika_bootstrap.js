/*
 * Rítmika TV — Bootstrap de arranque (document start).
 *
 * Se registra con WebViewCompat.addDocumentStartJavaScript(...) para ejecutarse
 * ANTES que los scripts de tv.html. Resuelve dos problemas del host Android TV:
 *
 *   1. MODO LIGERO. Las animaciones de fondo a pantalla completa
 *      (background-position en .party-bg, rotación de .party-bg::before,
 *      el canvas de partículas y los filtros blur/backdrop-filter) saturan la
 *      GPU de los televisores. Aquí se desactivan.
 *
 *   2. CONTROL REMOTO. En las pantallas previas al juego (pre-boot y
 *      bootloader) NO existe `.tv-screen.active`, por lo que el listener de
 *      tv.html ignora Enter y el usuario queda atrapado en "Entrar a Rítmika".
 *      Aquí Enter/Espacio dispara click sobre el elemento enfocado.
 *
 * Expone window.RITMIKA_LITE = true para que bootloader.js omita su canvas.
 */
(function () {
  if (window.__ritmikaBootstrap) return;
  window.__ritmikaBootstrap = true;

  window.RITMIKA_TV_NATIVE = true;
  window.RITMIKA_LITE = true;

  var LITE_CSS = [
    /* ── Fondos animados a pantalla completa (repintado cada frame) ── */
    'html.ritmika-tv-lite .party-bg{animation:none !important}',
    'html.ritmika-tv-lite .party-bg::before{animation:none !important}',
    'html.ritmika-tv-lite .scanlines::after{display:none !important}',
    'html.ritmika-tv-lite #particles-canvas{display:none !important}',
    'html.ritmika-tv-lite .glitter-particle{display:none !important}',

    /* ── Canvas decorativos ── */
    'html.ritmika-tv-lite #boot-canvas-bg{display:none !important}',
    'html.ritmika-tv-lite #bootloader-screen{background:radial-gradient(circle at 50% 45%, #1b2440 0%, #0a0a14 72%) !important}',
    'html.ritmika-tv-lite .boot-checklist{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;background:rgba(15,23,42,0.92) !important;box-shadow:none !important}',

    /* ── Filtros caros (fuerzan pases offscreen a resolución completa) ── */
    'html.ritmika-tv-lite .floating-shape{filter:none !important;animation:none !important;opacity:1 !important;background:radial-gradient(circle, rgba(0,229,255,0.16) 0%, rgba(0,229,255,0) 70%) !important}',
    'html.ritmika-tv-lite #pre-boot-screen img{filter:none !important}',
    'html.ritmika-tv-lite #pre-boot-screen>div:first-child{animation:none !important}',

    /* ── Cut-in de Tío Axolo: sin blur en las franjas ── */
    'html.ritmika-tv-lite #axolo-cutin-bar,html.ritmika-tv-lite #axolo-cutin-portrait,html.ritmika-tv-lite #axolo-cutin-textbox{filter:none !important}',

    /* ── Indicador de foco visible con control remoto ── */
    '#enter-ritmika-btn:focus,#boot-retry:focus,.boot-retry-btn:focus{outline:6px solid #00e5ff;outline-offset:8px}'
  ].join('\n');

  function ensureLite() {
    try {
      var html = document.documentElement;
      if (!html) return false;
      html.classList.add('ritmika-tv-lite');
      if (!document.getElementById('ritmika-lite-css')) {
        var style = document.createElement('style');
        style.id = 'ritmika-lite-css';
        style.textContent = LITE_CSS;
        (document.head || html).appendChild(style);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  if (!ensureLite()) {
    try {
      var observer = new MutationObserver(function () {
        if (ensureLite()) observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    } catch (e) {}
    document.addEventListener('DOMContentLoaded', ensureLite, { once: true });
  }

  /* Enfoca "¡Entrar a Rítmika!" para que se vea el recuadro de foco. */
  function focusPreBoot() {
    try {
      var btn = document.getElementById('enter-ritmika-btn');
      if (!btn || btn.offsetParent === null) return false;
      btn.focus();
      return true;
    } catch (e) {
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!focusPreBoot()) {
      var tries = 0;
      var timer = setInterval(function () {
        if (focusPreBoot() || ++tries > 40) clearInterval(timer);
      }, 250);
    }
  }, { once: true });

  /*
   * Enter / Espacio en las pantallas previas al juego.
   * Si ya hay un `.tv-screen.active`, tv.html se encarga (no intervenimos).
   */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;

    try {
      if (document.querySelector('.tv-screen.active')) return;
    } catch (err) {
      return;
    }

    var active = document.activeElement;
    var isButton = active && active !== document.body &&
      (active.tagName === 'BUTTON' || active.getAttribute('role') === 'button');

    if (isButton) {
      e.preventDefault();
      e.stopPropagation();
      try { active.click(); } catch (err) {}
      return;
    }

    var targets = ['enter-ritmika-btn', 'boot-retry'];
    for (var i = 0; i < targets.length; i++) {
      var btn = document.getElementById(targets[i]);
      if (btn && btn.offsetParent !== null) {
        e.preventDefault();
        e.stopPropagation();
        try { btn.focus(); btn.click(); } catch (err) {}
        return;
      }
    }
  }, true);

  console.log('[RitmikaTV] bootstrap lite mode ready');
})();
