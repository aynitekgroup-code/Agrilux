// Agrilux Service Worker v2.0 — Offline-first
// Estrategias: Cache First (assets), Network First (API), Stale While Revalidate (imágenes)

const CACHE_NAME = 'agrilux-v2';
const CACHE_STATIC = 'agrilux-static-v2';
const CACHE_API = 'agrilux-api-v2';
const CACHE_IMAGES = 'agrilux-images-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
];

// ── Instalar ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then((c) => c.addAll(STATIC_ASSETS)),
      caches.open(CACHE_API),
      caches.open(CACHE_IMAGES),
    ])
  );
  self.skipWaiting();
});

// ── Activar ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![CACHE_STATIC, CACHE_API, CACHE_IMAGES].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // No cachear hosts externos que no controlamos
  const skipHosts = [
    'openrouter.ai',
    'firebaseapp.com',
    'firebase.googleapis.com',
    'firebasestorage.googleapis.com',
    'identitytoolkit.googleapis.com',
    'api.deepseek.com',
    'models.inference.ai.azure.com',
    'huggingface.co',
    'api-inference.huggingface.co',
  ];
  if (skipHosts.some((h) => url.hostname.includes(h))) return;

  // ── API calls: Network First, fallback a caché ───────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_API).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ── Imágenes: Stale While Revalidate ─────────────────────────────────────
  if (
    event.request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|avif)$/i)
  ) {
    event.respondWith(
      caches.open(CACHE_IMAGES).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => cached);

          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ── Assets estáticos: Cache First ────────────────────────────────────────
  if (
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    event.request.destination === 'font' ||
    url.pathname.match(/\.(js|css|woff2|woff|ttf)$/i)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then((c) => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Navegación HTML: Network First, fallback a index.html ────────────────
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        })
      )
  );
});

// ── Background Sync: Cola diagnósticos offline ──────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-diagnosticos') {
    event.waitUntil(syncDiagnosticos());
  }
});

async function syncDiagnosticos() {
  // Cuando vuelva la red, enviar diagnósticos pendientes
  const cache = await caches.open(CACHE_API);
  const keys = await cache.keys();
  for (const req of keys) {
    if (req.url.includes('/api/analizar-imagen')) {
      try {
        await fetch(req);
        await cache.delete(req);
      } catch (e) {
        // Seguir en cola
      }
    }
  }
}
