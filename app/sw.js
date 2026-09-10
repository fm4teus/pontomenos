const CACHE_NAME = 'ponto-menos-v4';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './style.css',
  './app.js',
  './api.js',
  './ponto.js',
  './config.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Requisicoes para a API passam direto: nunca sao cacheadas nem servidas do
  // cache. Servir uma resposta antiga da API mascara o servidor fora do ar.
  if (new URL(event.request.url).pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(response => {
          return response || new Response('Offline - sem cache disponível', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

