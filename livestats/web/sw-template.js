const CACHE = __CACHE_NAME__;
const ASSETS = __ASSETS__;
const URLS = new Set(ASSETS);

self.addEventListener('install', (event) => {
  // Installation is atomic. A failed download leaves the prior release active.
  // No skipWaiting: an update may not take over a game already in progress.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(
    ASSETS.map((url) => new Request(url, { cache: 'reload' })),
  )));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('hooplog-shell-') && key !== CACHE) await caches.delete(key);
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Future account and checkout traffic must always reach the server.
  if (/^\/(?:api|auth|checkout|webhooks)(?:\/|$)/.test(url.pathname)) return;
  const route = request.mode === 'navigate' && !/\.[^/]+$/.test(url.pathname);
  const asset = URLS.has(url.pathname);
  if (!route && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Serve the active release's HTML as well as its assets. Network-first
    // HTML could load release B while release A still controls this game.
    const cached = await cache.match(route ? '/index.html' : url.pathname);
    return cached || fetch(request);
  })());
});
