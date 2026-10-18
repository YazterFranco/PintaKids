import { deepEqual, equal, notEqual, ok, throws } from 'node:assert';
import { test } from 'node:test';
import { addPoint, cloneStroke, deserializeStrokes, makeStroke, serializeStrokes, strokesEqual } from '../../web/core/strokes.js';
import { createHistory } from '../../web/core/history.js';

test('strokes: roundtrip serialización sin perder trazos', () => {
  const a = makeStroke('crayon', '#ff0000', 12, [0.1, 0.2, 0.30001, 0.4]);
  a.m = true;
  const b = makeStroke('eraser', '#000', 30, [0.5, 0.5]);
  const json = serializeStrokes([a, b]);
  const back = deserializeStrokes(json);
  equal(back.ok, true);
  equal(strokesEqual([a, b], back.strokes), true);
  equal(strokesEqual([a], back.strokes), false);
});

test('strokes: valida entradas sucias sin reventar', () => {
  equal(deserializeStrokes('no-es-json').ok, false);
  equal(deserializeStrokes('{}').ok, false);
  equal(deserializeStrokes('[{"t":"pintura-magica","c":"#000","s":1,"p":[]}]').ok, false);
  equal(deserializeStrokes('[{"t":"pencil","c":"#000","s":1,"p":[0.1]}]').ok, false);
  equal(deserializeStrokes('[{"t":"pencil","c":"#000","s":1,"p":[5,5]}]').ok, false);
  equal(deserializeStrokes('[]').ok, true);
});

test('strokes: puntos fuera de rango se rechazan al añadir', () => {
  const s = makeStroke('pencil', '#000', 4);
  throws(() => addPoint(s, 1.5, 0.2));
  throws(() => addPoint(s, -0.1, 0));
  addPoint(s, 0, 1);
  equal(s.p.length, 2);
});

test('strokes: clone es profunda (mutar el clon no toca el original)', () => {
  const s = makeStroke('marker', '#00f', 10, [0.1, 0.1]);
  const c = cloneStroke(s);
  addPoint(c, 0.9, 0.9);
  equal(s.p.length, 2);
  equal(c.p.length, 4);
});

test('history: undo/redo encadenado y limpieza de redo al escribir', () => {
  const h = createHistory([]);
  const s1 = [makeStroke('pencil', '#000', 4, [0.1, 0.1])];
  const s2 = [...s1, makeStroke('pencil', '#f00', 4, [0.5, 0.5])];
  h.set(s1);
  h.set(s2);
  equal(h.strokes.length, 2);
  equal(h.canUndo(), true);
  equal(h.canRedo(), false);
  deepEqual(h.undo(), s1);
  equal(h.canRedo(), true);
  deepEqual(h.redo(), s2);
  h.set([...s2, makeStroke('pencil', '#0f0', 4, [0.9, 0.9])]);
  equal(h.canRedo(), false);
  while (h.canUndo()) h.undo();
  equal(h.strokes.length, 0);
  deepEqual(h.undo(), h.strokes);
  h.reset([s1[0]]);
  equal(h.canUndo(), false);
});

test('history: pila acotada (memoria del teléfono del niño)', () => {
  const h = createHistory([]);
  for (let i = 0; i < 100; i++) h.set([makeStroke('pencil', '#000', 4, [i / 100, 0.5])]);
  let undoCount = 0;
  while (h.canUndo() && undoCount < 200) {
    h.undo();
    undoCount++;
  }
  ok(undoCount <= 60, 'máximo 60 pasos de undo, tenía ' + undoCount);
});
