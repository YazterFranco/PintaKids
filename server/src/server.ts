import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Releases, MAX_APK_BYTES } from './releases.ts';
import { Catalog } from './catalog.ts';
import { staticFile } from './static.ts';

/**
 * Pintakids — servidor mínimo SIN dependencias (mismo patrón que el proyecto anterior):
 * sirve la app web (PWA), el catálogo de dibujos gratuitos y el canal de autoactualización del APK.
 * No usa base de datos: todo vive en la imagen (web/catalog) y en el volumen (/data/releases).
 */

const env = process.env;
const PORT = Number(env.PORT ?? 8080);
const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
// WEB_DIR/CATALOG_DIR/RELEASES_DIR son sobre escribibles por variables solo para pruebas.
const WEB_DIR = env.WEB_DIR ?? join(SERVER_DIR, '..', 'web');
const CATALOG_DIR = env.CATALOG_DIR ?? join(SERVER_DIR, '..', 'catalog');
const RELEASES_DIR = env.RELEASES_DIR ?? join(SERVER_DIR, '..', 'data', 'releases');
const MAX_JSON_BODY = 16 * 1024;
const APP_CHANNEL = 'pintakids';
const startedAt = Date.now();

const releases = new Releases(RELEASES_DIR, APP_CHANNEL);
const catalog = new Catalog(CATALOG_DIR);

/** CSP pensada para menores: solo contenido propio, sin rastreo ni recursos externos. */
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

const securityHeaders: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
};

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (status === 204) {
    res.writeHead(204, securityHeaders);
    res.end();
    return;
  }
  res.writeHead(status, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function err(res: ServerResponse, status: number, code: string, message: string): void {
  send(res, status, { error: { code, message } });
}

function readBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        resolve(null);
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function adminOk(header: string | undefined): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  const token = m?.[1].trim();
  if (!token || !env.ADMIN_TOKEN) return false;
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(env.ADMIN_TOKEN).digest();
  return timingSafeEqual(a, b);
}

function headerText(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  try {
    return decodeURIComponent(s).slice(0, 2000);
  } catch {
    return undefined;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const p = url.pathname;

    // Salud (healthcheck de Railway).
    if (req.method === 'GET' && p === '/v1/health') {
      send(res, 200, { ok: true, app: APP_CHANNEL, now: Date.now(), uptimeMs: Date.now() - startedAt, catalog: catalog.summary().total });
      return;
    }

    // Catálogo de dibujos gratuitos: índice, paquete y archivo SVG individual.
    if (req.method === 'GET' && p === '/v1/catalog') {
      send(res, 200, { generatedAt: Date.now(), ...catalog.summary(), licenses: ['gratis-sin-condiciones'] });
      return;
    }
    const packMatch = /^\/v1\/catalog\/([a-z0-9-]+)\/?$/.exec(p);
    if (packMatch && req.method === 'GET') {
      const pack = catalog.pack(packMatch[1]);
      if (!pack) {
        err(res, 404, 'NO_ENCONTRADO', 'Paquete inexistente.');
        return;
      }
      send(res, 200, pack);
      return;
    }
    const fileMatch = /^\/v1\/catalog\/([a-z0-9-]+)\/files\/([a-zA-Z0-9._-]+\.svg)$/.exec(p);
    if (fileMatch && req.method === 'GET') {
      const body = catalog.file(fileMatch[1], fileMatch[2]);
      if (!body) {
        err(res, 404, 'NO_ENCONTRADO', 'Dibujo inexistente.');
        return;
      }
      res.writeHead(200, {
        ...securityHeaders,
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=604800, immutable',
      });
      res.end(body);
      return;
    }

    // Canal de autoactualización (mismo contrato que la app anterior, marca pintakids).
    if (req.method === 'GET' && p === '/v1/app-version') {
      const info = releases.current();
      if (!info) {
        err(res, 404, 'NO_ENCONTRADO', 'Aún no hay versión publicada.');
        return;
      }
      send(res, 200, { ...info, apkUrl: '/descargas/app.apk' });
      return;
    }
    if (req.method === 'GET' && p === '/descargas/app.apk') {
      const info = releases.current();
      const apk = info ? releases.apk() : null;
      if (!info || !apk) {
        err(res, 404, 'NO_ENCONTRADO', 'No hay APK disponible.');
        return;
      }
      res.writeHead(200, {
        ...securityHeaders,
        'content-type': 'application/vnd.android.package-archive',
        'content-length': String(apk.length),
        'content-disposition': `attachment; filename="Pintakids-${info.versionName}.apk"`,
        'cache-control': 'no-store',
      });
      res.end(apk);
      return;
    }
    if (req.method === 'POST' && p === '/v1/admin/apk') {
      if (!adminOk(req.headers.authorization)) {
        err(res, 401, 'NO_AUTORIZADO', 'Se requiere el token de administración.');
        return;
      }
      const body = await readBody(req, MAX_APK_BYTES);
      if (!body) {
        err(res, 413, 'DEMASIADO_GRANDE', `La APK no puede superar ${Math.floor(MAX_APK_BYTES / 1024 / 1024)} MB.`);
        return;
      }
      try {
        const info = releases.publish(body, {
          versionCode: Number(req.headers['x-version-code']) || undefined,
          versionName: headerText(req.headers['x-version-name']),
          notes: headerText(req.headers['x-notes']),
          mandatory: req.headers['x-mandatory'] === '1',
        });
        send(res, 200, info);
      } catch (e) {
        err(res, 400, 'APK_INVALIDA', e instanceof Error ? e.message : 'error');
      }
      return;
    }

    // Página y recursos de la app.
    if (req.method === 'GET' || req.method === 'HEAD') {
      const file = staticFile(p, WEB_DIR);
      if (file) {
        const isHtml = file.type.startsWith('text/html');
        res.writeHead(200, {
          ...securityHeaders,
          'content-type': file.type,
          'cache-control': file.cache,
          ...(isHtml ? { 'content-security-policy': CSP } : {}),
        });
        res.end(req.method === 'HEAD' ? undefined : file.body);
        return;
      }
    }

    err(res, 404, 'NO_ENCONTRADO', 'Recurso inexistente.');
  } catch (e) {
    console.error('server:', e instanceof Error ? e.message : e);
    if (!res.headersSent) err(res, 500, 'INTERNO', 'Error interno.');
  }
});

if (import.meta.url === `file://${process.argv[1]}` || process.env.RUN_AS_SERVER === '1') {
  server.listen(PORT, () => console.log(`Pintakids escuchando en :${PORT} (${APP_CHANNEL})`));
}

export { server };
