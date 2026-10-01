// ネットワーク優先。通信が遅いときは3秒でキャッシュに切り替える（更新が反映されやすく、圏外や電波が弱くても開ける）
const CACHE = 'rakuraku-tachiage-v2';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const NETWORK_TIMEOUT_MS = 3000;
const SLOW_WINDOW_MS = 30000;
let slowUntil = 0; // 通信が遅いと分かったあいだは、待たずにキャッシュを返す

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const cached = () => caches.match(req).then((hit) => hit || caches.match('index.html'));
  const net = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  if (Date.now() < slowUntil) {
    e.respondWith(cached());
    return;
  }
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS)).then(() => {
    slowUntil = Date.now() + SLOW_WINDOW_MS;
    return cached();
  });
  e.respondWith(Promise.race([net, timeout]).catch(cached));
});
