/**
 * Superficie de dibujo reutilizable (Dibujar, Cuentos, Dibuja conmigo).
 * - Los trazos confirmados viven en un canvas de caché; por frame solo se repinta el trazo vivo.
 * - Un dedo dibuja; dos dedos hacen zoom/arrastre (cancela el trazo en curso).
 * - Espejos: false | 'v' | 'h' | 'quad' | 'kaleido'.
 */

import { addPoint, cloneStroke, makeStroke, SHAPE_TOOLS } from '../core/strokes.js';
import { createHistory } from '../core/history.js';
import { paintAll, paintMirrored } from '../core/paint.js';
import { createViewport } from '../core/viewport.js';

export function createSurface(wrap, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', opts.label ?? 'lienzo');
  wrap.appendChild(canvas);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = document.createElement('canvas');
  const cctx = cache.getContext('2d', { willReadFrequently: true });
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');

  const history = createHistory([]);
  const view = createViewport();
  const listeners = new Set();
  let live = null;
  let mirror = false;
  let frame = 0;

  const state = { tool: 'crayon', color: '#6c5ce7', size: 14, opacity: 1, stamp: 'star' };

  function fit() {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(50, Math.round(r.width * dpr));
    const h = Math.max(50, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      for (const c of [canvas, cache, scratch]) {
        c.width = w;
        c.height = h;
      }
      rebuild();
    }
    opts.onSize?.(w, h);
  }

  /** Re-pinta la caché completa (tras deshacer, cargar, redimensionar). */
  function rebuild() {
    cctx.clearRect(0, 0, cache.width, cache.height);
    paintAll(cctx, history.strokes, cache.width, cache.height);
    present();
  }

  function present() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (opts.paint) {
      // modo heredado: el modo pinta todo él mismo
      opts.paint(ctx, history.strokes, live, w, h);
      return;
    }
    ctx.setTransform(view.scale, 0, 0, view.scale, view.tx * w, view.ty * h);
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, w, h);
    }
    opts.underlay?.(ctx, w, h);
    if (live) {
      sctx.clearRect(0, 0, w, h);
      sctx.drawImage(cache, 0, 0);
      paintMirrored(sctx, live, w, h);
      ctx.drawImage(scratch, 0, 0);
    } else {
      ctx.drawImage(cache, 0, 0);
    }
    opts.overlay?.(ctx, w, h);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      present();
    });
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const [x, y] = view.toCanvas((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  }

  function screenPos(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  const pointers = new Map();

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, screenPos(e));
    if (pointers.size === 2) {
      // segundo dedo: era un gesto, no un trazo
      live = null;
      present();
      return;
    }
    if (pointers.size > 2) return;
    const [x, y] = pos(e);
    if (state.tool === 'picker') {
      const [sx, sy] = screenPos(e);
      const px = ctx.getImageData(Math.round(sx * (canvas.width - 1)), Math.round(sy * (canvas.height - 1)), 1, 1).data;
      if (px[3] > 8) {
        const hex = '#' + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
        state.color = hex;
        opts.onPickColor?.(hex);
      }
      return;
    }
    if (state.tool === 'fill') {
      commit(makeStroke('fill', state.color, state.size, [x, y], mirror));
      return;
    }
    const scale = Math.min(canvas.width, canvas.height) / 400 / view.scale;
    live = makeStroke(state.tool, state.color, state.size * scale, [x, y], mirror);
    if (state.opacity < 1) live.o = state.opacity;
    if (SHAPE_TOOLS.includes(state.tool)) {
      live.p = [x, y, x, y];
      schedule();
      return;
    }
    if (state.tool === 'stamp') {
      live.ch = state.stamp;
      const s = live;
      live = null;
      commit(s);
      return;
    }
    const p = e.pressure && e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 1;
    live.s = live.s * (0.5 + p / 2);
    schedule();
    opts.onStrokeStart?.();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const now = screenPos(e);
    if (pointers.size === 2) {
      const [otherId] = [...pointers.keys()].filter((id) => id !== e.pointerId);
      const other = pointers.get(otherId);
      view.pinch(prev, other, now, other);
      pointers.set(e.pointerId, now);
      opts.onZoom?.(view.scale);
      present();
      return;
    }
    pointers.set(e.pointerId, now);
    if (!live) return;
    const [x, y] = pos(e);
    if (SHAPE_TOOLS.includes(live.t)) {
      live.p[2] = x;
      live.p[3] = y;
      schedule();
      return;
    }
    const lx = live.p[live.p.length - 2];
    const ly = live.p[live.p.length - 1];
    if (Math.hypot(x - lx, y - ly) < 0.002 / view.scale) return;
    addPoint(live, x, y);
    schedule();
  });

  const end = (e) => {
    pointers.delete(e.pointerId);
    if (!live) return;
    const s = live;
    live = null;
    if (SHAPE_TOOLS.includes(s.t)) {
      if (Math.hypot(s.p[2] - s.p[0], s.p[3] - s.p[1]) > 0.01) return commit(s);
      return present();
    }
    commit(s);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function changed() {
    opts.onStroke?.();
    for (const fn of listeners) fn(history.strokes);
  }

  function commit(stroke) {
    history.set([...history.strokes, stroke]);
    paintMirrored(cctx, stroke, cache.width, cache.height);
    present();
    changed();
  }

  const ro = new ResizeObserver(fit);
  ro.observe(wrap);
  fit();

  return {
    canvas,
    state,
    history,
    view,
    redraw: rebuild,
    present,
    get strokes() {
      return history.strokes;
    },
    set mirror(v) {
      mirror = v === true ? 'v' : v || false;
    },
    get mirror() {
      return mirror;
    },
    setMirror(mode) {
      mirror = mode || false;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    load(strokes) {
      history.reset(strokes.map(cloneStroke));
      rebuild();
    },
    undo() {
      history.undo();
      rebuild();
      changed();
    },
    redo() {
      history.redo();
      rebuild();
      changed();
    },
    clear() {
      history.reset([]);
      rebuild();
      changed();
    },
    resetView() {
      view.reset();
      present();
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    /** Imagen del dibujo (sin zoom) escalada a w×h, con fondo y capa inferior. */
    toCanvas(w = canvas.width, h = canvas.height, bg = opts.background ?? '#ffffff') {
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const o = out.getContext('2d');
      o.fillStyle = bg;
      o.fillRect(0, 0, w, h);
      o.save();
      o.scale(w / canvas.width, h / canvas.height);
      opts.underlay?.(o, canvas.width, canvas.height);
      o.drawImage(cache, 0, 0);
      o.restore();
      return out;
    },
    setBackground(bg) {
      opts.background = bg;
      present();
    },
    setUnderlay(fn) {
      opts.underlay = fn;
      present();
    },
    destroy() {
      ro.disconnect();
      canvas.remove();
    },
  };
}
