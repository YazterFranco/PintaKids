/**
 * Foto → dibujo para colorear: escala de grises → Sobel → umbral.
 * Funciones puras sobre arrays; el DOM/canvas queda en la UI (foto.js).
 */

export function grayscale(rgba, width, height) {
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] = (rgba[o] * 299 + rgba[o + 1] * 587 + rgba[o + 2] * 114) / 1000;
  }
  return out;
}

export function blur(gray, width, height) {
  const tmp = new Uint8Array(gray.length);
  tmp.set(gray);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) tmp[row + x] = (gray[row + x - 1] + gray[row + x] * 2 + gray[row + x + 1]) / 4;
  }
  const out = new Uint8Array(gray.length);
  out.set(gray); // los bordes se conservan (no se vuelven negros falsos)
  for (let x = 1; x < width - 1; x++) {
    for (let y = 1; y < height - 1; y++) {
      const i = y * width + x;
      out[i] = (tmp[i - width] + tmp[i] * 2 + tmp[i + width]) / 4;
    }
  }
  return out;
}

export function sobel(gray, width, height) {
  const mag = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const tl = gray[i - width - 1], tc = gray[i - width], tr = gray[i - width + 1];
      const ml = gray[i - 1], mr = gray[i + 1];
      const bl = gray[i + width - 1], bc = gray[i + width], br = gray[i + width + 1];
      const gx = tl + 2 * ml + bl - (tr + 2 * mr + br);
      const gy = tl + 2 * tc + tr - (bl + 2 * bc + br);
      mag[i] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  return mag;
}

/** Umbral con "puntos de referencia automáticos" (Otsu simple) o valor fijo del usuario. */
export function threshold(mag, width, height, manual = null) {
  let t = manual;
  if (t === null || t === undefined) {
    const hist = new Uint32Array(256);
    for (let i = 1; i < mag.length - 1; i++) hist[mag[i]]++;
    const total = mag.length;
    let sum = 0;
    for (let v = 0; v < 256; v++) sum += v * hist[v];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    let bestT = 128;
    for (let v = 0; v < 256; v++) {
      wB += hist[v];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += v * hist[v];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) {
        best = between;
        bestT = v;
      }
    }
    // En imágenes muy limpias Otsu baja demasiado: piso razonable.
    t = Math.max(bestT, 24);
  }
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = mag[i] >= t ? 1 : 0;
  return { mask, threshold: t };
}

/** Suaviza la línea: si 0 vecinos de línea, se apaga ruido suelto. */
export function denoiseMask(mask, width, height) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) n += mask[ny * width + nx];
        }
      }
      out[i] = n >= 2 ? 1 : 0;
    }
  }
  return out;
}

/** Umbral de Otsu sobre la magnitud de bordes (con piso: en imágenes limpias Otsu baja demasiado). */
function otsu(mag) {
  return threshold(mag, mag.length, 1, null).threshold;
}

/** Histéresis: se queda con lo fuerte (≥ high) y con lo débil (≥ low) que toca algo fuerte. */
export function hysteresis(mag, width, height, high, low) {
  const out = new Uint8Array(mag.length);
  const stack = [];
  for (let i = 0; i < mag.length; i++) {
    if (mag[i] >= high && !out[i]) {
      out[i] = 1;
      stack.push(i);
      while (stack.length) {
        const j = stack.pop();
        const x = j % width;
        const y = (j / width) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const k = ny * width + nx;
            if (!out[k] && mag[k] >= low) {
              out[k] = 1;
              stack.push(k);
            }
          }
        }
      }
    }
  }
  return out;
}

/** Engrosa la línea `times` píxeles (cierra huecos pequeños para que las zonas queden cerradas). */
export function thicken(mask, width, height, times) {
  let cur = mask;
  for (let t = 0; t < times; t++) {
    const out = cur.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (cur[i]) continue;
        if ((x > 0 && cur[i - 1]) || (x < width - 1 && cur[i + 1]) || (y > 0 && cur[i - width]) || (y < height - 1 && cur[i + width])) out[i] = 1;
      }
    }
    cur = out;
  }
  return cur;
}

/** Quita trocitos de línea más pequeños que `minSize` píxeles (polvo, textura de papel). */
export function removeSmall(mask, width, height, minSize) {
  const out = mask.slice();
  const seen = new Uint8Array(mask.length);
  const comp = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    comp.length = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      comp.push(j);
      const x = j % width;
      const y = (j / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const k = ny * width + nx;
          if (mask[k] && !seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
    }
    if (comp.length < minSize) for (const j of comp) out[j] = 0;
  }
  return out;
}

/**
 * Pipeline completo: RGBA de la foto → máscara de línea lista para colorear.
 * Opciones: { detail 0..1 (más = más líneas), thickness 1..4 }. Un número se acepta como umbral fijo (v1).
 */
export function photoToLineart(rgba, width, height, opts = null) {
  const g = grayscale(rgba, width, height);
  const b = blur(g, width, height);
  const m = sobel(b, width, height);
  if (opts === null || typeof opts === 'number') {
    const { mask, threshold: t } = threshold(m, width, height, opts);
    return { mask: denoiseMask(mask, width, height), threshold: t };
  }
  const detail = Math.min(1, Math.max(0, opts.detail ?? 0.5));
  const thickness = Math.min(4, Math.max(1, Math.round(opts.thickness ?? 2)));
  const high = Math.max(20, Math.round(otsu(m) * (1.6 - detail)));
  const strong = hysteresis(m, width, height, high, high * 0.5);
  const clean = removeSmall(strong, width, height, Math.max(24, Math.round(width * height * 0.0008)));
  return { mask: thicken(clean, width, height, thickness - 1), threshold: high };
}
