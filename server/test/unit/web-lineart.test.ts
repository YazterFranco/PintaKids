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
