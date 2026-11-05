/* Il Noskynismo — service worker: funziona anche con poca connessione */
const CACHE = 'nsk-v2';
const CORE = ['./', 'index.html', 'assets/css/style.css', 'assets/js/app.js', 'assets/js/i18n.js', 'assets/js/qr.js',
  'assets/img/emblem-96.webp', 'assets/img/emblem-256.webp', 'assets/img/emblem-640.webp',
  'assets/img/favicon.png', 'assets/img/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || r.headers.has('range') || /\.(mp3|pdf)$/i.test(u.pathname)) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('index.html', cp)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  if (/\/content\/.*\.json$/.test(u.pathname)) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r)));
    return;
  }
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
