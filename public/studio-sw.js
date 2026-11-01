/* Ferrn Studio service worker: caches the app shell so the Studio opens instantly and
   offline; API calls always go to the network (data is never cached here). */
const CACHE = 'ferrn-studio-v3.0.3';
const SHELL = ['/studio', '/studio/app.js?v=3.0.3', '/studio/studio.css?v=3.0.3', '/brand/ferrn-mark.svg', '/brand/ferrn-logo.svg', '/icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate' && url.pathname.startsWith('/studio')) {
    e.respondWith(fetch(e.request).catch(() => caches.match('/studio')));
    return;
  }
  if (SHELL.some((s) => url.pathname + url.search === s || url.pathname === s)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
    })));
  }
});
