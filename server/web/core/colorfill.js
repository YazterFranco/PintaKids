/**
 * Relleno por regiones y flood fill para "colorear sin salirse".
 * Todo opera sobre máscaras de píxeles planas (Uint8/Uint32): 100 % testeable en Node, sin canvas.
 */

/** `lineMask`: 1 si el píxel es línea (barrera). Devuelve etiquetas de región (Int32Array; -1 líneas). */
export function labelRegions(lineMask, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  let next = 0;
  const stack = new Int32Array(width * height);
  for (let start = 0; start < labels.length; start++) {
    if (lineMask[start] || labels[start] !== -1) continue;
    let top = 0;
    stack[top++] = start;
    labels[start] = next;
    while (top > 0) {
      const i = stack[--top];
      const x = i % width;
      const y = (i / width) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (lineMask[j] || labels[j] !== -1) continue;
        labels[j] = next;
        stack[top++] = j;
      }
    }
    next++;
  }
  return { labels, regionCount: next };
}

/** Pinta la región `region` con color RGBA sobre `out` (Uint8ClampedArray, 4 bytes/píxel). */
export function fillRegion(out, labels, region, rgba) {
  let count = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== region) continue;
    const o = i * 4;
    out[o] = rgba[0];
    out[o + 1] = rgba[1];
    out[o + 2] = rgba[2];
    out[o + 3] = rgba[3];
    count++;
  }
  return count;
}

/**
 * Relleno clásico con tolerancia de color (para dibujos sin máscara de línea, p. ej. foto→colorear).
 * Escaneo por líneas: sin recursión, sin desbordar el stack.
 */
export function floodFillTolerance(data, width, height, x, y, rgba, tolerance = 40) {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  const startIdx = y * width + x;
  const target = [data[startIdx * 4], data[startIdx * 4 + 1], data[startIdx * 4 + 2], data[startIdx * 4 + 3]];
  const isSame = (i) =>
    Math.abs(data[i * 4] - target[0]) <= tolerance &&
    Math.abs(data[i * 4 + 1] - target[1]) <= tolerance &&
    Math.abs(data[i * 4 + 2] - target[2]) <= tolerance &&
    Math.abs(data[i * 4 + 3] - target[3]) <= tolerance;
  const seen = new Uint8Array(width * height);
  const stack = [[x, y]];
  let count = 0;
  while (stack.length) {
    const [sx, sy] = stack.pop();
    let left = sx;
    while (left >= 0 && isSame(sy * width + left) && !seen[sy * width + left]) left--;
    left++;
    let right = sx;
    while (right < width && isSame(sy * width + right) && !seen[sy * width + right]) right++;
    right--;
    for (let xi = left; xi <= right; xi++) {
      const i = sy * width + xi;
      seen[i] = 1;
      data[i * 4] = rgba[0];
      data[i * 4 + 1] = rgba[1];
      data[i * 4 + 2] = rgba[2];
      data[i * 4 + 3] = rgba[3];
      count++;
      if (sy > 0) {
        const up = i - width;
        if (isSame(up) && !seen[up]) stack.push([xi, sy - 1]);
      }
      if (sy < height - 1) {
        const dn = i + width;
        if (isSame(dn) && !seen[dn]) stack.push([xi, sy + 1]);
      }
    }
  }
  return count;
}

/** Convierte RGBA cruda (render de SVG) en máscara de línea: alfa alto o poco brillantes. */
export function lineMaskFromRGBA(data, width, height, alphaThreshold = 100) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4;
    const dark = data[o] + data[o + 1] + data[o + 2] < 360;
    mask[i] = data[o + 3] >= alphaThreshold && dark ? 1 : 0;
  }
  return mask;
}

/** Cierra huecos de 1 px en la línea: el color no se escapa por rendijas de SVG anti-alias. */
export function dilateMask(mask, width, height) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) out[ny * width + nx] = 1;
      }
    }
  }
  return out;
}
