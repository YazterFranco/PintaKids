/**
 * Cloudflare Pages · modo avanzado (_worker.js)
 * Replica la API del servidor Node (/v1/*) y sirve la PWA desde los assets estáticos.
 * Sin dependencias. Gratis en el plan Free de Cloudflare.
 */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "connect-src 'self' data: blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function notFound(message) {
  return json({ error: { code: 'NO_ENCONTRADO', message } }, 404);
}

function secure(res, extra = {}) {
  const h = new Headers(res.headers);
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'no-referrer');
  h.set('permissions-policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const asset = (path) => env.ASSETS.fetch(new URL(path, url));

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: { code: 'METODO', message: 'Método no permitido.' } }, 405);
    }

    // Salud
    if (p === '/v1/health') {
      const idx = await asset('/catalog-index.json');
      let total = 0;
      if (idx.status === 200) {
        try {
          total = (await idx.clone().json()).total ?? 0;
        } catch {}
      }
      return json({ ok: true, app: 'pintakids', now: Date.now(), catalog: total });
    }

    // Catálogo: índice, paquete y SVG
    if (p === '/v1/catalog') {
      const r = await asset('/catalog-index.json');
      return secure(r, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' });
    }
    let m = /^\/v1\/catalog\/([a-z0-9-]+)\/?$/.exec(p);
    if (m) {
      const r = await asset(`/catalog/${m[1]}/manifest.json`);
      if (r.status !== 200) return notFound('Paquete inexistente.');
      return secure(r, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' });
    }
    let f = /^\/v1\/catalog\/([a-z0-9-]+)\/files\/([a-zA-Z0-9._-]+\.svg)$/.exec(p);
    if (f) {
      const r = await asset(`/catalog/${f[1]}/${f[2]}`);
      if (r.status !== 200) return notFound('Dibujo inexistente.');
      return secure(r, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=604800, immutable' });
    }

    // Canal de versión del APK: no disponible en la versión web estática.
    if (p === '/v1/app-version') return notFound('Aún no hay versión publicada.');
    if (p === '/descargas/app.apk') return notFound('No hay APK disponible.');

    // API desconocida → JSON (nunca el HTML de la SPA).
    if (p.startsWith('/v1/') || p.startsWith('/descargas')) return notFound('Recurso inexistente.');

    // Assets estáticos + fallback SPA
    let res = await env.ASSETS.fetch(request);
    if (res.status === 404 && !p.includes('.')) {
      res = await env.ASSETS.fetch(new URL('/', url));
      if (res.status === 200) return secure(res, { 'content-security-policy': CSP, 'cache-control': 'no-cache' });
    }

    const type = res.headers.get('content-type') || '';
    if (p === '/manifest.webmanifest') {
      return secure(res, { 'content-type': 'application/manifest+json; charset=utf-8' });
    }
    if (p === '/sw.js') {
      return secure(res, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
    }
    if (type.startsWith('text/html')) {
      return secure(res, { 'content-security-policy': CSP, 'cache-control': 'no-cache' });
    }
    return res;
  },
};
