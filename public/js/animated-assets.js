/**
 * RítmikaAnimated — carga assets animados opcionales con fallback estático.
 *
 * Reglas:
 *  - Una animación NUNCA puede romper una partida: si el manifest no está, el
 *    codec falla o el dispositivo no reproduce, se mantiene el asset estático.
 *  - Respeta `prefers-reduced-motion`: no monta vídeos.
 *  - Expone lifecycle (releaseWithin/releaseAll) para no dejar <video> huérfanos.
 */
(function () {
  'use strict';

  var MANIFEST_URL = '/assets/animated/manifest.json';
  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { reduced = false; }

  var manifest = null;
  var readyResolve;
  var ready = new Promise(function (resolve) { readyResolve = resolve; });

  function load() {
    if (reduced) { manifest = {}; readyResolve(manifest); return; }
    if (typeof fetch !== 'function') { manifest = {}; readyResolve(manifest); return; }
    fetch(MANIFEST_URL, { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) { manifest = data || {}; })
      .catch(function () { manifest = {}; })
      .then(function () { readyResolve(manifest); });
  }

  function get(key) {
    return manifest && manifest[key] ? manifest[key] : null;
  }

  function isAvailable(key) {
    return !reduced && !!get(key);
  }

  /**
   * Monta un <video> dentro de `container`. Devuelve el elemento o null.
   * opts: { className, style, onFallback, onReady, preload }
   */
  function mount(container, key, opts) {
    opts = opts || {};
    if (!container || reduced) return null;
    var entry = get(key);
    if (!entry || !entry.src) return null;
    if (container.querySelector('video[data-animated-key="' + key + '"]')) return null;

    var video = document.createElement('video');
    video.dataset.animatedKey = key;
    video.muted = entry.muted !== false;
    video.loop = entry.loop !== false;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = opts.preload || 'metadata';
    video.setAttribute('aria-hidden', 'true');
    video.disablePictureInPicture = true;

    if (opts.className) video.className = opts.className;
    if (opts.style) {
      for (var prop in opts.style) {
        if (Object.prototype.hasOwnProperty.call(opts.style, prop)) video.style[prop] = opts.style[prop];
      }
    }

    var failed = false;
    function fail() {
      if (failed) return;
      failed = true;
      try { video.pause(); } catch (e) {}
      try { video.removeAttribute('src'); video.load(); } catch (e) {}
      if (video.parentNode) video.parentNode.removeChild(video);
      if (typeof opts.onFallback === 'function') opts.onFallback();
    }

    video.addEventListener('error', fail);
    video.addEventListener('stalled', function () { /* no-op: el navegador reintenta */ });
    video.addEventListener('canplay', function () {
      if (typeof opts.onReady === 'function') opts.onReady(video);
    });

    // Nota WebView2: asignar src y llamar play() en el siguiente frame evita
    // pantallas negras por el compositor de Chromium.
    video.src = entry.src;
    container.appendChild(video);

    var playPromise = null;
    try { playPromise = video.play(); } catch (e) { playPromise = null; }
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () { /* autoplay bloqueado: se queda el fallback estático */ });
    }
    return video;
  }

  function releaseVideo(video) {
    if (!video) return;
    try { video.pause(); } catch (e) {}
    try { video.removeAttribute('src'); video.load(); } catch (e) {}
    if (video.parentNode) video.parentNode.removeChild(video);
  }

  function releaseWithin(root) {
    if (!root || !root.querySelectorAll) return;
    var videos = root.querySelectorAll('video[data-animated-key]');
    for (var i = 0; i < videos.length; i++) releaseVideo(videos[i]);
  }

  function releaseAll() {
    releaseWithin(document);
  }

  window.RitmikaAnimated = {
    ready: ready,
    load: load,
    get: get,
    isAvailable: isAvailable,
    mount: mount,
    releaseWithin: releaseWithin,
    releaseAll: releaseAll,
    reduced: function () { return reduced; }
  };

  load();
})();
