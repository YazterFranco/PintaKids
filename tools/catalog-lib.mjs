/**
 * Librería de dibujos para colorear — Pintakids v3 "detallado".
 * Todos los SVG son ORIGINALES (Pintakids-Original, costo $0).
 *
 * Mejoras vs v2:
 *  - Cuerpos con MÚLTIPLES regiones cerradas (barriga, patas, aletas…) → más zonas para el balde.
 *  - Texturas: rayas, escamas, pelaje, manchas, pliegues.
 *  - Escena: suelo, hierba, agua, nubes, estrellas para dar contexto.
 *  - Caras más expresivas: cejas, bocas abiertas con lengua, ojos con brillo.
 *  - Trazo 6.5 redondeado (grosor para niños) y viewBox 200×200.
 */

export const S = 200;
export const LICENSE = 'Pintakids-Original';

// ── Primitivas ───────────────────────────────────────────────
export const c = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
export const e = (x, y, rx, ry, rot = 0) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}/>`;
export const r = (x, y, w, h, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''}/>`;
export const p = (d) => `<path d="${d}"/>`;
export const l = (x1, y, x2, y2) => p(`M${x1} ${y}L${x2} ${y2}`);
export const poly = (...args) => {
  const f = args.flat(Infinity).map(Number);
  let pts = '';
  for (let i = 0; i < f.length - 1; i += 2) pts += `${f[i]},${f[i + 1]} `;
  return `<polygon points="${pts.trim()}"/>`;
};

// ── Caras expresivas ─────────────────────────────────────────
/** Ojos redondos con destello de luz (brillo). */
export const eyes = (x, y, d = 26, rr = 3.5) =>
  c(x - d / 2, y, rr) + c(x + d / 2, y, rr) +
  c(x - d / 2 + rr * 0.35, y - rr * 0.4, rr * 0.34) + c(x + d / 2 + rr * 0.35, y - rr * 0.4, rr * 0.34);

/** Ojos cerrados felices (∪ ∪). */
export const eyesHappy = (x, y, d = 26, s = 6) =>
  p(`M${x - d / 2 - s} ${y} Q${x - d / 2} ${y - s} ${x - d / 2 + s} ${y}`) +
  p(`M${x + d / 2 - s} ${y} Q${x + d / 2} ${y - s} ${x + d / 2 + s} ${y}`);

/** Cejas para dar expresión. */
export const brows = (x, y, d = 26, s = 7) =>
  p(`M${x - d / 2 - s} ${y - 6} Q${x - d / 2} ${y - 10} ${x - d / 2 + s} ${y - 8}`) +
  p(`M${x + d / 2 - s} ${y - 8} Q${x + d / 2} ${y - 10} ${x + d / 2 + s} ${y - 6}`);

/** Sonrisa simple. */
export const smile = (x, y, s = 9) => p(`M${x - s} ${y} Q${x} ${y + s * 0.95} ${x + s} ${y}`);

/** Boca abierta con lengua (más expresiva). */
export const mouthOpen = (x, y, s = 12) =>
  p(`M${x - s} ${y} Q${x} ${y + s * 1.15} ${x + s} ${y} Z`) +
  p(`M${x - s * 0.45} ${y + s * 0.55} Q${x} ${y + s * 1.1} ${x + s * 0.45} ${y + s * 0.55}`);

/** Boca de animal (triángulo redondeado / nariz+labio). */
export const mouthCute = (x, y, s = 7) =>
  p(`M${x - s} ${y} Q${x - s * 0.4} ${y + s * 0.8} ${x} ${y}`) +
  p(`M${x} ${y} Q${x + s * 0.4} ${y + s * 0.8} ${x + s} ${y}`);

export const cheeks = (x, y, d = 42, rr = 4.5) => c(x - d / 2, y, rr) + c(x + d / 2, y, rr);

/** Nariz de animal (triángulo o bofetada). */
export const noseAnimal = (x, y, s = 6) =>
  p(`M${x} ${y + s} Q${x - s} ${y} ${x - s * 0.5} ${y - s * 0.4} Q${x} ${y - s * 0.8} ${x + s * 0.5} ${y - s * 0.4} Q${x + s} ${y} ${x} ${y + s} Z`);

/** Cara kawaii completa y detallada. */
export const faceFull = (x, y, d = 26, s = 9) =>
  eyes(x, y, d) + smile(x, y + d * 0.7, s) + cheeks(x, y + d * 0.5, d + 16);

/** Cara expresiva con cejas y boca abierta. */
export const faceHappy = (x, y, d = 26, s = 10) =>
  brows(x, y, d) + eyes(x, y, d) + mouthOpen(x, y + d * 0.75, s) + cheeks(x, y + d * 0.45, d + 18);

// ── Texturas ─────────────────────────────────────────────────
/** Rayas de tigre / vaca. */
export const stripes = (x, y, n = 3, gap = 10, len = 14, ang = 20) => {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x0 = x + i * gap;
    out += p(`M${x0} ${y} Q${x0 + len * 0.4} ${y + len * 0.5} ${x0 + len * 0.2} ${y + len}`);
  }
  return out;
};

/** Escamas de pez (arcos). */
export const scales = (x, y, rows = 3, cols = 3, gap = 12) => {
  let out = '';
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = x + i * gap + (j % 2 ? gap / 2 : 0);
      const y0 = y + j * gap;
      out += p(`M${x0} ${y0} Q${x0 + gap / 2} ${y0 - gap * 0.6} ${x0 + gap} ${y0}`);
    }
  }
  return out;
};

/** Pelaje (pequeñas curvas). */
export const fur = (x, y, n = 4, gap = 9, s = 5) => {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x0 = x + i * gap;
    out += p(`M${x0} ${y} Q${x0 + s * 0.5} ${y - s} ${x0 + s} ${y}`);
  }
  return out;
};

/** Manchas (para vaca / dalmata). */
export const spots = (...pts) => pts.map(([x, y, rr]) => e(x, y, rr, rr * 0.8, 15)).join('');

// ── Decoración ───────────────────────────────────────────────
export const sparkle = (x, y, s = 7) =>
  poly([x, y - s], [x + s * 0.3, y - s * 0.3], [x + s, y], [x + s * 0.3, y + s * 0.3],
    [x, y + s], [x - s * 0.3, y + s * 0.3], [x - s, y], [x - s * 0.3, y - s * 0.3]);

export const heart = (x, y, s = 10) =>
  p(`M${x} ${y + s * 0.95} C${x - s} ${y - s * 0.15} ${x - s * 0.52} ${y - s} ${x} ${y - s * 0.35} C${x + s * 0.52} ${y - s} ${x + s} ${y - s * 0.15} ${x} ${y + s * 0.95} Z`);

export const star5 = (x, y, R, k = 0.45) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? R : R * k;
    pts.push([Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr)]);
  }
  return poly(...pts);
};

export const cloud = (x, y, s = 1) =>
  p(`M${x - 30 * s} ${y} Q${x - 44 * s} ${y} ${x - 44 * s} ${y - 12 * s} Q${x - 44 * s} ${y - 24 * s} ${x - 28 * s} ${y - 24 * s} Q${x - 22 * s} ${y - 36 * s} ${x - 6 * s} ${y - 32 * s} Q${x + 4 * s} ${y - 42 * s} ${x + 18 * s} ${y - 34 * s} Q${x + 36 * s} ${y - 34 * s} ${x + 36 * s} ${y - 18 * s} Q${x + 48 * s} ${y - 16 * s} ${x + 44 * s} ${y - 2 * s} Q${x + 40 * s} ${y} ${x + 26 * s} ${y} Z`);

export const grassTuft = (x, y, s = 1) =>
  p(`M${x} ${y} Q${x - 3 * s} ${y - 10 * s} ${x - 7 * s} ${y - 14 * s}`) +
  p(`M${x} ${y} Q${x} ${y - 12 * s} ${x + 2 * s} ${y - 18 * s}`) +
  p(`M${x} ${y} Q${x + 4 * s} ${y - 9 * s} ${x + 8 * s} ${y - 12 * s}`);

export const bubble = (x, y, s = 6) => c(x, y, s) + c(x - s * 0.3, y - s * 0.3, s * 0.25);

export const ground = (y = 182, w = 36) =>
  p(`M10 ${y} Q50 ${y - 6} 100 ${y} Q150 ${y + 6} 190 ${y}`) +
  grassTuft(36, y - 4, 0.9) + grassTuft(100, y - 2, 1) + grassTuft(164, y - 4, 0.9);

export const water = (y = 170) =>
  p(`M10 ${y} Q28 ${y - 8} 46 ${y} Q64 ${y + 8} 82 ${y} Q100 ${y - 8} 118 ${y} Q136 ${y + 8} 154 ${y} Q172 ${y - 8} 190 ${y}`) +
  p(`M18 ${y + 12} Q36 ${y + 4} 54 ${y + 12} Q72 ${y + 20} 90 ${y + 12} Q108 ${y + 4} 126 ${y + 12} Q144 ${y + 20} 162 ${y + 12} Q176 ${y + 6} 186 ${y + 10}`);

export const sun = (x, y, R = 16) =>
  c(x, y, R) +
  l(x, y - R, x, y - R - 8) + l(x, y + R, x, y + R + 8) +
  l(x - R, y, x - R - 8, y) + l(x + R, y, x + R + 8, y) +
  l(x - R * 0.7, y - R * 0.7, x - R * 0.7 - 6, y - R * 0.7 - 6) +
  l(x + R * 0.7, y - R * 0.7, x + R * 0.7 + 6, y - R * 0.7 - 6) +
  l(x - R * 0.7, y + R * 0.7, x - R * 0.7 - 6, y + R * 0.7 + 6) +
  l(x + R * 0.7, y + R * 0.7, x + R * 0.7 + 6, y + R * 0.7 + 6);

export const shell = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">` +
  `<g fill="none" stroke="#2b2d42" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;
