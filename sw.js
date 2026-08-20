const CACHE = 'natsumatsuri-pos-2026-08-20_1558';
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
  './src/ui/screen-merged.js',
  './src/core/syncrow.js',
  './src/core/xlsx.js',
  './src/core/exportsheets.js',
  './src/sync.js',
  './src/ui/escape.js',
  './src/ui/screen-top.js',
  './src/ui/screen-register.js',
  './src/ui/screen-history.js',
  './src/ui/screen-products.js',
  './src/ui/screen-export.js',
];

self.addEventListener('install', (e) => {
  // cache:'reload' でブラウザのHTTPキャッシュを迂回し、必ずサーバーの最新を取り込む
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
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
  const url = new URL(e.request.url);
  // 同期API（Supabase等）はキャッシュ対象外
  if (url.origin !== self.location.origin) return;

  // ネット優先: オンラインなら常に最新を取り、成功したらキャッシュも更新する。
  // オフライン・失敗時のみキャッシュから返す（屋台での起動はこれで守られる）。
  // 旧来のキャッシュ優先は「端末が古い版に固執する」事故を起こしたため廃止（2026-08-20）。
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
