/**
 * Pinceles realistas de Pintakids v2 (procedurales: sin imágenes, gratis y deterministas).
 *
 * Cada trazo de ancho variable se dibuja como UN contorno relleno una sola vez:
 * los pinceles semitransparentes no se oscurecen al cruzarse consigo mismos.
 * La textura (grano de crayón, tiza, lápiz) se estampa con un PRNG sembrado por el trazo,
 * así deshacer/re-pintar produce exactamente el mismo resultado.
 */

export const BRUSHES = ['crayon', 'colorpencil', 'marker', 'watercolor', 'chalk', 'neon', 'glitter', 'spray', 'rainbow', 'eraser', 'stamp'];

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Media móvil sobre pares (x,y); los extremos no se mueven. */
export function smoothPoints(pts, k = 3) {
  const n = pts.length / 2;
  if (n < 3 || k < 2) return pts.slice();
  const out = pts.slice();
  const half = Math.floor(k / 2);
  for (let i = 1; i < n - 1; i++) {
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      sx += pts[j * 2];
      sy += pts[j * 2 + 1];
      c++;
    }
    out[i * 2] = sx / c;
    out[i * 2 + 1] = sy / c;
  }
  return out;
}

/** Ancho en el punto i según la velocidad (distancia al punto anterior): rápido → fino. */
export function strokeWidthAt(i, pts, base, w, h) {
  const j = Math.max(1, i);
  if (pts.length < 4) return base;
  const d = Math.hypot((pts[j * 2] - pts[j * 2 - 2]) * w, (pts[j * 2 + 1] - pts[j * 2 - 1]) * h);
  return base * clamp(1.25 - d / (base * 2), 0.55, 1.25);
}

/** Puntos en píxeles + anchos suavizados. */
function geometry(stroke, w, h, widthScale = 1, dynamic = true) {
  const p = smoothPoints(stroke.p, 3);
  const n = p.length / 2;
  const P = new Array(n);
  const W = new Array(n);
  for (let i = 0; i < n; i++) {
    P[i] = [p[i * 2] * w, p[i * 2 + 1] * h];
    W[i] = (dynamic ? strokeWidthAt(i, p, stroke.s, w, h) : stroke.s) * widthScale;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < n - 1; i++) W[i] = (W[i - 1] + W[i] * 2 + W[i + 1]) / 4;
  }
  return { P, W };
}

/** Traza el contorno (lado izquierdo, tapa, lado derecho, tapa) de un trazo de ancho variable. */
function outlinePath(ctx, P, W, scale = 1) {
  ctx.beginPath();
  const n = P.length;
  if (n === 1) {
    ctx.arc(P[0][0], P[0][1], Math.max(0.5, (W[0] * scale) / 2), 0, Math.PI * 2);
    return;
  }
  const normal = (i) => {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  };
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const [nx, ny] = normal(i);
    const r = Math.max(0.5, (W[i] * scale) / 2);
    left.push([P[i][0] + nx * r, P[i][1] + ny * r]);
    right.push([P[i][0] - nx * r, P[i][1] - ny * r]);
  }
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  const end = P[n - 1];
  const ae = Math.atan2(left[n - 1][1] - end[1], left[n - 1][0] - end[0]);
  ctx.arc(end[0], end[1], Math.max(0.5, (W[n - 1] * scale) / 2), ae, ae - Math.PI, true);
  for (let i = n - 2; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  const st = P[0];
  const as = Math.atan2(right[0][1] - st[1], right[0][0] - st[0]);
  ctx.arc(st[0], st[1], Math.max(0.5, (W[0] * scale) / 2), as, as - Math.PI, true);
  ctx.closePath();
}

/** Recorre el trazo cada `spacing` px llamando a fn(x, y, ancho). */
function walk(P, W, spacing, fn) {
  fn(P[0][0], P[0][1], W[0]);
  let carry = 0;
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1];
    const [x1, y1] = P[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    let t = spacing - carry;
    while (t <= seg) {
      const k = t / seg;
      fn(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, W[i - 1] + (W[i] - W[i - 1]) * k);
      t += spacing;
    }
    carry = seg - (t - spacing);
  }
}

/** Grano: puntitos dispersos dentro del ancho del trazo. */
function grain(ctx, P, W, rnd, { spacing, density, size, spread = 0.5, alpha }) {
  walk(P, W, spacing, (x, y, wd) => {
    const count = Math.max(2, Math.round(wd * density));
    for (let k = 0; k < count; k++) {
      const ang = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * wd * spread;
      const s = size[0] + rnd() * (size[1] - size[0]);
      ctx.globalAlpha = alpha * (0.5 + rnd() * 0.5);
      ctx.fillRect(x + Math.cos(ang) * rad - s / 2, y + Math.sin(ang) * rad - s / 2, s, s);
    }
  });
}

function seedOf(stroke) {
  return Math.round((stroke.p[0] ?? 0) * 1e5 + (stroke.p[1] ?? 0) * 1e3 + stroke.p.length * 7919 + stroke.s * 31);
}

/* ───────────── sellos (stickers propios, centrados en 0,0) ───────────── */
function starShape(ctx, s, k = 0.45, spikes = 5) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    const r = i % 2 === 0 ? s / 2 : (s / 2) * k;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

export const STAMP_SHAPES = {
  star: (ctx, s) => starShape(ctx, s),
  heart: (ctx, s) => {
    const k = s / 2;
    ctx.beginPath();
    ctx.moveTo(0, k * 0.85);
    ctx.bezierCurveTo(-k * 1.2, k * 0.05, -k * 0.75, -k * 0.95, 0, -k * 0.4);
    ctx.bezierCurveTo(k * 0.75, -k * 0.95, k * 1.2, k * 0.05, 0, k * 0.85);
    ctx.closePath();
    ctx.fill();
  },
  flower: (ctx, s) => {
    const r = s * 0.2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * r * 1.4 + r, Math.sin(a) * r * 1.4);
      ctx.arc(Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.save();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  butterfly: (ctx, s) => {
    const k = s / 2;
    ctx.beginPath();
    ctx.ellipse(-k * 0.45, -k * 0.3, k * 0.45, k * 0.38, -0.5, 0, Math.PI * 2);
    ctx.ellipse(k * 0.45, -k * 0.3, k * 0.45, k * 0.38, 0.5, 0, Math.PI * 2);
    ctx.ellipse(-k * 0.35, k * 0.38, k * 0.3, k * 0.26, 0.5, 0, Math.PI * 2);
    ctx.ellipse(k * 0.35, k * 0.38, k * 0.3, k * 0.26, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.ellipse(0, 0, k * 0.09, k * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  paw: (ctx, s) => {
    const k = s / 2;
    ctx.beginPath();
    ctx.ellipse(0, k * 0.3, k * 0.42, k * 0.36, 0, 0, Math.PI * 2);
    for (const [x, y] of [[-0.55, -0.2], [-0.2, -0.55], [0.2, -0.55], [0.55, -0.2]]) {
      ctx.moveTo(x * k + k * 0.17, y * k);
      ctx.arc(x * k, y * k, k * 0.17, 0, Math.PI * 2);
    }
    ctx.fill();
  },
  cloud: (ctx, s) => {
    const k = s / 2;
    ctx.beginPath();
    ctx.arc(-k * 0.45, k * 0.1, k * 0.35, 0, Math.PI * 2);
    ctx.arc(0, -k * 0.15, k * 0.48, 0, Math.PI * 2);
    ctx.arc(k * 0.5, k * 0.1, k * 0.35, 0, Math.PI * 2);
    ctx.rect(-k * 0.45, k * 0.1, k * 0.95, k * 0.35);
    ctx.fill();
  },
  sun: (ctx, s) => {
    starShape(ctx, s, 0.72, 12);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  moon: (ctx, s) => {
    const k = s / 2;
    ctx.beginPath();
    ctx.arc(0, 0, k * 0.8, Math.PI * 0.35, Math.PI * 1.65, false);
    ctx.arc(k * 0.35, 0, k * 0.62, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.closePath();
    ctx.fill();
  },
};

/* ───────────── pinceles ───────────── */
const PAINTERS = {
  marker(ctx, s, P, W) {
    ctx.globalAlpha *= 0.9;
    outlinePath(ctx, P, W);
    ctx.fill();
  },
  crayon(ctx, s, P, W, rnd) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.42;
    outlinePath(ctx, P, W, 0.92);
    ctx.fill();
    grain(ctx, P, W, rnd, { spacing: Math.max(2, s.s * 0.22), density: 1.1, size: [1, 2.6], spread: 0.5, alpha: a * 0.75 });
  },
  colorpencil(ctx, s, P, W, rnd) {
    const a = ctx.globalAlpha;
    const thin = W.map((x) => x * 0.45);
    ctx.globalAlpha = a * 0.38;
    outlinePath(ctx, P, thin);
    ctx.fill();
    grain(ctx, P, thin, rnd, { spacing: Math.max(1.5, s.s * 0.12), density: 1.4, size: [0.8, 1.6], spread: 0.55, alpha: a * 0.7 });
  },
  chalk(ctx, s, P, W, rnd) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.16;
    outlinePath(ctx, P, W, 0.85);
    ctx.fill();
    grain(ctx, P, W, rnd, { spacing: Math.max(2, s.s * 0.18), density: 1.6, size: [1.2, 3.2], spread: 0.58, alpha: a * 0.85 });
  },
  watercolor(ctx, s, P, W, rnd) {
    const a = ctx.globalAlpha;
    ctx.save();
    ctx.shadowColor = s.c;
    ctx.shadowBlur = s.s * 0.6;
    ctx.globalAlpha = a * 0.13;
    outlinePath(ctx, P, W, 1.35);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = a * 0.16;
    outlinePath(ctx, P, W, 1.05);
    ctx.fill();
    // borde húmedo: el pigmento se acumula en el contorno
    ctx.globalAlpha = a * 0.13;
    ctx.lineWidth = Math.max(1, s.s * 0.05);
    ctx.strokeStyle = s.c;
    ctx.stroke();
    grain(ctx, P, W, rnd, { spacing: Math.max(4, s.s * 0.5), density: 0.25, size: [2, 5], spread: 0.45, alpha: a * 0.1 });
  },
  neon(ctx, s, P, W) {
    ctx.save();
    ctx.shadowColor = s.c;
    ctx.shadowBlur = s.s * 1.4;
    outlinePath(ctx, P, W, 0.8);
    ctx.fill();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha *= 0.8;
    outlinePath(ctx, P, W, 0.18);
    ctx.fill();
  },
  eraser(ctx, s, P, W) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    outlinePath(ctx, P, W, 2);
    ctx.fill();
  },
  spray(ctx, s, P, W, rnd) {
    const a = ctx.globalAlpha;
    walk(P, W, Math.max(2, s.s * 0.25), (x, y, wd) => {
      const n = Math.round(wd * 0.9);
      for (let k = 0; k < n; k++) {
        const ang = rnd() * Math.PI * 2;
        const rad = Math.sqrt(rnd()) * wd;
        ctx.globalAlpha = a * (0.25 + rnd() * 0.4);
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 0.6 + rnd() * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },
  glitter(ctx, s, P, W, rnd) {
    const a = ctx.globalAlpha;
    walk(P, W, Math.max(3, s.s * 0.22), (x, y, wd) => {
      for (let k = 0; k < 4; k++) {
        const ang = rnd() * Math.PI * 2;
        const rad = Math.sqrt(rnd()) * wd * 0.8;
        const sz = 2 + rnd() * wd * 0.35;
        ctx.save();
        ctx.translate(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
        ctx.rotate(rnd() * Math.PI);
        ctx.globalAlpha = a * (0.6 + rnd() * 0.4);
        ctx.fillStyle = rnd() > 0.6 ? '#ffffff' : s.c;
        starShape(ctx, sz, 0.3, 4);
        ctx.restore();
      }
    });
  },
  rainbow(ctx, s, P, W) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let dist = 0;
    for (let i = 1; i < P.length; i++) {
      dist += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      ctx.strokeStyle = `hsl(${Math.round(dist * 0.45) % 360} 90% 58%)`;
      ctx.lineWidth = W[i];
      ctx.beginPath();
      ctx.moveTo(P[i - 1][0], P[i - 1][1]);
      ctx.lineTo(P[i][0], P[i][1]);
      ctx.stroke();
    }
    if (P.length === 1) {
      ctx.fillStyle = 'hsl(0 90% 58%)';
      outlinePath(ctx, P, W);
      ctx.fill();
    }
  },
  stamp(ctx, s, P, W, rnd, w, h) {
    const size = Math.max(18, s.s * 3);
    for (let i = 0; i < s.p.length; i += 2) {
      ctx.save();
      ctx.translate(s.p[i] * w, s.p[i + 1] * h);
      ctx.rotate((rnd() - 0.5) * 0.6);
      const shape = STAMP_SHAPES[s.ch];
      if (shape) shape(ctx, size);
      else {
        // sellos v1 (emoji)
        ctx.font = `${size}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.ch ?? '⭐', 0, 0);
      }
      ctx.restore();
    }
  },
};

/** Pinta un trazo de pincel (no formas ni balde) en `ctx` de w×h píxeles. */
export function paintBrush(ctx, stroke, w, h) {
  const painter = PAINTERS[stroke.t];
  if (!painter || !stroke.p.length) return;
  ctx.save();
  ctx.globalAlpha = clamp(stroke.o ?? 1, 0.05, 1);
  ctx.fillStyle = stroke.c;
  ctx.strokeStyle = stroke.c;
  const dynamic = stroke.t !== 'stamp';
  const { P, W } = geometry(stroke, w, h, 1, dynamic);
  painter(ctx, stroke, P, W, mulberry32(seedOf(stroke)), w, h);
  ctx.restore();
}
