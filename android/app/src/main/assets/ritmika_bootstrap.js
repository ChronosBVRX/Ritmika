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
   * Fija el viewport en 1920 px CSS.
   *
   * El WebView ignora la densidad del contexto y usa la del display (Chromecast
   * HD: 320 dpi → dpr 2), así que su viewport natural es 960x540 CSS y el diseño
   * de 1920 se ve al doble y recortado. Con <meta viewport width=1920> el
   * viewport de maquetación pasa a ser 1920x1080 CSS y Chrome escala la página
   * a la pantalla (page scale), sin tocar el árbol de vistas de Android.
   *
   * Se aplica lo antes posible y se re-aplica por si el <head> se parsea
   * después del document-start.
   */
  function forceViewportWidth() {
    try {
      var head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;

      var metas = head.querySelectorAll('meta[name="viewport"]');
      var keep = metas.length ? metas[0] : document.createElement('meta');
      if (!metas.length) {
        keep.setAttribute('name', 'viewport');
        head.insertBefore(keep, head.firstChild);
      }
      keep.setAttribute('content', 'width=1920, user-scalable=no');
      for (var i = 1; i < metas.length; i++) {
        if (metas[i].parentNode) metas[i].parentNode.removeChild(metas[i]);
      }
    } catch (e) {}
  }

  forceViewportWidth();
  document.addEventListener('DOMContentLoaded', forceViewportWidth, { once: true });
  window.addEventListener('load', forceViewportWidth, { once: true });
  setTimeout(forceViewportWidth, 0);
  setTimeout(forceViewportWidth, 400);
  setTimeout(forceViewportWidth, 1200);

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
