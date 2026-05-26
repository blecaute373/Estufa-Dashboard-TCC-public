/**
 * Service Worker — Estufa 01 PWA
 * Cacheia assets estáticos para funcionamento offline básico
 */
const CACHE = 'estufa-v2';
const ASSETS = [
  '/style.css',
  '/script.js',
  '/',
  '/login-dashboard.html',
  '/login-admin.html',
  '/dashboard.html',
  '/admin.html',
  '/index.html',
  '/manifest-dashboard.json',
  '/manifest-admin.json',
  '/pwa.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Limpando cache antigo:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // API calls: network only
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Static assets: network first, cache fallback
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});