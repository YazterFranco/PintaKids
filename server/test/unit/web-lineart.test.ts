import { equal, ok } from 'node:assert';
import { test } from 'node:test';
import { blur, grayscale, photoToLineart, sobel, threshold } from '../../web/core/lineart.js';

// Imagen 20x20: fondo blanco, cuadrado negro de 6x6 → los bordes del cuadrado son líneas.
const W = 20;
const H = 20;
const rgba = new Uint8ClampedArray(W * H * 4).fill(255);
for (let y = 6; y < 12; y++) {
  for (let x = 6; x < 12; x++) {
    const o = (y * W + x) * 4;
    rgba[o] = 0;
    rgba[o + 1] = 0;
    rgba[o + 2] = 0;
  }
}

test('grayscale y blur no cambian dimensiones ni explotan', () => {
  const g = grayscale(rgba, W, H);
  equal(g.length, W * H);
  equal(g[0], 255);
  equal(g[6 * W + 6], 0);
  const b = blur(g, W, H);
  equal(b.length, W * H);
  equal(b[0], 255, 'la esquina blanca no se contamina');
});

test('sobel detecta el contorno del cuadrado', () => {
  const m = sobel(blur(grayscale(rgba, W, H), W, H), W, H);
  // Un píxel sobre el borde superior del cuadrado debe arder; el centro negro, no.
  ok(m[6 * W + 8] > 60, 'borde detectado');
  ok(m[9 * W + 9] < 30, 'centro plano sin línea falsa');
});

test('photoToLineart produce máscara binaria con Otsu automático y umbral fijo', () => {
  const auto = photoToLineart(rgba, W, H, null);
  ok(auto.threshold >= 24);
  const vals = new Set(auto.mask);
  ok(vals.has(1), 'hay líneas');
  ok(vals.size <= 2);
  let on = 0;
  for (const v of auto.mask) on += v;
  ok(on < W * H * 0.5, 'no es una mancha total (ruido controlado): ' + on);
  ok(on >= 8, 'el contorno no desapareció: ' + on);

  const fijo = photoToLineart(rgba, W, H, 60);
  equal(fijo.threshold, 60);
});

test('superficie lisa (sin bordes) produce máscara casi vacía', () => {
  const flat = new Uint8ClampedArray(W * H * 4).fill(255);
  const { mask } = photoToLineart(flat, W, H, null);
  let on = 0;
  for (const v of mask) on += v;
  equal(on, 0);
});

import { labelRegions } from '../../web/core/colorfill.js';

/** Foto de 100×100: círculo dibujado a mano (trazo de 3 px) + puntitos de ruido sueltos. */
function circlePhoto() {
  const S = 100;
  const d = new Uint8ClampedArray(S * S * 4).fill(255);
  const dot = (x: number, y: number, v: number) => {
    const o = (y * S + x) * 4;
    d[o] = d[o + 1] = d[o + 2] = v;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.hypot(x - 50, y - 50);
    if (Math.abs(r - 30) < 1.6) dot(x, y, 30);
  }
  for (const [x, y] of [[8, 8], [90, 12], [12, 88], [85, 85], [50, 6]]) dot(x, y, 0); // ruido
  return { d, S };
}

test('foto v2: el círculo queda como anillo cerrado (dentro ≠ fuera)', () => {
  const { d, S } = circlePhoto();
  const { mask } = photoToLineart(d, S, S, { detail: 0.5, thickness: 2 });
  const { labels } = labelRegions(mask, S, S);
  ok(labels[50 * S + 50] >= 0 && labels[2 * S + 2] >= 0);
  ok(labels[50 * S + 50] !== labels[2 * S + 2], 'el interior se puede colorear aparte');
});

test('foto v2: los puntitos de ruido sueltos desaparecen', () => {
  const { d, S } = circlePhoto();
  const { mask } = photoToLineart(d, S, S, { detail: 0.5, thickness: 2 });
  for (const [x, y] of [[8, 8], [90, 12], [12, 88], [85, 85], [50, 6]]) equal(mask[y * S + x], 0, `ruido en ${x},${y}`);
});

test('foto v2: más grosor = línea más gruesa; más detalle = umbral más bajo', () => {
  const { d, S } = circlePhoto();
  const count = (m: Uint8Array) => m.reduce((a, v) => a + v, 0);
  const thin = photoToLineart(d, S, S, { detail: 0.5, thickness: 1 });
  const thick = photoToLineart(d, S, S, { detail: 0.5, thickness: 3 });
  ok(count(thick.mask) > count(thin.mask));
  ok(photoToLineart(d, S, S, { detail: 0.9 }).threshold < photoToLineart(d, S, S, { detail: 0.1 }).threshold);
});
