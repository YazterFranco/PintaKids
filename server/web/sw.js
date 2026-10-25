/**
 * Service worker de Pintakids: la app funciona SIN INTERNET.
 * - Shell (HTML/CSS/JS): red primero, caché como rescate → las actualizaciones llegan siempre.
 * - APIs y catálogo: red primero, caché como rescate.
 * - Assets estáticos (iconos, fuentes): cache-first.
 * - skipWaiting + clients.claim: el SW nuevo toma control inmediato.
 */

const VERSION = 'pintakids-v8';

const PRECACHE = [
  '/',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/bootcheck.js',
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
  '/', '/index.html', '/style.css', '/app.js', '/sw.js', '/bootcheck.js',
  '/manifest.webmanifest',
  '/core/store.js', '/core/strokes.js', '/core/history.js',
  '/core/colorfill.js', '/core/lineart.js', '/core/paint.js',
  '/core/story.js', '/core/i18n.js', '/core/tts.js',
  '/ui/surface.js', '/ui/parts.js', '/ui/icons.js',
  '/modes/draw.js', '/modes/color.js', '/modes/learn.js',
  '/modes/photo.js', '/modes/story.js', '/modes/gallery.js',
  '/modes/parents.js',
]);

/** Pide a la red sin validación condicional: evita respuestas 304 sin cuerpo. */
function freshFetch(request) {
  const headers = new Headers(request.headers);
  for (const h of ['if-none-match', 'if-modified-since', 'if-match', 'if-unmodified-since']) headers.delete(h);
  return fetch(
    new Request(request.url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      credentials: request.credentials,
      redirect: 'follow',
    }),
  );
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isNav = e.request.mode === 'navigate';
  const isApi = url.pathname.startsWith('/v1/');
  const isShell = SHELL.has(url.pathname) || isApi;

  if (isNav || isShell) {
    e.respondWith(
      (async () => {
        let res = null;
        try {
          res = await freshFetch(e.request);
        } catch (err) {
          res = null;
        }
        // 304 nunca se devuelve al navegador: usar la copia en caché.
        if (!res || res.status === 304) {
          const hit =
            (await caches.match(e.request)) ||
            (await caches.match(url.pathname)) ||
            (isNav ? await caches.match('/') : null);
          if (hit) return hit;
          if (res && res.status !== 304) return res;
          return Response.error();
        }
        if (res.ok) {
          const key = isApi ? e.request : url.pathname;
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(key, copy)).catch(() => {});
        }
        return res;
      })(),
    );
    return;
  }

  // Assets estáticos (iconos, fuentes): cache-first (cambian solo con nuevo SW).
  e.respondWith(
    caches.match(e.request).then(async (hit) => {
      if (hit) return hit;
      try {
        const r = await freshFetch(e.request);
        if (r.status === 304) {
          return (await caches.match(url.pathname)) || r;
        }
        if (r.ok) {
          const copy = r.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return r;
      } catch (err) {
        return (await caches.match(url.pathname)) || Response.error();
      }
    }),
  );
});
