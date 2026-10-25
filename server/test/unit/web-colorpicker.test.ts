import { deepEqual, equal } from 'node:assert';
import { test } from 'node:test';
import { hexToHsv, hsvToHex, pushRecent } from '../../web/ui/colorpicker.js';

test('color: hex ↔ hsv ida y vuelta', () => {
  for (const hex of ['#ff7675', '#0984e3', '#2d3436', '#ffffff', '#000000', '#00b894']) {
    const [h, s, v] = hexToHsv(hex);
    equal(hsvToHex(h, s, v), hex);
  }
  deepEqual(hexToHsv('#ff0000'), [0, 1, 1]);
});

test('recientes: sin repetidos, el nuevo primero, máximo 8', () => {
  let r: string[] = [];
  for (const c of ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9']) r = pushRecent(r, c);
  equal(r.length, 8);
  equal(r[0], '#9');
  r = pushRecent(r, '#5');
  deepEqual(r.slice(0, 2), ['#5', '#9']);
  equal(new Set(r).size, r.length);
});
