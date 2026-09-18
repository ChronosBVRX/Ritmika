// Rítmika — Configuración centralizada para TV
// No hardcodear URLs en múltiples archivos. Toda la config viene de /api/config (local) con fallback.
(function() {
  const fallback = {
    LOCAL_BASE_URL: window.location.origin,
    RELAY_URL: '',
    CONNECTION_MODE: 'lan', // 'online' | 'lan'
  };

  // Permitir override via meta o query ?relay= (para testing)
  try {
    const params = new URLSearchParams(window.location.search);
    const relayParam = params.get('relay');
    if (relayParam) fallback.RELAY_URL = relayParam;
    const modeParam = params.get('mode');
    if (modeParam === 'online' || modeParam === 'lan') fallback.CONNECTION_MODE = modeParam;
  } catch {}

  window.RITMIKA_CONFIG = { ...fallback };
  window.ritmikaConfigReady = fetch('/api/config', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(cfg => {
      if (cfg) {
        if (cfg.relayUrl !== undefined) window.RITMIKA_CONFIG.RELAY_URL = cfg.relayUrl || '';
        if (cfg.connectionMode) window.RITMIKA_CONFIG.CONNECTION_MODE = cfg.connectionMode;
        if (cfg.localBaseUrl) window.RITMIKA_CONFIG.LOCAL_BASE_URL = cfg.localBaseUrl;
        if (cfg.relayUrl && !cfg.connectionMode) window.RITMIKA_CONFIG.CONNECTION_MODE = 'online';
      }
      // Si hay RELAY_URL pero connectionMode sigue lan, respetar env
      if (window.RITMIKA_CONFIG.RELAY_URL && window.RITMIKA_CONFIG.CONNECTION_MODE === 'lan') {
        // si el servidor dijo online, ya se seteo; si no, inferir online
        if (!cfg || !cfg.connectionMode) window.RITMIKA_CONFIG.CONNECTION_MODE = 'online';
      }
      console.log('[CONFIG] RITMIKA_CONFIG', window.RITMIKA_CONFIG);
      return window.RITMIKA_CONFIG;
    })
    .catch(() => {
      console.warn('[CONFIG] /api/config falló, usando fallback', window.RITMIKA_CONFIG);
      return window.RITMIKA_CONFIG;
    });
})();
