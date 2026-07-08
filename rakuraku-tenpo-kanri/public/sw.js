/**
 * Service Worker
 * - index.html は常にネットワーク優先（キャッシュ古い問題への対策）
 * - ハッシュ付きアセットはキャッシュ優先
 * - 新バージョン検知時はアプリ側のトーストから SKIP_WAITING を受けて即時更新
 */
const CACHE = 'rakuraku-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // ナビゲーション（index.html）は常にネットワーク優先・失敗時のみキャッシュ
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // ハッシュ付きビルドアセットはキャッシュ優先
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(event.request, copy))
            return res
          }),
      ),
    )
  }
})
