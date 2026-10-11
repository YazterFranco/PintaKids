import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createVapid,
  vapidJwt,
  publicKeyOf,
  isAllowedEndpoint,
  WebPushSender,
  type Vapid,
} from '../../src/webpush.ts';
import { staticFile } from '../../src/static.ts';
import { makeWorld, fakeConn, T0 } from '../helpers/world.ts';
import type { PushData } from '../../src/types.ts';

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web');
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

const PUSH: PushData = {
  eventId: 'ev-1',
  action: 'alarm',
  level: 'critical',
  title: 'Sismo fuerte',
  body: 'M 6.1 cerca de Panamá',
};

describe('VAPID y Web Push', () => {
  test('el JWT VAPID se verifica con la llave pública publicada', () => {
    const v: Vapid = createVapid();
    const nowSec = Math.floor(T0 / 1000);
    const jwt = vapidJwt(v, 'https://fcm.googleapis.com', nowSec, 'mailto:x@example.com');
    const [h, c, s] = jwt.split('.');
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString('utf8')) as Record<string, unknown>;
    assert.equal(claims.aud, 'https://fcm.googleapis.com');
    assert.equal(claims.sub, 'mailto:x@example.com');
    assert.equal(claims.exp, nowSec + 12 * 3600);
    assert.equal(JSON.parse(Buffer.from(h, 'base64url').toString('utf8')).alg, 'ES256');
    const ok = createVerify('SHA256')
      .update(`${h}.${c}`)
      .verify({ key: publicKeyOf(v), dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
    assert.equal(ok, true);
  });

  test('la llave pública en base64url tiene 65 bytes que empiezan en 0x04', () => {
    const raw = Buffer.from(createVapid().publicKey, 'base64url');
    assert.equal(raw.length, 65);
    assert.equal(raw[0], 4);
  });

  test('isAllowedEndpoint acepta solo https hacia servicios de push conocidos', () => {
    assert.equal(isAllowedEndpoint(ENDPOINT), true);
    assert.equal(isAllowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'), true);
    assert.equal(isAllowedEndpoint('https://web.push.apple.com/abc'), true);
    assert.equal(isAllowedEndpoint('https://update.googleapis.com/service/update2/webpush/push/v2/x'), true);
    assert.equal(isAllowedEndpoint('http://fcm.googleapis.com/fcm/send/abc'), false);
    assert.equal(isAllowedEndpoint('https://evil.example.com/fcm/send/abc'), false);
    assert.equal(isAllowedEndpoint('https://fcm.googleapis.com.evil.com/x'), false);
    assert.equal(isAllowedEndpoint('no es una url'), false);
  });

  test('tickle envía POST vacío con TTL, Urgency y Authorization VAPID', async () => {
    const v = createVapid();
    let seen: { url: string; init?: RequestInit } | null = null;
    const sender = new WebPushSender(
      v,
      'mailto:x@example.com',
      async (url, init) => {
        seen = { url, init };
        return new Response(null, { status: 201 });
      },
      () => T0,
    );
    assert.equal(await sender.tickle(ENDPOINT), 'ok');
    assert.ok(seen);
    const s = seen as { url: string; init?: RequestInit };
    assert.equal(s.url, ENDPOINT);
    assert.equal(s.init?.method, 'POST');
    assert.equal(s.init?.body, undefined);
    const headers = s.init?.headers as Record<string, string>;
    assert.equal(headers.TTL, '600');
    assert.equal(headers.Urgency, 'high');
    assert.match(headers.Authorization, /^vapid t=[^,]+, k=/);
    assert.ok(headers.Authorization.includes(`k=${v.publicKey}`));
  });

  test('404 y 410 indican suscripción caducada; otros errores no', async () => {
    const v = createVapid();
    const make = (status: number) =>
      new WebPushSender(v, 'mailto:x@example.com', async () => new Response(null, { status }), () => T0);
    assert.equal(await make(404).tickle(ENDPOINT), 'gone');
    assert.equal(await make(410).tickle(ENDPOINT), 'gone');
    assert.equal(await make(500).tickle(ENDPOINT), 'error');
    const throwing = new WebPushSender(
      v,
      'mailto:x@example.com',
      async () => {
        throw new Error('red caída');
      },
      () => T0,
    );
    assert.equal(await throwing.tickle(ENDPOINT), 'error');
  });
});

describe('archivos estáticos', () => {
  test('sirve solo archivos de la lista blanca', () => {
    assert.ok(staticFile('/', WEB_DIR));
    assert.equal(staticFile('/', WEB_DIR)?.type, 'text/html; charset=utf-8');
    assert.ok(staticFile('/app.js', WEB_DIR));
    assert.ok(staticFile('/sw.js', WEB_DIR));
    assert.ok(staticFile('/creds.js', WEB_DIR));
    assert.ok(staticFile('/manifest.webmanifest', WEB_DIR));
  });

  test('rechaza rutas fuera de la lista (recorrido de carpetas incluido)', () => {
    assert.equal(staticFile('/../src/server.ts', WEB_DIR), null);
    assert.equal(staticFile('/..%2fsrc%2fserver.ts', WEB_DIR), null);
    assert.equal(staticFile('/secreto.txt', WEB_DIR), null);
    assert.equal(staticFile('/data/guide.json', WEB_DIR), null);
  });

  test('el service worker no se cachea en el navegador', () => {
    assert.equal(staticFile('/sw.js', WEB_DIR)?.cache, 'no-cache');
    assert.equal(staticFile('/app.js', WEB_DIR)?.cache, 'public, max-age=300');
  });
});

describe('suscripción web por la API', () => {
  test('rechaza un endpoint no permitido con 400', async () => {
    const w = makeWorld();
    const out = await w.api({
      method: 'POST',
      path: '/v1/web/subscriptions',
      query: new URLSearchParams(),
      body: JSON.stringify({ endpoint: 'https://evil.example.com/x' }),
    });
    assert.equal(out.status, 400);
  });

  test('registra el navegador como dispositivo web y devuelve credenciales', async () => {
    const w = makeWorld();
    const out = await w.api({
      method: 'POST',
      path: '/v1/web/subscriptions',
      query: new URLSearchParams(),
      body: JSON.stringify({ endpoint: ENDPOINT }),
    });
    assert.equal(out.status, 201);
    const body = out.body as { deviceId: string; secret: string };
    assert.ok(body.deviceId.startsWith('w_'));
    assert.ok(body.secret.length > 20);
    const row = w.db.getDevice(body.deviceId);
    assert.equal(row?.kind, 'web');
    assert.equal(row?.pushEndpoint, ENDPOINT);
  });

  test('una nueva suscripción al mismo endpoint reemplaza la anterior', async () => {
    const w = makeWorld();
    const req = {
      method: 'POST',
      path: '/v1/web/subscriptions',
      query: new URLSearchParams(),
      body: JSON.stringify({ endpoint: ENDPOINT }),
    };
    const a = (await w.api(req)).body as { deviceId: string };
    const b = (await w.api(req)).body as { deviceId: string };
    assert.notEqual(a.deviceId, b.deviceId);
    assert.equal(w.db.getDevice(a.deviceId), null);
    assert.ok(w.db.getDevice(b.deviceId));
  });

  test('la llave VAPID pública se entrega al navegador', async () => {
    const w = makeWorld();
    const out = await w.api({ method: 'GET', path: '/v1/web/vapid-key', query: new URLSearchParams() });
    assert.equal(out.status, 200);
    assert.deepEqual(out.body, { publicKey: 'vapid-pub-test' });
  });

  test('pendientes: se leen con la credencial y se borran al confirmar', async () => {
    const w = makeWorld();
    const reg = (
      await w.api({
        method: 'POST',
        path: '/v1/web/subscriptions',
        query: new URLSearchParams(),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      })
    ).body as { deviceId: string; secret: string };
    const dev = w.db.getDevice(reg.deviceId);
    assert.ok(dev);
    await w.runtime.dispatchTo(dev, PUSH);

    const auth = `Bearer ${reg.secret}`;
    const pending = await w.api({
      method: 'GET',
      path: `/v1/devices/${reg.deviceId}/pending`,
      query: new URLSearchParams(),
      authorization: auth,
    });
    assert.equal(pending.status, 200);
    const items = (pending.body as { items: PushData[] }).items;
    assert.equal(items.length, 1);
    assert.equal(items[0].eventId, 'ev-1');

    const ack = await w.api({
      method: 'POST',
      path: `/v1/devices/${reg.deviceId}/ack`,
      query: new URLSearchParams(),
      authorization: auth,
      body: JSON.stringify({ eventId: 'ev-1', action: 'alarm', receivedAt: T0 + 1000 }),
    });
    assert.equal(ack.status, 204);

    const after = await w.api({
      method: 'GET',
      path: `/v1/devices/${reg.deviceId}/pending`,
      query: new URLSearchParams(),
      authorization: auth,
    });
    assert.deepEqual((after.body as { items: PushData[] }).items, []);
  });

  test('pendientes sin credencial válida → 401', async () => {
    const w = makeWorld();
    const reg = (
      await w.api({
        method: 'POST',
        path: '/v1/web/subscriptions',
        query: new URLSearchParams(),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      })
    ).body as { deviceId: string };
    const out = await w.api({
      method: 'GET',
      path: `/v1/devices/${reg.deviceId}/pending`,
      query: new URLSearchParams(),
      authorization: 'Bearer incorrecto',
    });
    assert.equal(out.status, 401);
  });
});

describe('entrega al navegador (Runtime)', () => {
  test('a un dispositivo web se le envía el toque; a la app nativa no', async () => {
    const touched: string[] = [];
    const w = makeWorld({
      web: {
        async tickle(endpoint) {
          touched.push(endpoint);
          return 'ok';
        },
      },
    });
    const reg = (
      await w.api({
        method: 'POST',
        path: '/v1/web/subscriptions',
        query: new URLSearchParams(),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      })
    ).body as { deviceId: string };
    const app = (
      await w.api({ method: 'POST', path: '/v1/devices', query: new URLSearchParams(), body: '{}' })
    ).body as { deviceId?: string; id?: string };
    const appId = app.deviceId ?? app.id;
    assert.ok(appId, 'la API debe devolver el id del dispositivo app');

    await w.runtime.dispatchTo(w.db.getDevice(reg.deviceId)!, PUSH);
    await w.runtime.dispatchTo(w.db.getDevice(appId!)!, { ...PUSH, eventId: 'ev-2' });

    assert.deepEqual(touched, [ENDPOINT]);
  });

  test('si el navegador responde 410 (gone), el dispositivo se borra', async () => {
    const w = makeWorld({
      web: {
        async tickle() {
          return 'gone';
        },
      },
    });
    const reg = (
      await w.api({
        method: 'POST',
        path: '/v1/web/subscriptions',
        query: new URLSearchParams(),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      })
    ).body as { deviceId: string };
    await w.runtime.dispatchTo(w.db.getDevice(reg.deviceId)!, PUSH);
    assert.equal(w.db.getDevice(reg.deviceId), null);
  });

  test('el mismo aviso no se encola dos veces para el mismo navegador', async () => {
    const w = makeWorld({
      web: {
        async tickle() {
          return 'ok';
        },
      },
    });
    const reg = (
      await w.api({
        method: 'POST',
        path: '/v1/web/subscriptions',
        query: new URLSearchParams(),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      })
    ).body as { deviceId: string };
    const dev = w.db.getDevice(reg.deviceId)!;
    assert.equal(await w.runtime.dispatchTo(dev, PUSH), true);
    assert.equal(await w.runtime.dispatchTo(dev, PUSH), false);
    assert.equal(w.db.pendingFor(reg.deviceId, 0).length, 1);
  });
});

describe('página en vivo', () => {
  test('los clientes de /v1/live reciben los eventos difundidos', () => {
    const w = makeWorld();
    const conn = fakeConn();
    w.live.attach(conn);
    w.live.broadcast('quake', { id: 'ev-1', magnitude: 5.2 });
    assert.equal(conn.frames.length, 1);
    assert.match(conn.frames[0], /^event: quake\ndata: \{.*"magnitude":5\.2.*\}\n\n$/);
    w.live.detach(conn);
    w.live.broadcast('quake', { id: 'ev-2' });
    assert.equal(conn.frames.length, 1);
  });

  test('un cliente con error de escritura se elimina sin afectar a los demás', () => {
    const w = makeWorld();
    const bad = {
      write: () => {
        throw new Error('cerrado');
      },
      close: () => {},
    };
    const good = fakeConn();
    w.live.attach(bad);
    w.live.attach(good);
    w.live.broadcast('health', { ok: true });
    w.live.broadcast('health', { ok: true });
    assert.equal(w.live.size(), 1);
    assert.equal(good.frames.length, 2);
  });
});
