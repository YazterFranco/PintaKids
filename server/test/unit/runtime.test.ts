import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, T0, MIN, fakeConn } from '../helpers/world.ts';
import { Runtime, enParalelo } from '../../src/runtime.ts';
import type { Observation } from '../../src/types.ts';

const PC = { lat: 8.98, lon: -79.52 };

function igc(p: Partial<Observation> = {}): Observation {
  return {
    source: 'igc',
    sourceId: 'x1',
    originTime: T0,
    lat: 7.9,
    lon: -82.4,
    depthKm: 12,
    magnitude: 6.2,
    status: 'preliminar',
    region: 'Chiriquí',
    observedAt: T0,
    ...p,
  };
}

async function addDevice(w: ReturnType<typeof makeWorld>): Promise<string> {
  const r = await w.api({
    method: 'POST',
    path: '/v1/devices',
    query: new URLSearchParams(),
    body: JSON.stringify({ location: PC }),
  });
  return (r.body as { deviceId: string }).deviceId;
}

test('un sismo fuerte cercano envía alarma una sola vez por dispositivo', async () => {
  const w = makeWorld();
  await addDevice(w);
  await w.runtime.ingestObservations([igc()]);
  w.advance(MIN);
  await w.runtime.ingestObservations([igc()]);
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].data.action, 'alarm');
  assert.equal(w.sent[0].data.level, 'critical');
  assert.match(w.sent[0].data.body, /de su ubicación/);
});

test('un teléfono desconectado recibe el aviso en cola; al conectarse llega', async () => {
  const w = makeWorld();
  const id = await addDevice(w);
  await w.runtime.ingestObservations([igc()]);
  assert.equal(w.hub.isOnline(id), false);
  assert.equal(w.db.pendingFor(id, 0).length, 1);
  const conn = fakeConn();
  w.hub.attach(id, conn, w.now());
  assert.match(conn.frames.join(''), /"action":"alarm"/);
});

test('no se repite tras reiniciar el servidor (estado y entregas persistidos)', async () => {
  const w = makeWorld();
  await addDevice(w);
  await w.runtime.ingestObservations([igc()]);
  assert.equal(w.sent.length, 1);
  const restarted = new Runtime(w.db, w.hub, w.now);
  await restarted.ingestObservations([igc()]);
  assert.equal(w.sent.length, 1, 'no debe volver a encolar el mismo evento');
});

test('corrección: magnitud que cambia ≥0.3 envía update al mismo evento', async () => {
  const w = makeWorld();
  await addDevice(w);
  const near = { lat: 8.7, lon: -79.5 };
  await w.runtime.ingestObservations([igc({ ...near, magnitude: 5.2, region: 'Cerca' })]);
  w.advance(MIN);
  await w.runtime.ingestObservations([igc({ ...near, magnitude: 5.6, region: 'Cerca' })]);
  assert.equal(w.sent.length, 2);
  assert.equal(w.sent[1].data.action, 'update');
  assert.equal(w.sent[0].data.eventId, w.sent[1].data.eventId);
});

test('fusión: IGC y USGS del mismo sismo producen una alarma y luego solo un cambio silencioso', async () => {
  const w = makeWorld();
  await addDevice(w);
  await w.runtime.ingestObservations([igc({ sourceId: 'ig', magnitude: 6.2 })]);
  w.advance(MIN);
  await w.runtime.ingestObservations([
    igc({ source: 'usgs', sourceId: 'us', originTime: T0 + 8000, lat: 7.92, lon: -82.38, magnitude: 6.4, status: 'revisado' }),
  ]);
  assert.equal(w.runtime.events.size, 1);
  assert.deepEqual(
    w.sent.map((s) => s.data.action),
    ['alarm', 'silent'],
  );
});

test('watchdog: avisa una vez al quedar sin datos y otra al recuperarse', async () => {
  const w = makeWorld();
  await addDevice(w);
  w.advance(11 * MIN);
  await w.runtime.tick();
  await w.runtime.tick();
  assert.equal(w.sent.filter((s) => s.data.eventId.startsWith('system-sin-datos')).length, 1);

  w.runtime.markOk('igc', 0);
  w.advance(MIN);
  await w.runtime.tick();
  assert.equal(w.sent.filter((s) => s.data.eventId.startsWith('system-restablecido')).length, 1);
});

test('resumen: sismos informativos se agrupan y se envían al cumplirse digestMinutes', async () => {
  const w = makeWorld();
  await addDevice(w);
  w.runtime.markOk('usgs', 0);
  await w.runtime.ingestObservations([igc({ sourceId: 'i1', magnitude: 4.2, lat: 8.4, lon: -82.4 })]);
  assert.equal(w.sent.length, 0, 'no envía individualmente');
  w.advance(10 * MIN);
  w.runtime.markOk('usgs', 0);
  await w.runtime.tick();
  assert.equal(w.sent.length, 0, 'antes de digestMinutes no envía');
  w.advance(21 * MIN);
  w.runtime.markOk('usgs', 0);
  await w.runtime.tick();
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].data.type, 'digest');
});

test('evento viejo no dispara alarma aunque sea fuerte (solo informa)', async () => {
  const w = makeWorld();
  await addDevice(w);
  w.advance(2 * 3600_000);
  await w.runtime.ingestObservations([igc({ sourceId: 'old', lat: 8.7, lon: -79.5, magnitude: 5.8 })]);
  assert.equal(w.sent[0].data.action, 'info');
});

test('arranque: los eventos guardados se recargan desde la base', async () => {
  const w = makeWorld();
  await w.runtime.ingestObservations([igc({ sourceId: 'persist' })]);
  const second = new Runtime(w.db, w.hub, w.now);
  assert.equal(second.events.size, 1);
});

test('enParalelo: respeta el tope de concurrencia y procesa todos los ítems', async () => {
  let activos = 0;
  let maxActivos = 0;
  let total = 0;
  const items = Array.from({ length: 25 }, (_, i) => i);
  await enParalelo(items, 8, async (i) => {
    activos++;
    maxActivos = Math.max(maxActivos, activos);
    await new Promise((r) => setTimeout(r, 1));
    activos--;
    total++;
    if (i === 3) throw new Error('fallo simulado');
  });
  assert.equal(total, 25, 'un fallo no debe abortar el resto');
  assert.ok(maxActivos <= 8, `concurrencia ${maxActivos} excede el tope 8`);
  assert.ok(maxActivos >= 2, 'debe ejecutarse en paralelo, no secuencial');
});

test('fan-out: un sismo llega a todos los navegadores y el toque es concurrente', async () => {
  let picos = 0;
  let activos = 0;
  let tocados = 0;
  const web = {
    async tickle() {
      activos++;
      picos = Math.max(picos, activos);
      await new Promise((r) => setTimeout(r, 2));
      activos--;
      tocados++;
      return 'ok' as const;
    },
  };
  const w = makeWorld({ web });
  for (let i = 0; i < 10; i++) {
    await w.api({
      method: 'POST',
      path: '/v1/web/subscriptions',
      query: new URLSearchParams(),
      body: JSON.stringify({ endpoint: `https://fcm.googleapis.com/fcm/send/nav${i}`, location: { lat: 8.98, lon: -79.52 } }),
    });
  }
  await w.runtime.ingestObservations([igc({ sourceId: 'fanout', lat: 8.98, lon: -79.52, magnitude: 6.2 })]);
  assert.equal(tocados, 10, 'cada navegador recibe su toque');
  assert.equal(w.sent.length, 10);
  assert.ok(picos >= 2, `el fan-out no fue concurrente (pico=${picos})`);
  assert.ok(picos <= 8, `concurrencia ${picos} supera el tope 8`);
});
