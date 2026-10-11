import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db } from './db.ts';
import { Hub, type Conn } from './hub.ts';
import { LiveFeed } from './live.ts';
import { Runtime } from './runtime.ts';
import { createApi, authenticateDevice } from './api.ts';
import { staticFile } from './static.ts';
import { loadOrCreateVapid, WebPushSender } from './webpush.ts';
import { startHttpPoller, startEmscSocket } from './pollers.ts';
import { parseIgcHtml } from './sources/igc.ts';
import { parseUsgsFeed } from './sources/usgs.ts';
import { Releases, MAX_APK_BYTES } from './releases.ts';
import { SOURCE_POLL_MS, HEARTBEAT_MS } from './config.ts';

const env = process.env;
const PORT = Number(env.PORT ?? 8080);
const DB_PATH = env.DB_PATH ?? './data/alertas.sqlite';
const MAX_BODY = 16 * 1024;
const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(SERVER_DIR, '..', 'web');

const guide: unknown = JSON.parse(readFileSync(new URL('../data/guide.json', import.meta.url), 'utf8'));

const db = new Db(DB_PATH);
const hub = new Hub(db);
const live = new LiveFeed();
const releases = new Releases(join(dirname(DB_PATH), 'releases'));

// Llaves VAPID junto a la base de datos (se crean la primera vez, permisos 600).
const vapid = loadOrCreateVapid(join(dirname(DB_PATH), 'vapid.json'));
const webPush = new WebPushSender(vapid, env.VAPID_SUBJECT ?? 'mailto:alertas@example.com');

const runtime = new Runtime(db, hub, () => Date.now(), { web: webPush, live });
const api = createApi({ db, runtime, hub, guide, adminToken: env.ADMIN_TOKEN, vapidPublicKey: vapid.publicKey, live });

const pollers = [
  startHttpPoller({
    name: 'igc',
    url: env.IGC_URL ?? 'https://sismosgeociencias.up.ac.pa/',
    intervalMs: SOURCE_POLL_MS.igc,
    runtime,
    parse: (text, now) => parseIgcHtml(text, now),
  }),
  startHttpPoller({
    name: 'usgs',
    url: env.USGS_URL ?? 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    intervalMs: SOURCE_POLL_MS.usgs,
    runtime,
    parse: (text, now) => parseUsgsFeed(JSON.parse(text), now),
  }),
];
const emsc = startEmscSocket({
  url: env.EMSC_WS_URL ?? 'wss://www.seismicportal.eu/standing_order/websocket',
  runtime,
});

const ticker = setInterval(() => {
  runtime
    .tick()
    .then(() => live.broadcast('health', runtime.snapshot()))
    .catch((e: unknown) => console.error('tick:', e instanceof Error ? e.message : e));
}, 60_000);
const heartbeat = setInterval(() => {
  hub.heartbeat();
  live.heartbeat();
}, HEARTBEAT_MS);

function readBody(req: IncomingMessage): Promise<string | 'TOO_LARGE'> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve('TOO_LARGE');
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Lee un cuerpo binario (subida de APK) con su propio límite. null si excede. */
function readBinary(req: IncomingMessage, max: number): Promise<Buffer | null> {
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

/** Comparación de token en tiempo constante (mismo esquema que las métricas de latencia). */
function adminOk(header: string | undefined): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  const token = m?.[1].trim();
  if (!token || !env.ADMIN_TOKEN) return false;
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(env.ADMIN_TOKEN).digest();
  return timingSafeEqual(a, b);
}

/** Encabezados con texto: llegan URL-encoded desde CI (solo permiten ASCII). */
function headerText(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  try {
    return decodeURIComponent(s).slice(0, 2000);
  } catch {
    return undefined;
  }
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (status === 204) {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(body ?? {}));
}

/** Abre un flujo de eventos (text/event-stream) y lo registra con la función de alta indicada. */
function openStream(req: IncomingMessage, res: ServerResponse, register: (conn: Conn) => () => void): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
    'x-content-type-options': 'nosniff',
  });
  res.write('retry: 5000\n: conectado\n\n');
  const conn: Conn = {
    write: (chunk) => {
      res.write(chunk);
    },
    close: () => res.end(),
  };
  const unregister = register(conn);
  req.on('close', unregister);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');

    // Página pública: sin datos personales, solo sismos y estado.
    if (req.method === 'GET' && url.pathname === '/v1/live') {
      openStream(req, res, (conn) => {
        live.attach(conn);
        live.broadcast('health', runtime.snapshot());
        return () => live.detach(conn);
      });
      return;
    }

    // Canal en vivo de la app nativa (requiere su credencial).
    const stream = /^\/v1\/devices\/([A-Za-z0-9_-]+)\/stream$/.exec(url.pathname);
    if (req.method === 'GET' && stream) {
      const device = authenticateDevice(db, stream[1], req.headers.authorization);
      if (!device) {
        send(res, 401, { error: { code: 'NO_AUTORIZADO', message: 'Dispositivo o secreto inválido.' } });
        return;
      }
      openStream(req, res, (conn) => {
        hub.attach(device.id, conn, runtime.now());
        return () => hub.detach(device.id, conn);
      });
      return;
    }

    // Archivos de la página (lista blanca).
    if (req.method === 'GET') {
      const file = staticFile(url.pathname, WEB_DIR);
      if (file) {
        res.writeHead(200, { 'content-type': file.type, 'cache-control': file.cache, 'x-content-type-options': 'nosniff' });
        res.end(file.body);
        return;
      }
    }

    // Canal de distribución de la app: versión pública, descarga pública y publicación con ADMIN_TOKEN.
    if (req.method === 'GET' && url.pathname === '/v1/app-version') {
      const info = releases.current();
      if (!info) {
        send(res, 404, { error: { code: 'NO_ENCONTRADO', message: 'Aún no hay versión publicada.' } });
        return;
      }
      send(res, 200, { ...info, apkUrl: '/descargas/app.apk' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/descargas/app.apk') {
      const info = releases.current();
      const apk = info ? releases.apk() : null;
      if (!info || !apk) {
        send(res, 404, { error: { code: 'NO_ENCONTRADO', message: 'No hay APK disponible.' } });
        return;
      }
      res.writeHead(200, {
        'content-type': 'application/vnd.android.package-archive',
        'content-length': String(apk.length),
        'content-disposition': `attachment; filename="AlertaSismicaPA-${info.versionName}.apk"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      res.end(apk);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/admin/apk') {
      if (!adminOk(req.headers.authorization)) {
        send(res, 401, { error: { code: 'NO_AUTORIZADO', message: 'Se requiere el token de administración.' } });
        return;
      }
      const body = await readBinary(req, MAX_APK_BYTES);
      if (!body) {
        send(res, 413, { error: { code: 'DEMASIADO_GRANDE', message: `La APK no puede superar ${Math.floor(MAX_APK_BYTES / 1024 / 1024)} MB.` } });
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
        send(res, 400, { error: { code: 'APK_INVALIDA', message: e instanceof Error ? e.message : 'error' } });
      }
      return;
    }

    const hasBody = req.method === 'POST' || req.method === 'PUT';
    const body = hasBody ? await readBody(req) : undefined;
    if (body === 'TOO_LARGE') {
      send(res, 413, { error: { code: 'DEMASIADO_GRANDE', message: 'Cuerpo demasiado grande.' } });
      return;
    }
    const out = await api({
      method: req.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      authorization: req.headers.authorization,
      body,
    });
    send(res, out.status, out.body);
  } catch {
    send(res, 500, { error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor.' } });
  }
});

server.listen(PORT, () => console.log(`Alerta sísmica PA escuchando en el puerto ${PORT}`));

function shutdown(): void {
  clearInterval(ticker);
  clearInterval(heartbeat);
  for (const p of pollers) p.stop();
  emsc.stop();
  hub.closeAll();
  live.closeAll();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
