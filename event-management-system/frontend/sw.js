const CACHE_NAME = 'eventhub-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/events.html',
  '/event-details.html',
  '/css/style.css',
  '/js/api.js',
  '/js/nav.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.error('[sw] Caching the app shell failed.', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).catch((err) => console.warn('[sw] Could not clear old caches.', err))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, copy))
          .catch((err) => console.warn('[sw] Could not cache', request.url, err));
        return response;
      })
      .catch(async (err) => {
        console.warn('[sw] Serving', request.url, 'from cache after a network failure.', err);
        const cached = await caches.match(request) || await caches.match('/index.html');
        // respondWith rejects on undefined, which would surface as an opaque
        // network error instead of an explainable offline response.
        return cached || new Response('You appear to be offline.', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } });
      })
  );
});