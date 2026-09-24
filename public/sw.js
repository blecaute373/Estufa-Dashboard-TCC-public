/**
 * Service Worker — Estufa 01 PWA
 * Cacheia assets estáticos para funcionamento offline básico
 */
const CACHE = 'estufa-v5';
/* Apenas assets públicos: páginas protegidas (/ , /dashboard.html, /admin.html)
   ficam a cargo do network-first em tempo de execução, para não gravar
   a página de login sob a chave de outra rota. */
const ASSETS = [
  /* folhas de estilo (arquitectura modular) */
  '/css/tokens.css',
  '/css/base.css',
  '/css/base2.css',
  '/css/auth.css',
  '/css/auth2.css',
  '/css/dashboard.css',
  '/css/dashboard2.css',
  '/css/dashboard3.css',
  '/css/admin.css',
  '/css/control.css',
  /* scripts */
  '/script.js',
  '/js/theme.js',
  '/js/sensor.js',
  '/js/control.js',
  '/pwa.js',
  /* páginas públicas */
  '/index.html',
  '/login-dashboard.html',
  '/login-admin.html',
  /* PWA */
  '/manifest-dashboard.json',
  '/manifest-admin.json'
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