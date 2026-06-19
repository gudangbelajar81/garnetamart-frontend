const CACHE_NAME = 'garnetamart-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Memaksa SW baru untuk langsung aktif
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
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
  // Strategi Network-First: Ambil dari internet dulu, kalau gagal baru ambil dari cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Jika sukses ambil dari jaringan, simpan/update ke cache
        if(response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Jika offline, fallback ke cache
        return caches.match(event.request);
      })
  );
});
