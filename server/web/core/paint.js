/**
 * Motor de pintura: convierte trazos normalizados en píxeles de canvas.
 * Cada herramienta tiene su "personalidad" (grano de crayón, spray, arcoíris...).
 * Determinista: mismo trazo → misma textura (PRNG con semilla por índice).
 */

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pathFrom(ctx, pts, w, h) {
  ctx.beginPath();
  if (pts.length <= 2) {
    const x = pts[0] * w;
    const y = pts[1] * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y);
    return;
  }
  ctx.moveTo(pts[0] * w, pts[1] * h);
  for (let i = 2; i < pts.length - 2; i += 2) {
    const x = pts[i] * w;
    const y = pts[i + 1] * h;
    const nx = pts[i + 2] * w;
    const ny = pts[i + 3] * h;
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.lineTo(pts[pts.length - 2] * w, pts[pts.length - 1] * h);
}

export function paintStroke(ctx, stroke, w, h) {
  const { t: tool, c: color, s: size, p: pts } = stroke;
  ctx.save();
  const base = { lineWidth: size, lineCap: 'round', lineJoin: 'round', strokeStyle: color, fillStyle: color };

  if (tool === 'fill') {
    floodFill(ctx, w, h, Math.round(pts[0] * (w - 1)), Math.round(pts[1] * (h - 1)), color);
    ctx.restore();
    return;
  }

  if (tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'star') {
    Object.assign(ctx, base);
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

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    Object.assign(ctx, { lineWidth: size * 2, strokeStyle: '#000' });
    pathFrom(ctx, pts, w, h);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (tool === 'stamp') {
    ctx.font = `${Math.max(16, size * 3)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rnd = mulberry32(9);
    for (let i = 0; i < pts.length; i += 2) {
      ctx.save();
      ctx.translate(pts[i] * w, pts[i + 1] * h);
      ctx.rotate((rnd() - 0.5) * 0.9);
      ctx.fillText(stroke.ch ?? '⭐', 0, 0);
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  if (tool === 'spray' || tool === 'glitter') {
    const rnd = mulberry32(Math.round(pts[0] * 1e5 + pts[1] * 1e3 + pts.length));
    const dots = Math.ceil((pts.length / 2) * (tool === 'spray' ? 6 : 4));
    for (let d = 0; d < dots; d++) {
      const si = 2 * Math.floor(rnd() * (pts.length / 2));
      const cx = pts[Math.min(si, pts.length - 2)] * w;
      const cy = pts[Math.min(si + 1, pts.length - 1)] * h;
      const ang = rnd() * Math.PI * 2;
      const rad = rnd() * size * (tool === 'glitter' ? 1.2 : 0.9);
      ctx.globalAlpha = tool === 'glitter' ? 0.5 + rnd() * 0.5 : 0.14 + rnd() * 0.22;
      ctx.fillStyle = tool === 'glitter' && rnd() > 0.55 ? '#fff' : color;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, tool === 'glitter' ? 1.5 + rnd() * 2.5 : 1 + rnd() * (size / 6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (tool === 'rainbow') {
    ctx.lineCap = 'round';
    ctx.lineWidth = size;
    for (let i = 0; i < pts.length - 2; i += 2) {
      ctx.strokeStyle = `hsl(${(i * 9) % 360} 90% 55%)`;
      ctx.beginPath();
      ctx.moveTo(pts[i] * w, pts[i + 1] * h);
      ctx.lineTo(pts[i + 2] * w, pts[i + 3] * h);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (tool === 'crayon') {
    const rnd = mulberry32(pts.length * 31 + Math.round((pts[0] ?? 0) * 1e4));
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5;
    for (let pass = 0; pass < 3; pass++) {
      ctx.save();
      ctx.translate((rnd() - 0.5) * size * 0.35, (rnd() - 0.5) * size * 0.35);
      Object.assign(ctx, { ...base, lineWidth: size * (0.5 + rnd() * 0.5) });
      pathFrom(ctx, pts, w, h);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  if (tool === 'watercolor') {
    ctx.globalAlpha = 0.22;
    ctx.shadowColor = color;
    ctx.shadowBlur = size;
    Object.assign(ctx, base);
    ctx.lineWidth = size * 1.6;
    pathFrom(ctx, pts, w, h);
    ctx.stroke();
    ctx.stroke();
    ctx.restore();
    return;
  }

  Object.assign(ctx, base);
  if (tool === 'marker') {
    ctx.globalAlpha = 0.75;
    ctx.lineCap = 'butt';
    ctx.lineWidth = size * 1.5;
  }
  pathFrom(ctx, pts, w, h);
  ctx.stroke();
  ctx.restore();
}

export function paintAll(ctx, strokes, w, h) {
  for (const s of strokes) {
    paintStroke(ctx, s, w, h);
    if (s.m) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      paintStroke(ctx, s, w, h);
      ctx.restore();
    }
  }
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
export function floodFill(ctx, w, h, sx, sy, color) {
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
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
      d[i] = fr;
      d[i + 1] = fg;
      d[i + 2] = fb;
      d[i + 3] = 255;
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
