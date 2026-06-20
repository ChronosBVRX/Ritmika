const CACHE_NAME = 'ritmika-cache-v1';
const ASSETS = [
  '/join',
  '/libs/tailwind.css',
  '/libs/anime.min.js',
  '/js/animations.js',
  '/socket.io/socket.io.js',
  '/assets/favicon.png',
  '/assets/favicon-64.png',
  '/assets/logo_ritmika.webp',
  '/assets/lobby_bg_premium.webp',
  '/assets/avatars/avatar_0_taco_rockero.webp',
  '/assets/avatars/avatar_1_chile_enmascarado.webp',
  '/assets/avatars/avatar_2_tequila_fiestero.webp',
  '/assets/avatars/avatar_3_estrella_rock.webp',
  '/assets/avatars/avatar_4_loro_cumbiambero.webp',
  '/assets/avatars/avatar_5_guitarra_magica.webp',
  '/assets/avatars/avatar_6_rey_palenque.webp',
  '/assets/avatars/avatar_7_pulpo_salsero.webp'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  // Ignore dynamic endpoints and WebSocket polls to avoid breaking real-time connection
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
