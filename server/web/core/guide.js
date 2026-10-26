/**
 * Puntuación del dibujo guiado: qué parte de la guía repasó el niño.
 * Puro (arrays planos): se prueba en Node. Nunca bloquea: solo decide cuántas estrellas mostrar.
 */

/** Índices de los píxeles de guía (mask = 1), submuestreados de forma pareja hasta `max`. */
export function samplePoints(mask, w, h, max = 400) {
  const all = [];
  for (let i = 0; i < w * h; i++) if (mask[i]) all.push(i);
  if (all.length <= max) return Int32Array.from(all);
  const step = all.length / max;
  const out = new Int32Array(max);
  for (let k = 0; k < max; k++) out[k] = all[Math.floor(k * step)];
  return out;
}

/** Fracción de puntos de guía con tinta (alfa > 0 en `rgba`) a ≤ `radius` px. */
export function coverage(samples, rgba, w, radius) {
  if (!samples.length) return 0;
  const h = rgba.length / 4 / w;
  const r2 = radius * radius;
  let hit = 0;
  for (const i of samples) {
    const x = i % w;
    const y = (i / w) | 0;
    let found = false;
    for (let dy = -radius; dy <= radius && !found; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= w || dx * dx + dy * dy > r2) continue;
        if (rgba[(ny * w + nx) * 4 + 3] > 0) {
          found = true;
          break;
        }
      }
    }
    if (found) hit++;
  }
  return hit / samples.length;
}

/** 0–3 estrellas: 40 % → 1, 65 % → 2, 85 % → 3. */
export function starsFor(cov) {
  if (cov >= 0.85) return 3;
  if (cov >= 0.65) return 2;
  if (cov >= 0.4) return 1;
  return 0;
}
