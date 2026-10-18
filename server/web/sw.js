/**
 * Service worker de Pintakids: la app funciona SIN INTERNET.
 * - Precachea el paquete completo (shell + core + modes + i18n + assets).
 * - Caché de primera respuesta para catálogo y APIs (los paquetes descargados siguen vivos offline).
 */

const VERSION = 'pintakids-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/assets/icon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/i18n/es.json',
  '/i18n/en.json',
  '/core/store.js',
  '/core/strokes.js',
  '/core/history.js',
  '/core/colorfill.js',
  '/core/lineart.js',
  '/core/paint.js',
  '/core/story.js',
  '/core/i18n.js',
  '/core/tts.js',
  '/ui/surface.js',
  '/ui/parts.js',
  '/modes/draw.js',
  '/modes/color.js',
  '/modes/learn.js',
  '/modes/photo.js',
  '/modes/story.js',
  '/modes/gallery.js',
  '/modes/parents.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API y catálogo: red primero (los paquetes nuevos llegan), caché como rescate.
  if (url.pathname.startsWith('/v1/')) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request)),
    );
    return;
  }

  // App: cache-first (ya se actualiza con el install del nuevo SW).
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((r) => {
          const copy = r.clone();
          if (r.ok) caches.open(VERSION).then((c) => c.put(e.request, copy));
          return r;
        }),
    ),
  );
});
