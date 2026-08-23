const CACHE_VERSION = 'v2';
const CACHE_NAME = `tt-cache-${CACHE_VERSION}`;
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/app-client.js',
  '/teacher.jpg',
];

// --- INSTALL ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll o'rniga har birini alohida cache qilamiz —
      // shunda 1 ta fayl topilmasa ham, qolganlari saqlanib qoladi
      await Promise.allSettled(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] cache qilinmadi:', url, err);
          })
        )
      );
      self.skipWaiting();
    })()
  );
});

// --- ACTIVATE ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      // faqat "tt-cache-" prefiksli eski cache'larni o'chiramiz,
      // boshqa (masalan boshqa SW ishlatadigan) cache'larga tegmaymiz
      await Promise.all(
        keys
          .filter((k) => k.startsWith('tt-cache-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
    })()
  );
});

// --- FETCH ---
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // faqat GET, faqat http(s), faqat o'z domenimiz
  if (req.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  // video/audio uchun Range so'rovlarni cache qilib bo'lmaydi — o'tkazib yuboramiz
  if (req.headers.has('range')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      // fon rejimida yangilanish (stale-while-revalidate)
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null); // internet yo'q bo'lsa, keyinroq fallback ishlatamiz

      if (cached) {
        // eskisini darrov qaytaramiz, fon'da yangilaymiz
        event.waitUntil(fetchPromise);
        return cached;
      }

      // navigatsiya so'rovi (sahifa ochish) — internet yo'q bo'lsa index.html
      if (req.mode === 'navigate') {
        const net = await fetchPromise;
        if (net) return net;
        const fallback = await cache.match('/index.html');
        if (fallback) return fallback;
        return new Response('Offline: sahifa mavjud emas', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      // boshqa (cache'da yo'q) resurslar
      const net = await fetchPromise;
      if (net) return net;
      return new Response('Offline', { status: 503 });
    })()
  );
});