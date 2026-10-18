import { equal, ok } from 'node:assert';
import { test } from 'node:test';
import { dilateMask, fillRegion, floodFillTolerance, labelRegions, lineMaskFromRGBA } from '../../web/core/colorfill.js';

// Mosaico 7x7: cruz de línea que divide en 4 regiones + fondo sin cerrar fuera.
// ##X##__   (x = línea)
const W = 7;
const H = 7;
const line = new Uint8Array(W * H);
const mark = (x, y) => (line[y * W + x] = 1);
for (let y = 0; y < H; y++) mark(3, y);
for (let x = 0; x < W; x++) mark(x, 3);

test('labelRegions: la cruz parte el lienzo en regiones', () => {
  const { labels, regionCount } = labelRegions(line, W, H);
  // Izq-arriba, der-arriba, izq-abajo, der-abajo + 4 bandas externas conectadas por las esquinas...
  // Celdas no-línea: 45; las 4 esquinas externas se conectan por los bordes? No: la cruz llega al borde → 4 regiones.
  equal(regionCount, 4);
  equal(labels[0], labels[2 * W + 2]); // mismo cuadrante arriba-izq
  ok(labels[0] !== labels[5 * W + 5]); // cuadrante opuesto
  equal(labels[3 * W + 3], -1); // la línea no recibe etiqueta
});

test('fillRegion pinta solo la región elegida', () => {
  const { labels } = labelRegions(line, W, H);
  const out = new Uint8ClampedArray(W * H * 4);
  const painted = fillRegion(out, labels, labels[0], [255, 0, 0, 255]);
  ok(painted > 0);
  equal(out[0], 255);
  equal(out[2 * W * 4 + 3], 255); // sigue el mismo cuadrante
  const idx = (5 * W + 5) * 4;
  equal(out[idx], 0); // cuadrante distinto intacto
  equal(out[(3 * W + 3) * 4 + 3], 0); // la línea intacta
});

test('floodFill con tolerancia no cruza líneas oscuras', () => {
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = 255;
    data[i * 4 + 3] = 255;
  }
  for (let i = 0; i < line.length; i++) {
    if (line[i]) {
      data[i * 4] = 30;
      data[i * 4 + 1] = 30;
      data[i * 4 + 2] = 30;
      data[i * 4 + 3] = 255;
    }
  }
  const n = floodFillTolerance(data, W, H, 0, 0, [0, 120, 255, 255], 40);
  ok(n >= 9 && n < W * H, 'rellenó el cuadrante sin explotar: ' + n);
  equal(data[(5 * W + 5) * 4], 255); // cuadrante opuesto sigue blanco
  equal(data[0], 0); // aquí sí pintó
});

test('lineMaskFromRGBA: solo píxeles oscuros y opacos son barrera', () => {
  const d = new Uint8ClampedArray([
    20, 20, 20, 255, // línea oscura → 1
    250, 250, 250, 255, // fondo claro → 0
    10, 10, 10, 30, // oscuro pero transparente (anti-alias) → 0
  ]);
  const m = lineMaskFromRGBA(d, 3, 1);
  deepEqualArr(Array.from(m), [1, 0, 0]);
});

test('dilateMask cierra rendijas de 1 píxel', () => {
  const m = new Uint8Array([0, 1, 0, 0, 0, 0]);
  const out = dilateMask(m, 3, 2);
  // La línea (1,0) se expande arriba/abajo/izq/der: [1,1,1, ·,1,·]
  deepEqualArr(Array.from(out), [1, 1, 1, 0, 1, 0]);
});

test('integridad: una línea rota se nota (región única gigante)', () => {
  const openLine = new Uint8Array(W * H);
  for (let y = 0; y < H - 1; y++) openLine[y * W + 3] = 1; // hueco al fondo
  const { regionCount } = labelRegions(openLine, W, H);
  equal(regionCount, 1); // el color se escaparía: buena prueba para exigir líneas cerradas
});

function deepEqualArr(a, b) {
  equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) ok(a[i] === b[i]);
}
