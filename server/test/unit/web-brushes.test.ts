import { deepEqual, equal, ok } from 'node:assert';
import { test } from 'node:test';
import { BRUSHES, paintBrush, smoothPoints, strokeWidthAt, STAMP_SHAPES } from '../../web/core/brushes.js';
import { paintAll } from '../../web/core/paint.js';
import { deserializeStrokes, makeStroke } from '../../web/core/strokes.js';

/** Contexto 2D falso: registra cada llamada (y cada asignación de estilo) en orden. */
function fakeCtx() {
  const log: string[] = [];
  const target: Record<string, unknown> = {};
  const proxy = new Proxy(target, {
    get(_t, k: string) {
      if (k === 'log') return log;
      if (k in target) return target[k];
      return (...args: unknown[]) => {
        log.push(`${k}(${args.map((a) => (typeof a === 'number' ? a.toFixed(2) : String(a))).join(',')})`);
        return k === 'createRadialGradient' || k === 'createLinearGradient' ? { addColorStop() {} } : undefined;
      };
    },
    set(_t, k: string, v) {
      target[k] = v;
      log.push(`${k}=${typeof v === 'number' ? v.toFixed(2) : String(v)}`);
      return true;
    },
  });
  return proxy as any;
}

const pts = [0.1, 0.1, 0.3, 0.2, 0.5, 0.4];

test('pinceles: todos pintan algo con un trazo de 3 puntos', () => {
  for (const b of BRUSHES) {
    const ctx = fakeCtx();
    paintBrush(ctx, { t: b, c: '#ff0000', s: 12, p: pts, ch: 'star' }, 400, 400);
    ok(ctx.log.some((l: string) => /^(stroke|fill|fillRect|arc)\(/.test(l)), `${b} no pintó nada`);
  }
});

test('pinceles: deterministas (mismo trazo → mismas operaciones)', () => {
  for (const b of BRUSHES) {
    const a = fakeCtx();
    const c = fakeCtx();
    const s = { t: b, c: '#3366ff', s: 18, p: pts, ch: 'heart' };
    paintBrush(a, s, 300, 300);
    paintBrush(c, s, 300, 300);
    deepEqual(a.log, c.log, `${b} no es determinista`);
  }
});

test('smoothPoints conserva extremos y número de puntos', () => {
  const raw = [0, 0, 0.1, 0.3, 0.2, 0.1, 0.3, 0.4, 0.4, 0];
  const out = smoothPoints(raw, 3);
  equal(out.length, raw.length);
  deepEqual(out.slice(0, 2), [0, 0]);
  deepEqual(out.slice(-2), [0.4, 0]);
  ok(Math.abs(out[3] - 0.3) > 1e-6, 'el punto interior debe suavizarse');
});

test('strokeWidthAt: rápido = más fino, lento = más grueso, dentro de límites', () => {
  const base = 20;
  const slow = strokeWidthAt(1, [0.5, 0.5, 0.501, 0.5], base, 400, 400);
  const fast = strokeWidthAt(1, [0.1, 0.5, 0.6, 0.5], base, 400, 400);
  ok(slow > fast);
  ok(slow <= base * 1.25 + 1e-9 && fast >= base * 0.55 - 1e-9);
});

test('sellos: cada forma dibuja con fill', () => {
  for (const [name, draw] of Object.entries(STAMP_SHAPES)) {
    const ctx = fakeCtx();
    (draw as (c: unknown, s: number) => void)(ctx, 40);
    ok(ctx.log.some((l: string) => l.startsWith('fill(')), `sello ${name} vacío`);
  }
});

test('espejo cuádruple pinta 4 copias y caleidoscopio 6+', () => {
  const count = (m: unknown) => {
    const ctx = fakeCtx();
    paintAll(ctx, [{ ...makeStroke('marker', '#000', 10, pts), m }], 400, 400);
    return ctx.log.filter((l: string) => l === 'fill()').length;
  };
  equal(count(false), 1);
  equal(count(true), 2);
  equal(count('h'), 2);
  equal(count('quad'), 4);
  ok(count('kaleido') >= 6);
});

test('compatibilidad v1: "pencil" se abre como lápiz de color', () => {
  const r = deserializeStrokes('[{"t":"pencil","c":"#000","s":4,"p":[0.1,0.1,0.2,0.2]}]');
  equal(r.ok, true);
  equal(r.strokes[0].t, 'colorpencil');
  equal(makeStroke('pencil', '#000', 4).t, 'colorpencil');
});

test('trazos v2 guardan opacidad y modo espejo al serializar', () => {
  const r = deserializeStrokes('[{"t":"chalk","c":"#fff","s":9,"p":[0.1,0.1,0.2,0.2],"m":"quad","o":0.5}]');
  equal(r.ok, true);
  equal(r.strokes[0].m, 'quad');
  equal(r.strokes[0].o, 0.5);
});
