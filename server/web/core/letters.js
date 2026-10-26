/**
 * Letras y números para repasar: cada carácter es una lista de trazos en orden, con su sentido
 * (como se enseña a escribir en imprenta). Coordenadas 0..1 en un recuadro cuadrado.
 * letterSvg() los convierte en un SVG por pasos que usa el mismo motor de "Dibuja conmigo".
 */

const line = (...pts) => pts.flat();

/** Arco de elipse muestreado: ángulos en grados (0 = derecha, 90 = abajo; crecer = sentido horario). */
function arc(cx, cy, rx, ry, a0, a1, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push(+(cx + rx * Math.cos(a)).toFixed(4), +(cy + ry * Math.sin(a)).toFixed(4));
  }
  return out;
}
const join = (...parts) => parts.flat();

const OVAL = (rx = 0.25) => arc(0.5, 0.5, rx, 0.35, -90, -450, 40);

export const LETTERS = {
  A: { strokes: [line([0.5, 0.15], [0.27, 0.85]), line([0.5, 0.15], [0.73, 0.85]), line([0.36, 0.6], [0.64, 0.6])] },
  B: { strokes: [line([0.32, 0.15], [0.32, 0.85]), join(line([0.32, 0.15], [0.52, 0.15]), arc(0.52, 0.325, 0.18, 0.175, -90, 90), [0.32, 0.5]), join(line([0.32, 0.5], [0.55, 0.5]), arc(0.55, 0.675, 0.19, 0.175, -90, 90), [0.32, 0.85])] },
  C: { strokes: [arc(0.5, 0.5, 0.25, 0.35, -40, -320, 32)] },
  D: { strokes: [line([0.32, 0.15], [0.32, 0.85]), join(line([0.32, 0.15], [0.42, 0.15]), arc(0.42, 0.5, 0.28, 0.35, -90, 90, 28), [0.32, 0.85])] },
  E: { strokes: [line([0.33, 0.15], [0.33, 0.85]), line([0.33, 0.15], [0.68, 0.15]), line([0.33, 0.5], [0.62, 0.5]), line([0.33, 0.85], [0.68, 0.85])] },
  F: { strokes: [line([0.34, 0.15], [0.34, 0.85]), line([0.34, 0.15], [0.69, 0.15]), line([0.34, 0.5], [0.62, 0.5])] },
  G: { strokes: [arc(0.5, 0.5, 0.25, 0.35, -40, -335, 32), line([0.54, 0.56], [0.75, 0.56], [0.75, 0.8])] },
  H: { strokes: [line([0.3, 0.15], [0.3, 0.85]), line([0.7, 0.15], [0.7, 0.85]), line([0.3, 0.5], [0.7, 0.5])] },
  I: { strokes: [line([0.5, 0.15], [0.5, 0.85]), line([0.38, 0.15], [0.62, 0.15]), line([0.38, 0.85], [0.62, 0.85])] },
  J: { strokes: [join(line([0.62, 0.15], [0.62, 0.68]), arc(0.47, 0.68, 0.15, 0.17, 0, 180, 16)), line([0.48, 0.15], [0.76, 0.15])] },
  K: { strokes: [line([0.33, 0.15], [0.33, 0.85]), line([0.69, 0.15], [0.33, 0.53]), line([0.43, 0.43], [0.7, 0.85])] },
  L: { strokes: [line([0.36, 0.15], [0.36, 0.85], [0.68, 0.85])] },
  M: { strokes: [line([0.26, 0.85], [0.26, 0.15]), line([0.26, 0.15], [0.5, 0.6], [0.74, 0.15]), line([0.74, 0.15], [0.74, 0.85])] },
  N: { strokes: [line([0.3, 0.85], [0.3, 0.15]), line([0.3, 0.15], [0.7, 0.85]), line([0.7, 0.85], [0.7, 0.15])] },
  Ñ: { strokes: [line([0.3, 0.85], [0.3, 0.22]), line([0.3, 0.22], [0.7, 0.85]), line([0.7, 0.85], [0.7, 0.22]), arc(0.5, 0.11, 0.06, 0.035, 180, 360, 10).concat(arc(0.62, 0.11, 0.06, 0.035, 180, 0, 10).slice(2))] },
  O: { strokes: [OVAL()] },
  P: { strokes: [line([0.34, 0.15], [0.34, 0.85]), join(line([0.34, 0.15], [0.52, 0.15]), arc(0.52, 0.33, 0.18, 0.18, -90, 90), [0.34, 0.51])] },
  Q: { strokes: [OVAL(), line([0.56, 0.66], [0.77, 0.9])] },
  R: { strokes: [line([0.33, 0.15], [0.33, 0.85]), join(line([0.33, 0.15], [0.5, 0.15]), arc(0.5, 0.33, 0.18, 0.18, -90, 90), [0.33, 0.51]), line([0.47, 0.51], [0.7, 0.85])] },
  S: { strokes: [join(arc(0.5, 0.33, 0.2, 0.18, -30, -270, 20), arc(0.5, 0.67, 0.2, 0.18, -90, 150, 20))] },
  T: { strokes: [line([0.25, 0.15], [0.75, 0.15]), line([0.5, 0.15], [0.5, 0.85])] },
  U: { strokes: [join(line([0.3, 0.15], [0.3, 0.62]), arc(0.5, 0.62, 0.2, 0.23, 180, 0, 20), line([0.7, 0.62], [0.7, 0.15]))] },
  V: { strokes: [line([0.27, 0.15], [0.5, 0.85], [0.73, 0.15])] },
  W: { strokes: [line([0.2, 0.15], [0.34, 0.85], [0.5, 0.4], [0.66, 0.85], [0.8, 0.15])] },
  X: { strokes: [line([0.28, 0.15], [0.72, 0.85]), line([0.72, 0.15], [0.28, 0.85])] },
  Y: { strokes: [line([0.28, 0.15], [0.5, 0.5]), line([0.72, 0.15], [0.5, 0.5], [0.5, 0.85])] },
  Z: { strokes: [line([0.28, 0.15], [0.72, 0.15], [0.28, 0.85], [0.72, 0.85])] },
  0: { strokes: [OVAL(0.22)] },
  1: { strokes: [line([0.38, 0.28], [0.54, 0.15], [0.54, 0.85]), line([0.4, 0.85], [0.68, 0.85])] },
  2: { strokes: [join(arc(0.5, 0.35, 0.2, 0.2, 200, 390, 20), line([0.3, 0.85], [0.72, 0.85]))] },
  3: { strokes: [join(arc(0.5, 0.33, 0.19, 0.17, 200, 450, 22), arc(0.5, 0.67, 0.21, 0.18, 270, 520, 22))] },
  4: { strokes: [line([0.56, 0.15], [0.27, 0.62], [0.76, 0.62]), line([0.62, 0.36], [0.62, 0.85])] },
  5: { strokes: [join(line([0.37, 0.15], [0.35, 0.45]), arc(0.5, 0.63, 0.21, 0.21, 240, 520, 24)), line([0.37, 0.15], [0.69, 0.15])] },
  6: { strokes: [join(arc(0.5, 0.5, 0.21, 0.35, -60, -185, 14), arc(0.5, 0.66, 0.2, 0.19, 175, -180, 30))] },
  7: { strokes: [line([0.28, 0.15], [0.72, 0.15], [0.42, 0.85])] },
  8: { strokes: [arc(0.5, 0.32, 0.17, 0.16, -30, -390, 30), arc(0.5, 0.67, 0.2, 0.18, -90, 270, 30)] },
  9: { strokes: [arc(0.5, 0.35, 0.2, 0.19, 0, -360, 30), line([0.7, 0.35], [0.66, 0.85])] },
};

const fmt = (v) => Math.round(v * 400 * 10) / 10;

/** SVG por pasos (un paso por trazo) con punto de inicio y flecha de sentido. */
export function letterSvg(ch) {
  const L = LETTERS[ch];
  if (!L) throw new Error('letra-desconocida:' + ch);
  const groups = L.strokes
    .map((s, k) => {
      let d = `M${fmt(s[0])} ${fmt(s[1])}`;
      for (let i = 2; i < s.length; i += 2) d += ` L${fmt(s[i])} ${fmt(s[i + 1])}`;
      // flecha a ~22 % del trazo, apuntando en su sentido
      const j = Math.max(2, Math.round((s.length / 2) * 0.22) * 2);
      const [ax, ay, bx, by] = [s[j - 2], s[j - 1], s[j], s[j + 1]].map(fmt);
      const ang = Math.atan2(by - ay, bx - ax);
      const tip = (r, da) => `${(bx + r * Math.cos(ang + da)).toFixed(1)} ${(by + r * Math.sin(ang + da)).toFixed(1)}`;
      const arrow = `M${tip(18, Math.PI * 0.82)} L${bx} ${by} L${tip(18, -Math.PI * 0.82)}`;
      return `<g data-step="${k + 1}" data-name="trazo${k + 1}"><path d="${d}"/><path d="${arrow}" stroke-width="7"/><circle cx="${fmt(s[0])}" cy="${fmt(s[1])}" r="11" fill="#2b2d42" stroke="none"/></g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none" stroke="#2b2d42" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">${groups}</svg>`;
}
