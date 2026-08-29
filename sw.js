/* amnesfubbia — Service Worker (cache shell dasar untuk akses offline & PWA installable) */
const CACHE_NAME = 'amnesfubbia-v1';
const SHELL = [
  './',
  './index.html',
  './index.html.txt',
  './amnesfubbia.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API & sumber luar (TMDb, image.tmdb.org, itunes, dll) — strategi network-first
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Halaman & aset lokal — network-first dengan fallback cache (konten selalu terbaru)
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('./')))
  );
});
