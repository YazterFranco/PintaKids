import { deepEqual, equal, ok } from 'node:assert';
import { test } from 'node:test';
import { coverage, samplePoints, starsFor } from '../../web/core/guide.js';
import { LETTERS, letterSvg } from '../../web/core/letters.js';
import { parseSteps } from '../../web/core/svgsteps.js';

const W = 50;
// guía: una línea horizontal en y=25, x 5..44
function guide() {
  const m = new Uint8Array(W * W);
  for (let x = 5; x < 45; x++) m[25 * W + x] = 1;
  return m;
}
function ink(fromX: number, toX: number) {
  const d = new Uint8ClampedArray(W * W * 4);
  for (let x = fromX; x < toX; x++) d[(25 * W + x) * 4 + 3] = 255;
  return d;
}

test('guía: samplePoints toma puntos de la línea, como mucho `max`', () => {
  const s = samplePoints(guide(), W, W, 10);
  ok(s.length <= 10 && s.length >= 8);
  for (const i of s) equal(guide()[i], 1);
  equal(samplePoints(guide(), W, W, 400).length, 40);
  equal(samplePoints(new Uint8Array(W * W), W, W).length, 0);
});

test('guía: coverage mide cuánto de la guía tiene tinta cerca', () => {
  const s = samplePoints(guide(), W, W, 400);
  equal(coverage(s, ink(5, 45), W, 2), 1);
  equal(coverage(s, new Uint8ClampedArray(W * W * 4), W, 2), 0);
  const half = coverage(s, ink(5, 25), W, 1);
  ok(half > 0.4 && half < 0.6, `mitad ≈ 0.5, fue ${half}`);
  // tinta 2 px por debajo de la guía cuenta si el radio lo permite
  const off = new Uint8ClampedArray(W * W * 4);
  for (let x = 5; x < 45; x++) off[(27 * W + x) * 4 + 3] = 255;
  equal(coverage(s, off, W, 3), 1);
  equal(coverage(s, off, W, 1), 0);
  equal(coverage([], off, W, 3), 0, 'sin guía no hay puntos que cubrir');
});

test('guía: estrellas por cobertura (40 / 65 / 85 %)', () => {
  deepEqual([0, 0.39, 0.4, 0.64, 0.65, 0.84, 0.85, 1].map(starsFor), [0, 0, 1, 1, 2, 2, 3, 3]);
});

test('letras: A–Z, Ñ y 0–9 con trazos ordenados dentro del recuadro', () => {
  const keys = Object.keys(LETTERS);
  equal(keys.length, 37);
  for (const ch of [...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789']) {
    const L = LETTERS[ch];
    ok(L && L.strokes.length >= 1, `falta ${ch}`);
    for (const s of L.strokes) {
      ok(s.length >= 4 && s.length % 2 === 0, `${ch}: trazo con al menos 2 puntos`);
      ok(s.every((v: number) => v >= 0 && v <= 1), `${ch}: puntos fuera de 0..1`);
    }
  }
});

test('letras: letterSvg produce pasos que entiende el motor guiado', () => {
  const p = parseSteps(letterSvg('A'));
  equal(p.viewBox, '0 0 400 400');
  equal(p.steps.length, LETTERS.A.strokes.length);
  equal(parseSteps(letterSvg('O')).steps.length, 1);
});
