/**
 * Rellenos con estilo para Colorear: sólido, degradado, patrones y "mágico" (arcoíris).
 * Puro (arrays planos): se prueba en Node. El borde pegado a la línea (2 px de píxeles de línea)
 * también se pinta para que no quede un halo blanco: la línea se dibuja encima y lo tapa.
 */

export const FILL_KINDS = ['solid', 'gradient', 'dots', 'stripes', 'checks', 'stars', 'magic'];

export function regionBBox(labels, region, w) {
  let x0 = w;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== region) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

const mix = (c, k) => [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k];

function hsl(h) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return 255 * (0.62 - 0.38 * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

/** Color del estilo `kind` en (x, y) dentro de la caja `b`. */
function styler(kind, rgba, b) {
  const base = [rgba[0], rgba[1], rgba[2]];
  const tint = mix(base, 0.62);
  const h = Math.max(1, b.y1 - b.y0);
  const w = Math.max(1, b.x1 - b.x0);
  switch (kind) {
    case 'gradient': {
      const top = mix(base, 0.55);
      return (x, y) => {
        const t = Math.min(1, Math.max(0, (y - b.y0) / h));
        return [top[0] + (base[0] - top[0]) * t, top[1] + (base[1] - top[1]) * t, top[2] + (base[2] - top[2]) * t];
      };
    }
    case 'dots':
      return (x, y) => {
        const dx = (x % 14) - 7;
        const dy = (y % 14) - 7;
        return dx * dx + dy * dy < 16 ? base : tint;
      };
    case 'stripes':
      return (x, y) => ((x + y) % 16 < 8 ? base : tint);
    case 'checks':
      return (x, y) => ((((x / 12) | 0) + ((y / 12) | 0)) % 2 ? base : tint);
    case 'stars':
      return (x, y) => {
        const dx = Math.abs((x % 20) - 10);
        const dy = Math.abs((y % 20) - 10);
        return dx + dy < 5 || (dx < 1.5 && dy < 7) || (dy < 1.5 && dx < 7) ? base : tint;
      };
    case 'magic':
      return (x, y) => hsl((((x - b.x0) / w + (y - b.y0) / h) * 180) % 360);
    default:
      return () => base;
  }
}

/**
 * Máscara de la región + hasta 2 px de línea pegados a ella (debajo de la línea: sin halo blanco).
 * Devuelve { mask: Uint8Array (1 = pintable), bbox } con la caja ampliada al anillo.
 */
export function regionWithRing(labels, region, w) {
  const h = labels.length / w;
  const mask = new Uint8Array(labels.length);
  const b = regionBBox(labels, region, w);
  if (b.x1 < 0) return { mask, bbox: b };
  let frontier = [];
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      const i = y * w + x;
      if (labels[i] === region) {
        mask[i] = 1;
        frontier.push(i);
      }
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (labels[j] !== -1 || mask[j]) continue;
        mask[j] = 1;
        next.push(j);
      }
    }
    frontier = next;
  }
  const bbox = { x0: Math.max(0, b.x0 - 2), y0: Math.max(0, b.y0 - 2), x1: Math.min(w - 1, b.x1 + 2), y1: Math.min(h - 1, b.y1 + 2) };
  return { mask, bbox };
}

/**
 * Pinta `region` de `labels` en `out` (RGBA) con el estilo `kind`.
 * Devuelve cuántos píxeles de la región se pintaron (el anillo bajo la línea no cuenta).
 */
export function fillRegionStyled(out, labels, region, kind, rgba, w) {
  const { mask, bbox } = regionWithRing(labels, region, w);
  if (bbox.x1 < 0) return 0;
  const color = styler(kind, rgba, regionBBox(labels, region, w));
  let count = 0;
  for (let y = bbox.y0; y <= bbox.y1; y++) {
    for (let x = bbox.x0; x <= bbox.x1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const c = color(x, y);
      const o = i * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
      if (labels[i] === region) count++;
    }
  }
  return count;
}
