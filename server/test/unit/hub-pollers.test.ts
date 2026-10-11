import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, T0, fakeConn } from '../helpers/world.ts';
import { pollOnce } from '../../src/pollers.ts';
import { parseIgcHtml } from '../../src/sources/igc.ts';
import { parseUsgsFeed } from '../../src/sources/usgs.ts';
import { IGC_SAMPLE_HTML, NO_TABLE_HTML } from '../helpers/igcHtml.ts';
import { OUTBOX_TTL_MS } from '../../src/config.ts';
import { DEFAULT_SETTINGS as DEFAULTS, emptyState } from '../../src/policy.ts';

const data = (id: string, action = 'alarm') => ({ type: 'quake', action, level: 'critical', eventId: id, title: 't', body: 'b' });

test('canal: publicar con conexión entrega de inmediato; sin conexión queda en cola', () => {
  const w = makeWorld();
  w.db.insertDevice({ id: 'd_a', secretHash: 'h', settings: DEFAULTS, state: emptyState(T0), now: T0 });
  const conn = fakeConn();
  w.hub.attach('d_a', conn, T0);
  w.hub.publish('d_a', data('e1') as never, T0);
  assert.equal(conn.frames.length, 1);
  assert.match(conn.frames[0], /^id: \d+\nevent: push\ndata: \{/);
  w.hub.detach('d_a', conn);
  w.hub.publish('d_a', data('e2') as never, T0 + 1000);
  assert.equal(w.db.pendingFor('d_a', 0).length, 2);
});

test('canal: al reconectar se reenvían solo los avisos que no caducaron', () => {
  const w = makeWorld();
  w.db.insertDevice({ id: 'd_b', secretHash: 'h', settings: DEFAULTS, state: emptyState(T0), now: T0 });
  w.hub.publish('d_b', data('viejo') as never, T0 - OUTBOX_TTL_MS - 60_000);
  w.hub.publish('d_b', data('reciente') as never, T0);
  const conn = fakeConn();
  w.hub.attach('d_b', conn, T0 + 1000);
  const text = conn.frames.join('');
  assert.match(text, /reciente/);
  assert.doesNotMatch(text, /viejo/);
});

test('canal: el ack saca el aviso de la cola (no vuelve a llegar)', async () => {
  const w = makeWorld();
  w.db.insertDevice({ id: 'd_c', secretHash: 'h', settings: DEFAULTS, state: emptyState(T0), now: T0 });
  w.hub.publish('d_c', data('e9') as never, T0);
  w.db.removeOutbox('d_c', 'e9', 'alarm');
  const conn = fakeConn();
  w.hub.attach('d_c', conn, T0);
  assert.equal(conn.frames.length, 0);
});

test('canal: latido envía comentario SSE a todas las conexiones abiertas', () => {
  const w = makeWorld();
  w.db.insertDevice({ id: 'd_h', secretHash: 'h', settings: DEFAULTS, state: emptyState(T0), now: T0 });
  const conn = fakeConn();
  w.hub.attach('d_h', conn, T0);
  w.hub.heartbeat();
  assert.match(conn.frames.join(''), /: latido/);
});

test('sondeo IGC: HTML válido ingiere sismos y marca la fuente sana', async () => {
  const w = makeWorld();
  await pollOnce({
    name: 'igc',
    url: 'https://example.test/igc',
    runtime: w.runtime,
    parse: (t, now) => parseIgcHtml(t, now),
    fetchFn: async () => new Response(IGC_SAMPLE_HTML, { status: 200 }),
  });
  assert.equal(w.runtime.events.size, 2);
  assert.equal(w.runtime.health.igc.ok, true);
  assert.equal(w.runtime.health.igc.lastCount, 2);
});

test('sondeo IGC: si cambia el formato NO inventa datos y marca error', async () => {
  const w = makeWorld();
  await pollOnce({
    name: 'igc',
    url: 'https://example.test/igc',
    runtime: w.runtime,
    parse: (t, now) => parseIgcHtml(t, now),
    fetchFn: async () => new Response(NO_TABLE_HTML, { status: 200 }),
  });
  assert.equal(w.runtime.events.size, 0);
  assert.equal(w.runtime.health.igc.ok, false);
  assert.match(w.runtime.health.igc.lastError ?? '', /no se encontró la tabla/);
});

test('sondeo: HTTP 500 queda como error de la fuente', async () => {
  const w = makeWorld();
  await pollOnce({
    name: 'usgs',
    url: 'https://example.test/usgs',
    runtime: w.runtime,
    parse: (t, now) => parseUsgsFeed(JSON.parse(t), now),
    fetchFn: async () => new Response('boom', { status: 500 }),
  });
  assert.equal(w.runtime.health.usgs.ok, false);
  assert.equal(w.runtime.health.usgs.lastError, 'HTTP 500');
});

test('sondeo USGS: GeoJSON válido se ingiere', async () => {
  const w = makeWorld();
  const feed = {
    features: [
      {
        id: 'us1',
        properties: { mag: 5.1, time: T0 - 60_000, place: 'Bocas del Toro', status: 'automatic' },
        geometry: { coordinates: [-82.2, 9.0, 12.5] },
      },
    ],
  };
  await pollOnce({
    name: 'usgs',
    url: 'https://example.test/usgs',
    runtime: w.runtime,
    parse: (t, now) => parseUsgsFeed(JSON.parse(t), now),
    fetchFn: async () => new Response(JSON.stringify(feed), { status: 200 }),
  });
  assert.equal(w.runtime.events.size, 1);
  assert.equal(w.runtime.health.usgs.ok, true);
});
