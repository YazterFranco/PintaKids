import { deepEqual, equal, ok } from 'node:assert';
import { test } from 'node:test';
import { createViewport } from '../../web/core/viewport.js';

const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

test('viewport: identidad al inicio', () => {
  const v = createViewport();
  equal(v.scale, 1);
  deepEqual(v.toCanvas(0.3, 0.4), [0.3, 0.4]);
});

test('viewport: pellizcar ×2 deja fijo el punto medio', () => {
  const v = createViewport();
  v.pinch([0.4, 0.5], [0.6, 0.5], [0.3, 0.5], [0.7, 0.5]);
  ok(Math.abs(v.scale - 2) < 1e-9);
  ok(near(v.toCanvas(0.5, 0.5), [0.5, 0.5]));
  ok(near(v.toCanvas(0.3, 0.5), [0.4, 0.5]));
});

test('viewport: el zoom se limita entre 1 y 5', () => {
  const v = createViewport();
  v.pinch([0.4, 0.5], [0.6, 0.5], [0.45, 0.5], [0.55, 0.5]);
  equal(v.scale, 1);
  v.pinch([0.49, 0.5], [0.51, 0.5], [0.1, 0.5], [0.9, 0.5]);
  equal(v.scale, 5);
});

test('viewport: arrastrar con dos dedos desplaza sin salirse del lienzo', () => {
  const v = createViewport();
  v.pinch([0.4, 0.5], [0.6, 0.5], [0.3, 0.5], [0.7, 0.5]); // ×2
  v.pinch([0.3, 0.5], [0.7, 0.5], [0.4, 0.5], [0.8, 0.5]); // mover +0.1
  ok(near(v.toCanvas(0.5, 0.5), [0.45, 0.5]));
  v.pinch([0.4, 0.5], [0.8, 0.5], [2.4, 0.5], [2.8, 0.5]); // muy lejos → se limita
  ok(near(v.toCanvas(0, 0.5), [0, 0.5]));
});

test('viewport: reset vuelve a la identidad', () => {
  const v = createViewport();
  v.pinch([0.4, 0.5], [0.6, 0.5], [0.3, 0.5], [0.7, 0.5]);
  v.reset();
  equal(v.scale, 1);
  deepEqual(v.toCanvas(0.2, 0.9), [0.2, 0.9]);
});
