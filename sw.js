const CACHE = 'natsumatsuri-pos-2026-08-19_1151';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './favicon.svg',
  './src/app.js',
  './src/version.js',
  './src/db.js',
  './src/core/money.js',
  './src/core/sale.js',
  './src/core/summary.js',
  './src/core/csv.js',
  './src/core/products.js',
  './src/core/cash.js',
  './src/ui/state.js',
  './src/ui/escape.js',
  './src/ui/screen-top.js',
  './src/ui/screen-register.js',
  './src/ui/screen-history.js',
  './src/ui/screen-products.js',
  './src/ui/screen-export.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
