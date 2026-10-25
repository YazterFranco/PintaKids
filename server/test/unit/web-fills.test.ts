import { deepEqual, equal, notDeepEqual, ok } from 'node:assert';
import { test } from 'node:test';
import { FILL_KINDS, fillRegionStyled, regionBBox, regionWithRing } from '../../web/core/fills.js';
import { labelRegions } from '../../web/core/colorfill.js';

// 40×40: un marco de línea de 2 px que separa un cuadro interior (región A) del exterior (región B).
const W = 40;
function scene() {
  const line = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const onFrame = (x >= 9 && x <= 30 && (y === 9 || y === 10 || y === 29 || y === 30)) || (y >= 9 && y <= 30 && (x === 9 || x === 10 || x === 29 || x === 30));
    if (onFrame) line[y * W + x] = 1;
  }
  const { labels } = labelRegions(line, W, W);
  const inner = labels[20 * W + 20];
  const outer = labels[0];
  return { line, labels, inner, outer };
}

test('fills: regionBBox encuadra la región', () => {
  const { labels, inner } = scene();
  deepEqual(regionBBox(labels, inner, W), { x0: 11, y0: 11, x1: 28, y1: 28 });
});

test('fills: cada estilo pinta toda la región y nunca otra región', () => {
  const { labels, inner, outer } = scene();
  const regionPx = labels.filter((l: number) => l === inner).length;
  for (const kind of FILL_KINDS) {
    const out = new Uint8ClampedArray(W * W * 4);
    const n = fillRegionStyled(out, labels, inner, kind, [255, 0, 0, 255], W);
    equal(n, regionPx, `${kind}: cuenta de píxeles`);
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] === inner) ok(out[i * 4 + 3] === 255, `${kind}: píxel de la región sin pintar`);
      if (labels[i] === outer) equal(out[i * 4 + 3], 0, `${kind}: se salió a otra región`);
    }
  }
});

test('fills: el borde junto a la línea también se pinta (sin halo blanco)', () => {
  const { labels, inner } = scene();
  const out = new Uint8ClampedArray(W * W * 4);
  fillRegionStyled(out, labels, inner, 'solid', [0, 0, 255, 255], W);
  // píxel de línea pegado a la región interior (x=10) queda pintado por debajo de la línea
  equal(out[(20 * W + 10) * 4 + 3], 255);
  // pero no el lado exterior del marco (x=9 toca la región exterior)
  equal(out[(20 * W + 8) * 4 + 3], 0);
});

test('fills: degradado y patrones varían; mágico ignora el color elegido', () => {
  const { labels, inner } = scene();
  const px = (kind: string, x: number, y: number) => {
    const out = new Uint8ClampedArray(W * W * 4);
    fillRegionStyled(out, labels, inner, kind, [200, 40, 40, 255], W);
    const o = (y * W + x) * 4;
    return [out[o], out[o + 1], out[o + 2]];
  };
  notDeepEqual(px('gradient', 20, 11), px('gradient', 20, 28));
  deepEqual(px('solid', 12, 12), px('solid', 27, 27));
  const stripes = new Set([12, 14, 16, 18, 20, 22].map((x) => px('stripes', x, 20).join()));
  ok(stripes.size > 1, 'rayas alternan');
  notDeepEqual(px('magic', 12, 12), px('magic', 27, 27));
});

test('fills: regionWithRing incluye la región y su borde de línea, nunca otra región', () => {
  const { labels, inner, outer } = scene();
  const { mask, bbox } = regionWithRing(labels, inner, W);
  equal(mask[20 * W + 20], 1);
  equal(mask[20 * W + 10], 1, 'borde de línea pegado');
  equal(mask[20 * W + 8], 0, 'región exterior');
  for (let i = 0; i < labels.length; i++) if (labels[i] === outer) equal(mask[i], 0);
  ok(bbox.x0 <= 10 && bbox.x1 >= 29);
});
