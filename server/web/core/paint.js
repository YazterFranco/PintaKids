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
