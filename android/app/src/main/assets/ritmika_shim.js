/*
 * Rítmika TV — Native media shim.
 * Se inyecta en tv.html (vía onPageFinished). Emula la API de HTMLMediaElement
 * que usa el juego, redirigiendo el video a ExoPlayer nativo (AndroidNative).
 *
 * El juego NO usa currentTime/timeupdate: su timer es propio (setInterval).
 * Solo necesita: src, play(), pause(), muted, duration, videoWidth/Height y
 * los callbacks onplaying / onerror / onended.
 */
(function () {
  if (window.__ritmikaShimInstalled) return;
  if (!window.AndroidNative) return;
  window.__ritmikaShimInstalled = true;

  var proto = HTMLMediaElement.prototype;
  var vproto = HTMLVideoElement.prototype;

  var srcDesc = Object.getOwnPropertyDescriptor(proto, 'src');
  var durDesc = Object.getOwnPropertyDescriptor(proto, 'duration');
  var mutedDesc = Object.getOwnPropertyDescriptor(proto, 'muted');
  var vwDesc = Object.getOwnPropertyDescriptor(vproto, 'videoWidth');
  var vhDesc = Object.getOwnPropertyDescriptor(vproto, 'videoHeight');
  var realPlay = proto.play;
  var realPause = proto.pause;

  function isKaraoke(el) { return !!el && el.id === 'karaoke-video'; }

  function st(el) {
    if (!el.__ritmikaTV) {
      el.__ritmikaTV = { duration: 0, videoWidth: 0, videoHeight: 0, src: '', muted: false };
    }
    return el.__ritmikaTV;
  }

  function nativeOn() { document.documentElement.classList.add('ritmika-native-video'); }
  function nativeOff() { document.documentElement.classList.remove('ritmika-native-video'); }

  function ensureStyle() {
    if (document.getElementById('ritmika-native-css')) return;
    var style = document.createElement('style');
    style.id = 'ritmika-native-css';
    style.textContent = [
      'html.ritmika-native-video, html.ritmika-native-video body { background: transparent !important; }',
      'html.ritmika-native-video .party-bg { background-color: transparent !important; background-image: none !important; }',
      'html.ritmika-native-video .party-bg::before { display: none !important; }',
      'html.ritmika-native-video #particles-canvas { display: none !important; }',
      'html.ritmika-native-video #karaoke-screen { background: transparent !important; }',
      'html.ritmika-native-video #karaoke-video-wrap { background: transparent !important; }',
      'html.ritmika-native-video #karaoke-video { visibility: hidden !important; background: transparent !important; }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  Object.defineProperty(proto, 'src', {
    configurable: true,
    get: function () { return srcDesc.get.call(this); },
    set: function (value) {
      if (isKaraoke(this)) {
        st(this).src = value;
        ensureStyle();
        try { window.AndroidNative.setSource(String(value)); } catch (e) {}
        return;
      }
      return srcDesc.set.call(this, value);
    }
  });

  Object.defineProperty(proto, 'duration', {
    configurable: true,
    get: function () {
      if (isKaraoke(this)) {
        var d = st(this).duration;
        return (typeof d === 'number' && d > 0) ? d : NaN;
      }
      return durDesc.get.call(this);
    }
  });

  Object.defineProperty(proto, 'muted', {
    configurable: true,
    get: function () { return isKaraoke(this) ? st(this).muted : mutedDesc.get.call(this); },
    set: function (value) {
      if (isKaraoke(this)) {
        st(this).muted = !!value;
        try { window.AndroidNative.setMuted(!!value); } catch (e) {}
        return;
      }
      return mutedDesc.set.call(this, value);
    }
  });

  Object.defineProperty(vproto, 'videoWidth', {
    configurable: true,
    get: function () { return isKaraoke(this) ? st(this).videoWidth : vwDesc.get.call(this); }
  });

  Object.defineProperty(vproto, 'videoHeight', {
    configurable: true,
    get: function () { return isKaraoke(this) ? st(this).videoHeight : vhDesc.get.call(this); }
  });

  proto.play = function () {
    if (isKaraoke(this)) {
      ensureStyle();
      nativeOn();
      try { window.AndroidNative.play(); } catch (e) {}
      return Promise.resolve();
    }
    return realPlay.apply(this, arguments);
  };

  proto.pause = function () {
    if (isKaraoke(this)) {
      try { window.AndroidNative.pause(); } catch (e) {}
      nativeOff();
      return;
    }
    return realPause.apply(this, arguments);
  };

  var removeAttr = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function (name) {
    if (isKaraoke(this) && String(name).toLowerCase() === 'src') {
      try { window.AndroidNative.stop(); } catch (e) {}
      nativeOff();
    }
    return removeAttr.apply(this, arguments);
  };

  // Eventos desde Kotlin -> callbacks del elemento de video
  window.__ritmikaTVEvent = function (type, data) {
    data = data || {};
    var el = document.getElementById('karaoke-video');
    if (!el) return;

    if (type === 'ready') {
      var s = st(el);
      if (typeof data.duration === 'number' && data.duration > 0) s.duration = data.duration;
      if (typeof data.width === 'number') s.videoWidth = data.width;
      if (typeof data.height === 'number') s.videoHeight = data.height;
    }
    if (type === 'ended' || type === 'error') nativeOff();

    var handler = el['on' + type];
    if (typeof handler === 'function') {
      try { handler(data); } catch (e) {}
    }
    try { el.dispatchEvent(new Event(type)); } catch (e) {}
  };

  // D-pad: si nada está enfocado, enfoca el primer botón visible al pulsar Enter/Espacio
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') &&
        (!document.activeElement || document.activeElement === document.body)) {
      var btns = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
        return b.offsetParent !== null && !b.disabled;
      });
      if (btns[0]) btns[0].focus();
    }
  }, true);

  console.log('[RitmikaTV] native media shim installed');
})();
