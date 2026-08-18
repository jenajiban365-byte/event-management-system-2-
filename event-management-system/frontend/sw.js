const CACHE_NAME = 'eventhub-shell-v7';
const APP_SHELL = [
  '/', '/index.html', '/events.html', '/event-details.html',
  '/css/style.css?v=37', '/css/eventhub-v61.css?v=61', '/js/api.js', '/js/nav.js', '/js/eh-avatar-studio.js', '/js/eh-emoji.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never cache API responses or cross-origin images/assets. This prevents the
  // service worker cache from growing with event/club media and causing UI lag.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';
  if (isNavigation) {
    // Always prefer the newest HTML so deployed fixes are picked up immediately.
    event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html'))));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then(async (response) => {
        if (response.ok) {
          try {
            const cacheResponse = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, cacheResponse);
          } catch (cacheError) {
            // Caching must never break the live response or the page.
            console.debug('EventHub cache skipped:', cacheError);
          }
        }
        return response;
      });
      return cached || network;
    })
  );
});
