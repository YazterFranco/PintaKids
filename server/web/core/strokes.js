/**
 * Modelo de trazos de Pintakids (normalizado 0..1). El canvas se re-pinta desde esta lista:
 * deshacer/rehacer, guardar, re-explicar y convertir en plantilla son trivialmente posibles.
 */

export const TOOLS = ['crayon', 'marker', 'pencil', 'watercolor', 'glitter', 'spray', 'rainbow', 'eraser', 'stamp'];

export function makeStroke(tool, color, size, pts = [], mirror = false) {
  if (!TOOLS.includes(tool)) throw new Error('herramienta-desconocida:' + tool);
  return { t: tool, c: color, s: size, p: pts.slice(), m: mirror };
}

export function addPoint(stroke, x, y) {
  if (!(x >= 0 && x <= 1) || !(y >= 0 && y <= 1)) throw new Error('punto-fuera-de-rango');
  stroke.p.push(x, y);
  return stroke;
}

/** Copia profunda ligera (JSON segura). */
export function cloneStroke(stroke) {
  return { t: stroke.t, c: stroke.c, s: stroke.s, p: stroke.p.slice(), m: Boolean(stroke.m), ch: stroke.ch };
}

export function serializeStrokes(strokes) {
  return JSON.stringify(strokes.map((s) => ({ ...s, p: s.p.map((v) => Math.round(v * 1e4) / 1e4) })));
}

export function deserializeStrokes(json) {
  let arr;
  try {
    arr = JSON.parse(json);
  } catch {
    return { ok: false, error: 'json-invalido' };
  }
  if (!Array.isArray(arr)) return { ok: false, error: 'no-es-lista' };
  const out = [];
  for (const s of arr) {
    if (!s || typeof s !== 'object' || !TOOLS.includes(s.t)) return { ok: false, error: 'trazo-invalido' };
    if (typeof s.c !== 'string' || typeof s.s !== 'number' || !Array.isArray(s.p) || s.p.length % 2 !== 0) {
      return { ok: false, error: 'trazo-invalido' };
    }
    if (s.p.some((v) => typeof v !== 'number' || v < -0.5 || v > 1.5)) return { ok: false, error: 'punto-invalido' };
    out.push({ t: s.t, c: s.c, s: s.s, p: s.p, m: Boolean(s.m), ch: typeof s.ch === 'string' ? s.ch : undefined });
  }
  return { ok: true, strokes: out };
}

/** Distancia entre dos listas de trazos: para "mismos trazos tras roundtrip". */
export function strokesEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((s, i) => {
    const o = b[i];
    return s.t === o.t && s.c === o.c && s.s === o.s && Boolean(s.m) === Boolean(o.m) && s.p.length === o.p.length &&
      s.p.every((v, j) => Math.abs(v - o.p[j]) < 1e-3);
  });
}
