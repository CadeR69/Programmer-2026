// Service worker: keeps the app shell available offline.
// Downloaded music and covers live in their own caches (see js/offline.js) and are read by the
// page directly, so this worker never touches /api/* or audio.
const VERSION = 'v1';
const SHELL = `cadence-shell-${VERSION}`;
// Note: the page is cached as '/' only. Cloudflare redirects /index.html to /, and a browser will
// not accept a redirected response as the answer to a page load.
const ASSETS = [
  '/',
  '/style.css',
  '/manifest.webmanifest',
  '/js/main.js',
  '/js/api.js',
  '/js/art.js',
  '/js/core.js',
  '/js/offline.js',
  '/js/player.js',
  '/js/playerui.js',
  '/js/store.js',
  '/js/ui.js',
  '/js/upload.js',
  '/js/views.js',
  '/vendor/jsmediatags.min.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// Page loads must never be answered with a response whose "redirected" flag is set.
function plain(res) {
  if (!res.redirected) return res;
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await Promise.all(
        ASSETS.map(async (url) => {
          const res = await fetch(url, { cache: 'reload' });
          if (!res.ok) throw new Error(`precache failed: ${url} (${res.status})`);
          await cache.put(url, plain(res));
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('cadence-shell-') && key !== SHELL) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Page loads: network first so deploys show up, cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((cache) => cache.put('/', plain(res.clone())));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match('/');
          return cached ? plain(cached) : Response.error();
        }),
    );
    return;
  }

  // Everything else: serve the cached copy immediately and refresh it in the background.
  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const cached = await cache.match(req);
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await refresh) || Response.error();
    }),
  );
});
