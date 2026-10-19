// ═══════════════════════════════════════════════════════════
//  RÍTMIKA · PERFILES DE RENDIMIENTO
//  auto · performance · quality
//  Se aplica antes del primer paint para evitar el flash de animaciones.
// ═══════════════════════════════════════════════════════════

(function () {
  const STORAGE_KEY = 'ritmika_perf_mode';
  const VALID = ['auto', 'performance', 'quality'];
  const html = document.documentElement;

  function isNative() {
    return !!(window.RITMIKA_TV_NATIVE || window.RITMIKA_LITE);
  }

  function autoResolve() {
    // El APK de Android TV usa un WebView a 1080p sobre GPUs modestas.
    // En nativo, el modo automático prioriza fluidez; el usuario puede
    // escoger Calidad desde Ajustes.
    if (isNative()) return 'performance';
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    return (mem <= 4 || cores <= 4) ? 'performance' : 'quality';
  }

  function readMode() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && VALID.includes(saved)) return saved;
    } catch (_) {}
    return 'auto';
  }

  let rawMode = readMode();
  let resolvedMode = 'quality';

  function apply() {
    resolvedMode = rawMode === 'auto' ? autoResolve() : rawMode;
    html.classList.toggle('ritmika-perf', resolvedMode === 'performance');
    html.classList.toggle('ritmika-quality', resolvedMode === 'quality');
    html.classList.toggle('ritmika-balanced', resolvedMode !== 'quality' && resolvedMode !== 'performance');

    // `?native=1` agrega `ritmika-tv-lite` desde el bootstrap. Calidad debe
    // recuperar los efectos visuales; rendimiento los mantiene apagados.
    if (isNative()) {
      if (rawMode === 'quality') html.classList.remove('ritmika-tv-lite');
      else html.classList.add('ritmika-tv-lite');
    }

    window.RITMIKA_PERF_MODE = resolvedMode;
    window.RITMIKA_PERF_RAW = rawMode;
  }

  function setMode(mode) {
    rawMode = VALID.includes(mode) ? mode : 'auto';
    try { localStorage.setItem(STORAGE_KEY, rawMode); } catch (_) {}
    apply();
    try {
      window.dispatchEvent(new CustomEvent('ritmika:perf', {
        detail: { mode: rawMode, resolved: resolvedMode },
      }));
    } catch (_) {}
    console.log('[Perf] modo=' + rawMode + ' resuelto=' + resolvedMode);
    return resolvedMode;
  }

  function cycle() {
    const order = ['auto', 'performance', 'quality'];
    const idx = order.indexOf(rawMode);
    return setMode(order[(idx + 1) % order.length]);
  }

  function label(mode) {
    if (mode === 'performance') return 'RENDIMIENTO';
    if (mode === 'quality') return 'CALIDAD';
    return 'AUTOMÁTICO';
  }

  window.RitmikaPerf = {
    getMode: () => rawMode,
    getResolved: () => resolvedMode,
    setMode,
    cycle,
    label,
    apply,
  };
  window.__ritmikaSetPerfMode = setMode;

  apply();
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  window.addEventListener('load', apply, { once: true });
  setTimeout(apply, 500);
  setTimeout(apply, 1500);
})();
