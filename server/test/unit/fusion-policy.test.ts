import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest, prune } from '../../src/fusion.ts';
import {
  DEFAULT_SETTINGS,
  decideForEvent,
  emptyState,
  takeDigest,
  validateSettings,
} from '../../src/policy.ts';
import { quakeMessage, digestMessage, systemMessage } from '../../src/messages.ts';
import type { Observation, QuakeEvent } from '../../src/types.ts';

const T0 = Date.UTC(2026, 9, 9, 17, 0, 0);
const MIN = 60_000;
const PANAMA_CITY = { lat: 8.98, lon: -79.52 };
const NEAR = { lat: 8.7, lon: -79.5 }; // ~31 km de Ciudad de Panamá
const MID = { lat: 7.9, lon: -79.5 }; // ~120 km
const FAR = { lat: 8.4, lon: -82.4 }; // ~330 km (Chiriquí)

let seq = 0;
function quake(p: Partial<QuakeEvent> = {}): QuakeEvent {
  seq++;
  return {
    id: `q-test-${seq}`,
    originTime: T0,
    lat: NEAR.lat,
    lon: NEAR.lon,
    depthKm: 10,
    magnitude: 5.0,
    magMin: 5.0,
    magMax: 5.0,
    status: 'preliminar',
    region: 'Prueba',
    source: 'igc',
    updatedAt: T0,
    firstSeenAt: T0,
    sources: {},
    ...p,
  };
}

function obs(p: Partial<Observation>): Observation {
  return {
    source: 'igc',
    sourceId: 'a',
    originTime: T0,
    lat: NEAR.lat,
    lon: NEAR.lon,
    depthKm: 10,
    magnitude: 5.0,
    status: 'preliminar',
    region: 'Prueba',
    observedAt: T0,
    ...p,
  };
}

// ---------- Fusión ----------

test('fusión: IGC y USGS del mismo sismo (≤30 s, ≤50 km) forman un solo evento', () => {
  const events = new Map<string, QuakeEvent>();
  const a = ingest(events, obs({ source: 'igc', sourceId: 'ig1', magnitude: 5.4, status: 'preliminar' }), T0);
  const b = ingest(
    events,
    obs({ source: 'usgs', sourceId: 'us1', originTime: T0 + 10_000, lat: 8.75, lon: -79.45, magnitude: 5.6, status: 'revisado' }),
    T0 + MIN,
  );
  assert.equal(events.size, 1);
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false);
  assert.equal(b.event.source, 'igc', 'la fuente principal es IGC');
  assert.equal(b.event.magnitude, 5.4, 'magnitud principal = IGC');
  assert.equal(b.event.magMin, 5.4);
  assert.equal(b.event.magMax, 5.6);
  assert.equal(b.event.status, 'revisado', 'basta que una fuente lo revise');
});

test('fusión: fuera de ventana (60 s) o de distancia (≥100 km) son eventos distintos', () => {
  const events = new Map<string, QuakeEvent>();
  ingest(events, obs({ source: 'igc', sourceId: 'a' }), T0);
  ingest(events, obs({ source: 'usgs', sourceId: 'b', originTime: T0 + 60_000 }), T0);
  ingest(events, obs({ source: 'emsc', sourceId: 'c', lat: MID.lat, lon: MID.lon }), T0);
  assert.equal(events.size, 3);
});

test('fusión: misma observación repetida no marca cambio; un cambio sí', () => {
  const events = new Map<string, QuakeEvent>();
  ingest(events, obs({ sourceId: 'a', magnitude: 5.0 }), T0);
  const same = ingest(events, obs({ sourceId: 'a', magnitude: 5.0 }), T0 + MIN);
  assert.equal(same.changed, false);
  const diff = ingest(events, obs({ sourceId: 'a', magnitude: 5.3 }), T0 + 2 * MIN);
  assert.equal(diff.changed, true);
  assert.equal(diff.event.magnitude, 5.3);
});

test('fusión: prune elimina eventos fuera de la retención', () => {
  const events = new Map<string, QuakeEvent>();
  ingest(events, obs({ sourceId: 'old', originTime: T0 - 8 * 86_400_000 }), T0);
  ingest(events, obs({ sourceId: 'new' }), T0);
  assert.equal(prune(events, T0), 1);
  assert.equal(events.size, 1);
});

// ---------- Política ----------

test('política: M6.2 lejano = crítico (alarma) una sola vez; nunca se repite', () => {
  const st = emptyState(T0);
  const e = quake({ magnitude: 6.2, magMin: 6.2, magMax: 6.2, lat: FAR.lat, lon: FAR.lon });
  const first = decideForEvent(e, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + MIN);
  assert.deepEqual(first && [first.action, first.level], ['alarm', 'critical']);
  assert.equal(decideForEvent(e, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + 2 * MIN), null);
});

test('política: M5.2 a 31 km = crítico cercano; M5.2 a 120 km = importante', () => {
  const near = decideForEvent(quake({ magnitude: 5.2 }), DEFAULT_SETTINGS, PANAMA_CITY, emptyState(T0), T0 + MIN);
  assert.equal(near?.level, 'critical');
  const mid = decideForEvent(
    quake({ magnitude: 5.2, lat: MID.lat, lon: MID.lon }),
    DEFAULT_SETTINGS,
    PANAMA_CITY,
    emptyState(T0),
    T0 + MIN,
  );
  assert.equal(mid?.level, 'important');
  assert.equal(mid?.action, 'notify');
});

test('política: límite de importantes por hora degrada a info', () => {
  const st = emptyState(T0);
  const actions: string[] = [];
  for (let i = 0; i < 4; i++) {
    const d = decideForEvent(
      quake({ id: `imp-${i}`, magnitude: 4.6, lat: MID.lat, lon: MID.lon }),
      DEFAULT_SETTINGS,
      PANAMA_CITY,
      st,
      T0 + MIN + i * 1000,
    );
    actions.push(d?.action ?? 'none');
  }
  assert.deepEqual(actions, ['notify', 'notify', 'notify', 'info']);
  // Pasada una hora, vuelve a notificar.
  const later = decideForEvent(
    quake({ id: 'imp-later', originTime: T0 + 60 * MIN, magnitude: 4.6, lat: MID.lat, lon: MID.lon }),
    DEFAULT_SETTINGS,
    PANAMA_CITY,
    st,
    T0 + 61 * MIN,
  );
  assert.equal(later?.action, 'notify');
});

test('política: informativo va al resumen, no a notificación individual', () => {
  const st = emptyState(T0);
  const d = decideForEvent(quake({ magnitude: 4.2, lat: FAR.lat, lon: FAR.lon }), DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + MIN);
  assert.equal(d, null);
  assert.equal(takeDigest(st, DEFAULT_SETTINGS, T0 + 10 * MIN), null, 'antes de digestMinutes no envía');
  const ids = takeDigest(st, DEFAULT_SETTINGS, T0 + 31 * MIN);
  assert.equal(ids?.length, 1);
  assert.equal(st.digestQueue.length, 0);
});

test('política: evento viejo (>30 min) solo informa aunque sea crítico', () => {
  const d = decideForEvent(
    quake({ magnitude: 5.5, originTime: T0 - 2 * 3600_000 }),
    DEFAULT_SETTINGS,
    PANAMA_CITY,
    emptyState(T0),
    T0,
  );
  assert.equal(d?.action, 'info');
});

test('política: corrección solo si la magnitud cambia ≥0.3; cambios menores no notifican', () => {
  const st = emptyState(T0);
  const e = quake({ id: 'corr', magnitude: 5.2, magMin: 5.2, magMax: 5.2 });
  decideForEvent(e, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + MIN);

  const small = decideForEvent({ ...e, magnitude: 5.4 }, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + 2 * MIN);
  assert.equal(small, null);

  const big = decideForEvent({ ...e, magnitude: 5.6 }, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + 3 * MIN);
  assert.equal(big?.action, 'update');
  assert.equal(big?.correction, true);

  const again = decideForEvent({ ...e, magnitude: 5.6 }, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + 4 * MIN);
  assert.equal(again, null);
});

test('política: cambio solo de estado = silent (lista local, sin sonido)', () => {
  const st = emptyState(T0);
  const e = quake({ id: 'st', magnitude: 5.2 });
  decideForEvent(e, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + MIN);
  const d = decideForEvent({ ...e, status: 'revisado' }, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + 2 * MIN);
  assert.equal(d?.action, 'silent');
});

test('política: escalada de informativo a crítico notifica con alarma', () => {
  const st = emptyState(T0);
  const e = quake({ id: 'esc', magnitude: 4.2, lat: FAR.lat, lon: FAR.lon });
  decideForEvent(e, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + MIN);
  const d = decideForEvent({ ...e, magnitude: 6.3, magMin: 6.3, magMax: 6.3 }, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + 2 * MIN);
  assert.equal(d?.action, 'alarm');
  assert.equal(d?.level, 'critical');
});

test('política: evento que baja de umbral y cambió mucho envía corrección', () => {
  const st = emptyState(T0);
  const e = quake({ id: 'down', magnitude: 6.2, lat: FAR.lat, lon: FAR.lon });
  decideForEvent(e, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + MIN);
  const d = decideForEvent({ ...e, magnitude: 3.9 }, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + 2 * MIN);
  assert.equal(d?.action, 'update');
});

test('ajustes: rangos del contrato, campos desconocidos y null para apagar informativo', () => {
  assert.equal(validateSettings(undefined).ok, true);
  const ok = validateSettings({ informativeMag: null, digestMinutes: 45.4 });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.informativeMag, null);
    assert.equal(ok.value.digestMinutes, 45);
    assert.equal(ok.value.criticalRegionalMag, 6.0, 'los que faltan toman el valor por defecto');
  }
  const bad = validateSettings({ criticalRegionalMag: 3, importantKm: 5000, extra: 1 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 3);
  assert.equal(validateSettings('x').ok, false);
});

// ---------- Mensajes ----------

test('mensajes: todos los valores del push son strings y van con el contrato', () => {
  const e = quake({ magnitude: 5.4, magMin: 5.4, magMax: 5.6, region: 'Tonosí', depthKm: 18, source: 'igc' });
  const m = quakeMessage(e, { action: 'alarm', level: 'critical', now: T0 + MIN, loc: PANAMA_CITY });
  for (const [k, v] of Object.entries(m)) assert.equal(typeof v, 'string', `clave ${k}`);
  assert.equal(m.type, 'quake');
  assert.equal(m.action, 'alarm');
  assert.equal(m.eventId, e.id);
  assert.match(m.body, /hora de Panamá/);
  assert.match(m.body, /A \d+ km \w+ de su ubicación/);
  assert.equal(m.title, 'Sismo fuerte M5.4–5.6');
  assert.equal(m.drill, undefined);
});

test('mensajes: simulacro lleva drill=1 y tipo drill; la app antepone SIMULACRO', () => {
  const m = quakeMessage(quake(), { action: 'alarm', level: 'critical', now: T0, drill: true });
  assert.equal(m.drill, '1');
  assert.equal(m.type, 'drill');
  assert.doesNotMatch(m.title, /SIMULACRO/);
});

test('mensajes: resumen y aviso de sistema tienen eventId único y acción info', () => {
  const d = digestMessage([quake({ magnitude: 4.2 }), quake({ magnitude: 4.6 })], T0);
  assert.equal(d.action, 'info');
  assert.equal(d.eventId, `digest-${T0}`);
  assert.match(d.body, /M4\.6/);
  const s = systemMessage('watchdog', 'Sin datos', 'Ninguna fuente respondió', T0);
  assert.equal(s.type, 'system');
  assert.equal(s.action, 'info');
});

// ---------- Secuencias de réplicas ----------
test('secuencia: un sismo menor tras uno mayor cerca y después se marca como réplica', () => {
  const events = new Map<string, QuakeEvent>();
  const main = ingest(events, obs({ sourceId: 'main', magnitude: 6.5, lat: 7.5, lon: -80.4 }), T0);
  const aft = ingest(events, obs({ sourceId: 'aft', magnitude: 5.2, lat: 7.6, lon: -80.3, originTime: T0 + 2 * 3600_000, observedAt: T0 + 2 * 3600_000 }), T0 + 2 * 3600_000);
  assert.equal(aft.event.aftershockOf, main.event.id, 'debe quedar ligada al principal');
  // Un evento más grande que el principal NO es réplica de él.
  const bigger = ingest(events, obs({ sourceId: 'big', magnitude: 7.0, lat: 7.5, lon: -80.4, originTime: T0 + 3 * 3600_000, observedAt: T0 + 3 * 3600_000 }), T0 + 3 * 3600_000);
  assert.equal(bigger.event.aftershockOf, undefined);
  // Lejos (Chiriquí) no se liga al principal de Azuero.
  const far = ingest(events, obs({ sourceId: 'far', magnitude: 4.5, lat: 8.4, lon: -82.4, originTime: T0 + 4 * 3600_000, observedAt: T0 + 4 * 3600_000 }), T0 + 4 * 3600_000);
  assert.equal(far.event.aftershockOf, undefined);
});

test('mensaje: una réplica se titula "Réplica" y avisa del principal', () => {
  const e = quake({ magnitude: 5.2, aftershockOf: 'q-principal' });
  const m = quakeMessage(e, { action: 'notify', level: 'important', now: T0 });
  assert.match(m.title, /^Réplica/);
  assert.equal(m.aftershockOf, 'q-principal');
});

test('política: corregir la magnitud de un evento ya avisado dispara un aviso de corrección', () => {
  const st = emptyState(T0);
  const first = quake({ id: 'corr', magnitude: 4.6 });
  const d1 = decideForEvent(first, DEFAULT_SETTINGS, PANAMA_CITY, st, T0);
  assert.equal(d1?.action, 'notify');
  // Sube a 4.9 (delta 0.3 ≥ umbral, sigue siendo "importante"): debe llegar una corrección.
  const upd = quake({ id: 'corr', magnitude: 4.9 });
  const d2 = decideForEvent(upd, DEFAULT_SETTINGS, PANAMA_CITY, st, T0 + MIN);
  assert.equal(d2?.action, 'update');
  assert.equal(d2?.correction, true);
});
