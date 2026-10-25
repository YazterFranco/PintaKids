/**
 * Service worker de Pintakids: la app funciona SIN INTERNET.
 * - Shell (HTML/CSS/JS): red primero, caché como rescate → las actualizaciones llegan siempre.
 * - APIs y catálogo: red primero, caché como rescate.
 * - Assets estáticos (iconos, fuentes): cache-first.
 * - skipWaiting + clients.claim: el SW nuevo toma control inmediato.
 */

const VERSION = 'pintakids-v5';

const PRECACHE = [
  '/',
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
  '/ui/icons.js',
  '/assets/fonts/Baloo2-Variable.ttf',
  '/assets/fonts/OFL.txt',
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

/** Shell y módulos: siempre red primero. Caché solo como respaldo offline. */
const SHELL = new Set([
  '/', '/index.html', '/style.css', '/app.js', '/sw.js',
  '/manifest.webmanifest',
  '/core/store.js', '/core/strokes.js', '/core/history.js',
  '/core/colorfill.js', '/core/lineart.js', '/core/paint.js',
  '/core/story.js', '/core/i18n.js', '/core/tts.js',
  '/ui/surface.js', '/ui/parts.js', '/ui/icons.js',
  '/modes/draw.js', '/modes/color.js', '/modes/learn.js',
  '/modes/photo.js', '/modes/story.js', '/modes/gallery.js',
  '/modes/parents.js',
]);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Shell, módulos y API: red primero (las actualizaciones llegan siempre), caché como rescate offline.
  const isNav = e.request.mode === 'navigate';
  if (isNav || SHELL.has(url.pathname) || url.pathname.startsWith('/v1/')) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
          return r;
        })
        .catch(async () => {
          // Navegación offline: servir '/' (respuesta limpia, no un redirect cacheado).
          if (isNav) return (await caches.match('/')) || Response.error();
          return (await caches.match(e.request)) || Response.error();
        }),
    );
    return;
  }

  // Assets estáticos (iconos, fuentes): cache-first (cambian solo con nuevo SW).
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
