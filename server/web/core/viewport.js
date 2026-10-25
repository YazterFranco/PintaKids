/**
 * Zoom y desplazamiento del lienzo (coordenadas normalizadas 0..1 del elemento).
 * pantalla = lienzo · scale + t. Se limita para que el lienzo siempre cubra la vista.
 */

const MIN = 1;
const MAX = 5;

export function createViewport() {
  const v = {
    scale: 1,
    tx: 0,
    ty: 0,
    toCanvas(x, y) {
      return [(x - v.tx) / v.scale, (y - v.ty) / v.scale];
    },
    /** Dos dedos: de (a1, a2) a (b1, b2). Hace zoom y arrastre a la vez. */
    pinch(a1, a2, b1, b2) {
      const da = Math.hypot(a2[0] - a1[0], a2[1] - a1[1]) || 1e-6;
      const db = Math.hypot(b2[0] - b1[0], b2[1] - b1[1]);
      const ma = [(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2];
      const mb = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
      const [cx, cy] = v.toCanvas(ma[0], ma[1]);
      v.scale = Math.min(MAX, Math.max(MIN, v.scale * (db / da)));
      v.tx = mb[0] - cx * v.scale;
      v.ty = mb[1] - cy * v.scale;
      clamp();
    },
    reset() {
      v.scale = 1;
      v.tx = 0;
      v.ty = 0;
    },
  };
  function clamp() {
    v.tx = Math.min(0, Math.max(1 - v.scale, v.tx));
    v.ty = Math.min(0, Math.max(1 - v.scale, v.ty));
  }
  return v;
}
