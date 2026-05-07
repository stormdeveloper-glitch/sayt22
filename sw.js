const CACHE_NAME = 'tt-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/app-client.js',
  '/teacher.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => { });
        }
        return res;
      }).catch(() => cached);

      if (cached) return cached;

      // Navigatsiya bo'lsa, hech bo'lmaganda index.html qaytarsin
      if (req.mode === 'navigate') {
        return caches.match('/index.html').then((r) => r || fetchPromise);
      }
      return fetchPromise;
    })
  );
});
