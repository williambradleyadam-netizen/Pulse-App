// PULSE service worker — makes the app installable and usable offline.
// The page itself is network-first so a new version shows up as soon as you're online;
// the cached copy is only the fallback. External APIs (food, exercises, AI) are never cached.
const CACHE = 'pulse-v2';
const APP_SHELL = [
  './pulse_2_3.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
];
// Only the app's own files and its two script CDNs are cached. Everything else — food and
// exercise APIs, the AI, Google sign-in, the account database — always goes to the network.
const CACHEABLE_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !CACHEABLE_HOSTS.includes(url.hostname)) return; // live data only

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html');
  if (isPage) {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('./pulse_2_3.html')))
    );
    return;
  }
  // Icons, the scanner library, fonts: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
