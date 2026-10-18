/*
 * Rítmika TV — Bootstrap de arranque.
 *
 * Se registra con WebViewCompat.addDocumentStartJavaScript(...) (y si el WebView
 * es muy viejo, se inyecta en onPageFinished) y arregla la navegación con
 * control remoto en las pantallas previas al juego.
 *
 * ¿Por qué hace falta? El listener de tv.html empieza con
 * `const activeScreen = document.querySelector('.tv-screen.active'); if
 * (!activeScreen) return;`. El pre-boot y el bootloader no son `.tv-screen`,
 * así que Enter se ignoraba y el usuario quedaba atrapado en
 * "¡Entrar a Rítmika!" sin poder continuar.
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
    if (focusPreBoot()) return;
    var tries = 0;
    var timer = setInterval(function () {
      if (focusPreBoot() || ++tries > 40) clearInterval(timer);
    }, 250);
  }, { once: true });

  /*
   * Enter / Espacio en las pantallas previas al juego. Si ya hay una pantalla
   * de juego activa, tv.html se encarga y no intervenimos.
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

  console.log('[RitmikaTV] bootstrap listo');
})();
