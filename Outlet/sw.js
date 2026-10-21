// Outlet's service worker: the Home Screen app opens even with no signal, and still gets
// the newest version of Outlet whenever there's a connection.
// It only keeps Outlet's own page and icons. Team data and AI calls always go straight to the network.
const CACHE = 'outlet-v1';
const SHELL = ['Outlet.com.html', 'icon.svg', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((name) => name.startsWith('outlet-') && name !== CACHE).map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isShell = request.mode === 'navigate' || SHELL.some((file) => url.pathname.endsWith(`/${file}`));
  if (request.method !== 'GET' || url.origin !== location.origin || !isShell) return; // not ours: the network handles it as usual

  // Ask the server for the newest copy every time (a quick "unchanged" when nothing changed),
  // save it for later, and only use the saved copy when there's no connection.
  event.respondWith(fetch(request, { cache: 'no-cache' })
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
      }
      return response;
    })
    .catch(async (error) => {
      const saved = await caches.match(request, { ignoreSearch: true })
        || (request.mode === 'navigate' && await caches.match('Outlet.com.html'));
      if (saved) return saved;
      throw error;
    }));
});
