import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIgcHtml, parseCoord } from '../../src/sources/igc.ts';
import { parseUsgsFeed } from '../../src/sources/usgs.ts';
import { parseEmscFdsn, parseEmscMessage } from '../../src/sources/emsc.ts';
import { IGC_SAMPLE_HTML, NO_TABLE_HTML } from '../helpers/igcHtml.ts';

const NOW = Date.UTC(2026, 9, 9, 18, 0, 0);

test('IGC: extrae sismos únicos, omite fila inválida y respeta el estado', () => {
  const r = parseIgcHtml(IGC_SAMPLE_HTML, NOW);
  assert.equal(r.warnings.length, 0);
  assert.equal(r.observations.length, 2, 'la fila duplicada se fusiona en una');
  assert.equal(r.skipped, 1);
  const first = r.observations[0];
  assert.equal(first.source, 'igc');
  assert.equal(first.originTime, Date.UTC(2026, 9, 9, 17, 56, 5));
  assert.equal(first.lat, 7.4616);
  assert.equal(first.lon, -80.2786, 'W = oeste = negativo');
  assert.equal(first.magnitude, 5.4);
  assert.equal(first.depthKm, 18);
  assert.equal(first.status, 'revisado');
  assert.equal(r.observations[1].status, 'preliminar');
});

test('IGC: sin encabezados reconocibles no inventa datos y avisa', () => {
  const r = parseIgcHtml(NO_TABLE_HTML, NOW);
  assert.equal(r.observations.length, 0);
  assert.equal(r.warnings.length, 1);
});

test('IGC: coordenadas con hemisferio en español (O) y longitud positiva sin letra', () => {
  assert.equal(parseCoord('80.2786°O', 'lon'), -80.2786);
  assert.equal(parseCoord('80.27', 'lon'), -80.27);
  assert.equal(parseCoord('8.5°N', 'lat'), 8.5);
});

test('USGS: GeoJSON dentro de la zona se normaliza; fuera se descarta', () => {
  const feed = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'us7000abcd',
        properties: { mag: 5.2, time: Date.UTC(2026, 9, 9, 15, 0, 0), place: '10 km S de Bocas del Toro', status: 'reviewed' },
        geometry: { type: 'Point', coordinates: [-82.2, 9.0, 12.5] },
      },
      {
        type: 'Feature',
        id: 'far',
        properties: { mag: 6.0, time: Date.UTC(2026, 9, 9, 15, 0, 0), place: 'Japón', status: 'automatic' },
        geometry: { type: 'Point', coordinates: [140.0, 36.0, 10] },
      },
    ],
  };
  const r = parseUsgsFeed(feed, NOW);
  assert.equal(r.observations.length, 1);
  assert.equal(r.skipped, 1);
  const o = r.observations[0];
  assert.equal(o.status, 'revisado');
  assert.equal(o.depthKm, 12.5);
  assert.equal(o.lon, -82.2);
});

test('USGS: formato inesperado lanza error (el poller lo marca como fallo)', () => {
  assert.throws(() => parseUsgsFeed({ nope: true }, NOW));
});

test('EMSC FDSN: fecha sin zona se asume UTC y profundidad se toma de properties', () => {
  const r = parseEmscFdsn(
    {
      features: [
        {
          id: 'x',
          properties: { unid: '20261009_0000001', time: '2026-10-09T17:56:05.0', lat: 7.5, lon: -80.1, depth: 20, mag: 4.8, flynn_region: 'PANAMA' },
          geometry: { type: 'Point', coordinates: [-80.1, 7.5, -20] },
        },
      ],
    },
    NOW,
  );
  assert.equal(r.observations.length, 1);
  const o = r.observations[0];
  assert.equal(o.originTime, Date.UTC(2026, 9, 9, 17, 56, 5));
  assert.equal(o.status, 'preliminar');
  assert.equal(o.depthKm, 20);
});

test('EMSC WebSocket: coordenadas [lon, lat, -prof] cuando no hay propiedades', () => {
  const msg = JSON.stringify({
    action: 'create',
    data: {
      type: 'Feature',
      id: 'w1',
      geometry: { type: 'Point', coordinates: [-80.1, 7.5, -20] },
      properties: { unid: 'u1', time: '2026-10-09T17:56:05.000Z', mag: 4.8, flynn_region: 'PANAMA' },
    },
  });
  const r = parseEmscMessage(msg, NOW);
  assert.equal(r.action, 'create');
  assert.ok(r.observation);
  assert.equal(r.observation.lat, 7.5);
  assert.equal(r.observation.depthKm, 20);
});

test('EMSC WebSocket: mensaje malformado lanza error controlado', () => {
  assert.throws(() => parseEmscMessage('{no-json', NOW));
});
