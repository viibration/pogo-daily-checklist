const CACHE = 'daily-checklist-v217';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon.png',
  './icons/candy.webp',
  './icons/candy-xl.webp',
  './icons/max-particle.webp',
  './icons/stardust.webp',
  './background.jpg',
  './gym/1-8.png',
  './gym/9-13.png',
  './gym/14-22.png',
];
// A page request waits this long for the network before falling back to the
// saved copy, so a weak signal opens the app at once instead of hanging.
const NAV_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Lets the page request start while this worker is still waking up.
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const network = (async () => {
        const res = (await event.preloadResponse) || (await fetch(req));
        if (res && res.ok) await cache.put(req, res.clone());
        return res;
      })();
      // Keep the worker alive so a slow response still refreshes the saved copy.
      event.waitUntil(network.catch(() => {}));
      try {
        const res = await Promise.race([
          network,
          new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS)),
        ]);
        if (res) return res;
      } catch (e) { /* offline: use the saved copy */ }
      const saved = (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html'));
      return saved || network;
    })());
    return;
  }
  // Pictures and other files: saved copy first, and anything new is saved for next time (works offline too).
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  })());
});
