/* amnesfubbia — Service Worker
   Fungsi: PWA installable + fallback offline untuk halaman aplikasi.
   PENTING: permintaan ke luar (TMDb, gambar, itunes, embed) TIDAK dicegat —
   biar tidak membebani performa HP. */
const CACHE_NAME = 'amnesfubbia-v3';
const SHELL = ['./', './index.html', './index.html.txt', './amnesfubbia.png'];

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

  // Permintaan luar (API, gambar, embed): biarkan browser menanganinya langsung
  if (url.origin !== self.location.origin) return;

  // Hanya halaman/aset lokal: network-first dengan fallback cache
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
