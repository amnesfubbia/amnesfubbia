/* sw.js — agar aplikasi bisa dibuka & dipakai saat offline (taruh di folder yang sama dengan index.html)
 *
 * Yang disimpan di perangkat:
 *   - halaman index.html + berkas sendiri (manifest, ikon)
 *   - aset CDN yang dibutuhkan tampilan: Tailwind, Font Awesome (ikon), hls.js, font Inter
 * Yang TIDAK disentuh: TMDB, YouTube, iTunes, Vidio, stream TV/video, dan permintaan non-GET.
 * Lagu Lokal tersimpan di IndexedDB, tidak bergantung pada berkas ini.
 *
 * Kunjungan pertama harus online agar semuanya tersimpan. Setelah itu bisa offline.
 * Kalau index.html diganti, naikkan VERSION supaya cache lama dibuang.
 */
const VERSION = 'amnesfubbia-v1';
const APP_CACHE = VERSION + '-app';
const CDN_CACHE = VERSION + '-cdn';

const APP_URLS = ['./', './index.html', './manifest.json', './amnesfubbia.png'];
const CDN_URLS = [
  'https://cdn.tailwindcss.com/3.4.17',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap'
];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// Simpan satu URL ke cache. Coba mode CORS dulu (hasilnya bisa dipakai untuk font), baru no-cors.
async function precache(cache, url) {
  try {
    const res = await fetch(new Request(url, { mode: 'cors' }));
    if (res.ok) return cache.put(url, res);
  } catch (e) { /* lanjut ke no-cors */ }
  try {
    const res = await fetch(new Request(url, { mode: 'no-cors' }));
    if (res.ok || res.type === 'opaque') return cache.put(url, res);
  } catch (e) { /* biarkan: akan tersimpan saat dipakai pertama kali */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    const cdn = await caches.open(CDN_CACHE);
    await Promise.all([
      ...APP_URLS.map(u => app.add(new Request(u, { cache: 'reload' })).catch(() => {})),
      ...CDN_URLS.map(u => precache(cdn, u))
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

// Halaman: ambil dari jaringan (maks 4 detik) supaya selalu terbaru; kalau gagal/offline pakai simpanan.
async function pageStrategy(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true }))
        || (await cache.match('./index.html'))
        || (await cache.match('./'))
        || Response.error();
  }
}

// Aset: pakai simpanan dulu (cepat & offline), perbarui diam-diam di latar belakang.
async function assetStrategy(req) {
  const own = new URL(req.url).origin === self.location.origin;
  const cache = await caches.open(own ? APP_CACHE : CDN_CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) return hit;
  return (await net) || Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(pageStrategy(req));
  } else if (CDN_HOSTS.includes(url.hostname) || url.origin === self.location.origin) {
    event.respondWith(assetStrategy(req));
  }
  // selain itu: biarkan browser menangani sendiri
});
