// ═══════════════════════════════════════════════════════════
//  RÍTMIKA · ARRANQUE DE LA VERSIÓN WEB EN ANDROID TV
//  La app nativa carga /tv?native=1 y usa exactamente el mismo
//  menú/lobby HTML que la versión PC. Evita el preboot y deja
//  el menú listo sin una capa de UI nativa duplicada.
// ═══════════════════════════════════════════════════════════

(function () {
  if (!/[?&]native=1/.test(location.search)) return;

  function enter() {
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
      console.log('[NativeWeb] menú web listo');
    } catch (e) {
      console.warn('[NativeWeb] no se pudo entrar al menú', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enter, { once: true });
  } else {
    enter();
  }
})();
