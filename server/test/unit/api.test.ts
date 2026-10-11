import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, T0, MIN, fakeConn } from '../helpers/world.ts';
import type { ApiRequest } from '../../src/api.ts';
import type { Observation } from '../../src/types.ts';

const json = (body: unknown) => JSON.stringify(body);
const auth = (secret: string): string => `Bearer ${secret}`;
const req = (p: Partial<ApiRequest> & { path: string; method: string }): ApiRequest => ({
  query: new URLSearchParams(),
  ...p,
});

async function register(w: ReturnType<typeof makeWorld>, body: unknown = { location: { lat: 8.98, lon: -79.52 } }) {
  const r = await w.api(req({ method: 'POST', path: '/v1/devices', body: json(body) }));
  assert.equal(r.status, 201);
  return r.body as { deviceId: string; secret: string; settings: Record<string, unknown> };
}

test('registro: 201 con id, secreto y ajustes por defecto; ubicación redondeada a 0.05°', async () => {
  const w = makeWorld();
  const d = await register(w, { location: { lat: 8.123, lon: -79.577 } });
  assert.match(d.deviceId, /^d_/);
  assert.ok(d.secret.length >= 40);
  assert.equal(d.settings.criticalRegionalMag, 6);
  const row = w.db.getDevice(d.deviceId);
  assert.equal(row?.lat, 8.1);
  assert.equal(row?.lon, -79.6);
  assert.notEqual(row?.secretHash, d.secret, 'el secreto nunca se guarda en claro');
});

test('registro: 400 con ajustes fuera de rango o JSON inválido', async () => {
  const w = makeWorld();
  assert.equal((await w.api(req({ method: 'POST', path: '/v1/devices', body: json({ settings: { criticalRegionalMag: 42 } }) }))).status, 400);
  assert.equal((await w.api(req({ method: 'POST', path: '/v1/devices', body: '{roto' }))).status, 400);
});

test('actualizar: exige secreto válido (401) y fusiona ajustes parciales', async () => {
  const w = makeWorld();
  const d = await register(w);
  const path = `/v1/devices/${d.deviceId}`;
  assert.equal((await w.api(req({ method: 'PUT', path, body: json({}) }))).status, 401);
  assert.equal((await w.api(req({ method: 'PUT', path, authorization: auth('mal'), body: json({}) }))).status, 401);
  assert.equal((await w.api(req({ method: 'PUT', path: '/v1/devices/no-existe', authorization: auth(d.secret), body: json({}) }))).status, 401);

  const ok = await w.api(req({ method: 'PUT', path, authorization: auth(d.secret), body: json({ settings: { importantKm: 200 } }) }));
  assert.equal(ok.status, 200);
  const s = (ok.body as { settings: Record<string, unknown> }).settings;
  assert.equal(s.importantKm, 200);
  assert.equal(s.criticalRegionalMag, 6, 'lo no enviado conserva su valor');
});

test('actualizar: ajustes fuera de rango responden 400 y no se guardan', async () => {
  const w = makeWorld();
  const d = await register(w);
  const r = await w.api(req({ method: 'PUT', path: `/v1/devices/${d.deviceId}`, authorization: auth(d.secret), body: json({ settings: { digestMinutes: 1 } }) }));
  assert.equal(r.status, 400);
  assert.equal(w.db.getDevice(d.deviceId)?.settings.digestMinutes, 30);
});

test('ubicación: null la borra; la nueva se redondea', async () => {
  const w = makeWorld();
  const d = await register(w);
  const path = `/v1/devices/${d.deviceId}`;
  await w.api(req({ method: 'PUT', path, authorization: auth(d.secret), body: json({ location: { lat: 9.01, lon: -79.49 } }) }));
  assert.equal(w.db.getDevice(d.deviceId)?.lat, 9.0);
  await w.api(req({ method: 'PUT', path, authorization: auth(d.secret), body: json({ location: null }) }));
  assert.equal(w.db.getDevice(d.deviceId)?.lat, null);
});

test('simulacro: 202 y alarma de prueba marcada como simulacro; 429 dentro de 60 s', async () => {
  const w = makeWorld();
  const d = await register(w);
  const path = `/v1/devices/${d.deviceId}/drill`;
  const first = await w.api(req({ method: 'POST', path, authorization: auth(d.secret) }));
  assert.equal(first.status, 202);
  assert.deepEqual(first.body, { sent: true, online: false });
  assert.equal(w.sent.length, 1);
  const data = w.sent[0].data;
  assert.equal(data.drill, '1');
  assert.equal(data.action, 'alarm');
  assert.equal(data.type, 'drill');

  w.advance(30_000);
  assert.equal((await w.api(req({ method: 'POST', path, authorization: auth(d.secret) }))).status, 429);
  w.advance(31_000);
  assert.equal((await w.api(req({ method: 'POST', path, authorization: auth(d.secret) }))).status, 202);
});

test('simulacro con la app desconectada se entrega al reconectarse', async () => {
  const w = makeWorld();
  const d = await register(w);
  await w.api(req({ method: 'POST', path: `/v1/devices/${d.deviceId}/drill`, authorization: auth(d.secret) }));
  const conn = fakeConn();
  w.hub.attach(d.deviceId, conn, w.now());
  const frames = conn.frames.join('');
  assert.match(frames, /event: push/);
  assert.match(frames, /"drill":"1"/);
});

test('acuse: 204, quita el aviso de la cola y deja la latencia en las estadísticas', async () => {
  const w = makeWorld();
  const d = await register(w);
  await w.api(req({ method: 'POST', path: `/v1/devices/${d.deviceId}/drill`, authorization: auth(d.secret) }));
  const eventId = w.sent[0].data.eventId;
  assert.equal(w.db.pendingFor(d.deviceId, 0).length, 1);
  const ack = await w.api(
    req({
      method: 'POST',
      path: `/v1/devices/${d.deviceId}/ack`,
      authorization: auth(d.secret),
      body: json({ eventId, action: 'alarm', receivedAt: w.now() + 2300 }),
    }),
  );
  assert.equal(ack.status, 204);
  assert.equal(w.db.pendingFor(d.deviceId, 0).length, 0);
  const stats = await w.api(req({ method: 'GET', path: '/v1/admin/latency', authorization: 'Bearer admin-secret' }));
  const body = stats.body as { count: number; p50Ms: number };
  assert.equal(body.count, 1);
  assert.equal(body.p50Ms, 2300);
});

test('estadísticas de latencia exigen token de administración', async () => {
  const w = makeWorld();
  assert.equal((await w.api(req({ method: 'GET', path: '/v1/admin/latency' }))).status, 401);
  assert.equal((await w.api(req({ method: 'GET', path: '/v1/admin/latency', authorization: 'Bearer otro' }))).status, 401);
});

test('eventos: listado público sin campos internos, ordenado y con límite', async () => {
  const w = makeWorld();
  const o = (id: string, t: number): Observation => ({
    source: 'igc',
    sourceId: id,
    originTime: t,
    lat: 8.5,
    lon: -79.5,
    depthKm: 10,
    magnitude: 3.1,
    status: 'preliminar',
    region: `Evento ${id}`,
    observedAt: t,
  });
  await w.runtime.ingestObservations([o('a', T0 - 10 * MIN), o('b', T0 - 5 * MIN)]);
  const r = await w.api(req({ method: 'GET', path: '/v1/events', query: new URLSearchParams('limit=1') }));
  const body = r.body as { events: Array<Record<string, unknown>> };
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].region, 'Evento b');
  assert.equal('sources' in body.events[0], false);
});

test('guía, salud y rutas desconocidas', async () => {
  const w = makeWorld();
  assert.deepEqual((await w.api(req({ method: 'GET', path: '/v1/guide' }))).body, { version: 1, sections: [] });
  const h = (await w.api(req({ method: 'GET', path: '/v1/health' }))).body as { sources: Record<string, unknown>; devicesOnline: number };
  assert.ok('igc' in h.sources && 'usgs' in h.sources && 'emsc' in h.sources);
  assert.equal(h.devicesOnline, 0);
  assert.equal((await w.api(req({ method: 'GET', path: '/v1/nada' }))).status, 404);
});

test('borrar dispositivo: 204 y ya no puede autenticarse', async () => {
  const w = makeWorld();
  const d = await register(w);
  assert.equal((await w.api(req({ method: 'DELETE', path: `/v1/devices/${d.deviceId}`, authorization: auth(d.secret) }))).status, 204);
  assert.equal(w.db.getDevice(d.deviceId), null);
});

const feelObs = (id: string) => ({
  source: 'igc' as const, sourceId: id, originTime: T0, lat: 8.6, lon: -79.5,
  depthKm: 10, magnitude: 5.5, status: 'preliminar' as const, region: 'Panamá', observedAt: T0,
});

async function eventIdFor(w: ReturnType<typeof makeWorld>, id: string): Promise<string> {
  await w.runtime.ingestObservations([feelObs(id)]);
  return [...w.runtime.events.keys()][0];
}

test('lo sentí: valida, redondea ubicación, deduplica por celda y agrega', async () => {
  const w = makeWorld();
  const eventId = await eventIdFor(w, 'feel-1');
  const body = (lat: number, lon: number, intensity: number) =>
    json({ eventId, location: { lat, lon }, intensity });

  let r = await w.api(req({ method: 'POST', path: '/v1/feels', body: body(8.982, -79.519, 2) }));
  assert.equal(r.status, 200);
  assert.equal((r.body as { nuevo: boolean }).nuevo, true);

  // Misma celda redondeada (0.05°) → no cuenta dos veces.
  r = await w.api(req({ method: 'POST', path: '/v1/feels', body: body(8.984, -79.521, 3) }));
  assert.equal((r.body as { nuevo: boolean }).nuevo, false);

  // Otra celda sí cuenta.
  r = await w.api(req({ method: 'POST', path: '/v1/feels', body: body(9.1, -79.4, 1) }));
  assert.equal((r.body as { nuevo: boolean }).nuevo, true);

  r = await w.api(req({ method: 'GET', path: '/v1/feels', query: new URLSearchParams({ event: eventId }) }));
  const feels = r.body as { total: number; counts: number[] };
  assert.equal(feels.total, 2);
  assert.equal(feels.counts[1], 1, 'un reporte de "fuerte"');
  assert.equal(feels.counts[0], 1, 'un reporte de "leve"');

  // Validaciones.
  r = await w.api(req({ method: 'POST', path: '/v1/feels', body: json({ eventId, location: { lat: 8.9, lon: -79.5 }, intensity: 9 }) }));
  assert.equal(r.status, 400);
  r = await w.api(req({ method: 'POST', path: '/v1/feels', body: json({ eventId: 'no-existe', location: { lat: 8.9, lon: -79.5 }, intensity: 1 }) }));
  assert.equal(r.status, 404);
});
