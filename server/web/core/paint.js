/**
 * Motor de pintura: convierte trazos normalizados en píxeles de canvas.
 * Cada herramienta tiene su "personalidad" (grano de crayón, spray, arcoíris...).
 * Determinista: mismo trazo → misma textura (PRNG con semilla por índice).
 */

import { BRUSHES, paintBrush } from './brushes.js';

/**
 * opts.underlay(ctx, w, h): capa de fondo que se ve debajo (papel, dibujo para pintar encima).
 * El balde la usa como límite para no inundar toda la hoja.
 */
export function paintStroke(ctx, stroke, w, h, opts = {}) {
  const { t: tool, c: color, s: size, p: pts } = stroke;
  ctx.save();
  const base = { lineWidth: size, lineCap: 'round', lineJoin: 'round', strokeStyle: color, fillStyle: color };

  if (tool === 'fill') {
    floodFill(ctx, w, h, Math.round(pts[0] * (w - 1)), Math.round(pts[1] * (h - 1)), color, opts.underlay ? composite(ctx, w, h, opts.underlay) : null);
    ctx.restore();
    return;
  }

  if (tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'star') {
    Object.assign(ctx, base);
    ctx.globalAlpha = Math.min(1, Math.max(0.05, stroke.o ?? 1));
    const x0 = pts[0] * w;
    const y0 = pts[1] * h;
    const x1 = (pts[2] ?? pts[0]) * w;
    const y1 = (pts[3] ?? pts[1]) * h;
    ctx.beginPath();
    if (tool === 'rect') {
      ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    } else if (tool === 'ellipse') {
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.max(1, Math.abs(x1 - x0) / 2), Math.max(1, Math.abs(y1 - y0) / 2), 0, 0, Math.PI * 2);
    } else if (tool === 'line') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    } else {
      starPath(ctx, x0, y0, x1, y1);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.restore();
  if (BRUSHES.includes(tool)) paintBrush(ctx, stroke, w, h);
}

/** Transformaciones de espejo: cada una se aplica a una copia del trazo. */
export function mirrorTransforms(m, w, h) {
  const id = [1, 0, 0, 1, 0, 0];
  if (!m) return [id];
  if (m === true || m === 'v') return [id, [-1, 0, 0, 1, w, 0]];
  if (m === 'h') return [id, [1, 0, 0, -1, 0, h]];
  if (m === 'quad') return [id, [-1, 0, 0, 1, w, 0], [1, 0, 0, -1, 0, h], [-1, 0, 0, -1, w, h]];
  if (m === 'kaleido') {
    const out = [];
    const cx = w / 2;
    const cy = h / 2;
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const c = Math.cos(a);
      const s = Math.sin(a);
      // rotación alrededor del centro, y su reflejo
      out.push([c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]);
      out.push([-c, -s, -s, c, cx + c * cx + s * cy, cy + s * cx - c * cy]);
    }
    return out;
  }
  return [id];
}

/** Pinta un trazo con todas sus copias de espejo. */
export function paintMirrored(ctx, s, w, h, opts = {}) {
  const tfs = s.t === 'fill' ? [[1, 0, 0, 1, 0, 0]] : mirrorTransforms(s.m, w, h);
  for (const t of tfs) {
    ctx.save();
    ctx.transform(...t);
    paintStroke(ctx, s, w, h, opts);
    ctx.restore();
  }
}

export function paintAll(ctx, strokes, w, h, opts = {}) {
  for (const s of strokes) paintMirrored(ctx, s, w, h, opts);
}

/** Lo que el niño ve: blanco + fondo + trazos actuales. Solo para decidir los límites del balde. */
function composite(ctx, w, h, underlay) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  underlay(g, w, h);
  g.drawImage(ctx.canvas, 0, 0);
  return g.getImageData(0, 0, w, h);
}

export function renderToCanvas(strokes, w, h, background = '#ffffff') {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const c = off.getContext('2d');
  if (background) {
    c.fillStyle = background;
    c.fillRect(0, 0, w, h);
  }
  paintAll(c, strokes, w, h);
  return off;
}

/** Miniatura barata para galería. */
export function thumbnail(strokes, size = 220, background = '#ffffff') {
  return renderToCanvas(strokes, size, size, background).toDataURL('image/png');
}

/** Estrella de 5 puntas inscrita en la caja definida por dos esquinas opuestas. */
function starPath(ctx, x0, y0, x1, y1) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max(2, Math.abs(x1 - x0) / 2);
  const ry = Math.max(2, Math.abs(y1 - y0) / 2);
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const k = i % 2 === 0 ? 1 : 0.45;
    const x = cx + Math.cos(ang) * rx * k;
    const y = cy + Math.sin(ang) * ry * k;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Balde de pintura: relleno por inundación (scanline) con tolerancia.
 * Determinista: se repite igual al re-pintar la lista de trazos en orden.
 */
export function floodFill(ctx, w, h, sx, sy, color, boundary = null) {
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const out = img.data;
  // Se decide la zona con lo que se ve (boundary) y se pinta en la capa propia (out).
  const d = boundary ? boundary.data : out;
  const at = (x, y) => (y * w + x) * 4;
  const si = at(sx, sy);
  const tr = d[si];
  const tg = d[si + 1];
  const tb = d[si + 2];
  const ta = d[si + 3];
  const [fr, fg, fb] = hexToRgb(color);
  const TOL = 36;
  const match = (i) =>
    Math.abs(d[i] - tr) <= TOL && Math.abs(d[i + 1] - tg) <= TOL &&
    Math.abs(d[i + 2] - tb) <= TOL && Math.abs(d[i + 3] - ta) <= TOL;
  if (Math.abs(fr - tr) + Math.abs(fg - tg) + Math.abs(fb - tb) + Math.abs(255 - ta) < 12) return; // mismo color: nada que hacer
  const painted = new Uint8Array(w * h);
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x0, y] = stack.pop();
    let x = x0;
    while (x > 0 && match(at(x - 1, y)) && !painted[y * w + x - 1]) x--;
    let spanUp = false;
    let spanDown = false;
    while (x < w && match(at(x, y)) && !painted[y * w + x]) {
      const i = at(x, y);
      out[i] = fr;
      out[i + 1] = fg;
      out[i + 2] = fb;
      out[i + 3] = 255;
      painted[y * w + x] = 1;
      if (y > 0) {
        const up = match(at(x, y - 1)) && !painted[(y - 1) * w + x];
        if (up && !spanUp) { stack.push([x, y - 1]); spanUp = true; }
        if (!up) spanUp = false;
      }
      if (y < h - 1) {
        const dn = match(at(x, y + 1)) && !painted[(y + 1) * w + x];
        if (dn && !spanDown) { stack.push([x, y + 1]); spanDown = true; }
        if (!dn) spanDown = false;
      }
      x++;
    }
  }
  ctx.putImageData(img, 0, 0);
}
