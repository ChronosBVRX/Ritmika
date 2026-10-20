const CACHE_NAME = 'ritmika-cache-v5';
const ASSETS = [
  '/libs/tailwind.css',
  '/libs/anime.min.js',
  '/js/animations.js',
  '/socket.io/socket.io.js',
  '/assets/favicon.png',
  '/assets/favicon-64.png',
  '/assets/logo_ritmika.webp',
  '/assets/lobby_bg_premium.webp',
  '/assets/avatars/avatar_0_taco_rockero.webp?v=4',
  '/assets/avatars/avatar_1_chile_enmascarado.webp?v=4',
  '/assets/avatars/avatar_2_tequila_fiestero.webp?v=4',
  '/assets/avatars/avatar_3_estrella_rock.webp?v=4',
  '/assets/avatars/avatar_4_loro_cumbiambero.webp?v=4',
  '/assets/avatars/avatar_5_guitarra_magica.webp?v=4',
  '/assets/avatars/avatar_6_rey_palenque.webp?v=4',
  '/assets/avatars/avatar_7_pulpo_salsero.webp?v=4'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  const isNavigation = e.request.mode === 'navigate'
    || url.pathname === '/join'
    || url.pathname === '/';

  if (isNavigation) {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(e.request).then((cached) => cached || caches.match('/join'));
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const networkRequest = fetch(e.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || networkRequest;
    })
  );
});
