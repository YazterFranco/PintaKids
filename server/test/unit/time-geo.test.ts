import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panamaLocalToEpoch, formatPanamaTime } from '../../src/time.ts';
import { haversineKm, bearingDeg, bearingName, roundLocation, validCoords } from '../../src/geo.ts';

test('12:56:05PM en Panamá equivale a 17:56:05 UTC (UTC-5 fijo)', () => {
  assert.equal(panamaLocalToEpoch('2026-10-09', '12:56:05PM'), Date.UTC(2026, 9, 9, 17, 56, 5));
});

test('12:30 AM local es 05:30 UTC', () => {
  assert.equal(panamaLocalToEpoch('2026-10-09', '12:30:00AM'), Date.UTC(2026, 9, 9, 5, 30, 0));
});

test('7:51:44 PM local cae en el día siguiente en UTC', () => {
  assert.equal(panamaLocalToEpoch('2026-10-09', '7:51:44 PM'), Date.UTC(2026, 9, 10, 0, 51, 44));
});

test('rechaza horas y fechas inválidas', () => {
  assert.equal(panamaLocalToEpoch('2026-10-09', '13:00PM'), null);
  assert.equal(panamaLocalToEpoch('2026-10-09', '12:61:00'), null);
  assert.equal(panamaLocalToEpoch('2026-10-09', 'abc'), null);
  assert.equal(panamaLocalToEpoch('09/10/2026', '12:00PM'), null);
});

test('formatea hora de Panamá en 12 h', () => {
  assert.equal(formatPanamaTime(Date.UTC(2026, 9, 9, 17, 6, 5)), '12:06 p. m.');
  assert.equal(formatPanamaTime(Date.UTC(2026, 9, 9, 5, 30, 0)), '12:30 a. m.');
});

test('distancia haversine: un grado de latitud ≈ 111 km', () => {
  const d = haversineKm({ lat: 8, lon: -80 }, { lat: 9, lon: -80 });
  assert.ok(Math.abs(d - 111.2) < 0.5, `obtenido ${d}`);
});

test('rumbo: norte y nombre de rumbo', () => {
  const b = bearingDeg({ lat: 8, lon: -80 }, { lat: 9, lon: -80 });
  assert.ok(Math.abs(b) < 0.01);
  assert.equal(bearingName(b), 'norte');
  assert.equal(bearingName(90), 'este');
  assert.equal(bearingName(225), 'suroeste');
});

test('redondeo de ubicación a 0.05° (privacidad ~5 km)', () => {
  assert.deepEqual(roundLocation({ lat: 8.123, lon: -80.077 }), { lat: 8.1, lon: -80.1 });
});

test('validación de coordenadas', () => {
  assert.equal(validCoords(8.9, -79.5), true);
  assert.equal(validCoords(91, 0), false);
  assert.equal(validCoords(NaN, 0), false);
});
