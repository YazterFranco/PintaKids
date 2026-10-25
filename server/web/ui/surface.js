/** Superficie de dibujo reutilizable (lienzo + punteros + deshacer). Usada por Dibujar, Cuentos y Aprender. */

import { addPoint, cloneStroke, makeStroke, SHAPE_TOOLS } from '../core/strokes.js';
import { createHistory } from '../core/history.js';
import { paintAll, paintStroke, renderToCanvas } from '../core/paint.js';

export function createSurface(wrap, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'lienzo');
  wrap.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const history = createHistory([]);
  let live = null;
  let mirror = false;

  const state = {
    tool: 'crayon',
    color: '#ff8fab',
    size: 14,
    stamp: '⭐',
  };

  function fit() {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(50, Math.round(r.width * dpr));
    const h = Math.max(50, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      redraw();
    }
    opts.onSize?.(w, h);
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (opts.paint) {
      opts.paint(ctx, history.strokes, live, canvas.width, canvas.height);
      return;
    }
    paintAll(ctx, history.strokes, canvas.width, canvas.height);
    if (live) {
      paintStroke(ctx, live, canvas.width, canvas.height);
      if (live.m) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        paintStroke(ctx, live, canvas.width, canvas.height);
        ctx.restore();
      }
    }
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (mirror && x < 0.5) x = 1 - x;
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    if (state.tool === 'picker') {
      const px = ctx.getImageData(Math.round(x * (canvas.width - 1)), Math.round(y * (canvas.height - 1)), 1, 1).data;
      if (px[3] > 8) {
        const hex = '#' + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
        state.color = hex;
        opts.onPickColor?.(hex);
      }
      return;
    }
    if (state.tool === 'fill') {
      commit(makeStroke('fill', state.color, state.size, [x, y], mirror));
      opts.onStroke?.();
      return;
    }
    live = makeStroke(state.tool, state.color, state.size * (canvas.width / 400), [x, y], mirror);
    if (SHAPE_TOOLS.includes(state.tool)) {
      live.p = [x, y, x, y];
      redraw();
      return;
    }
    if (state.tool === 'stamp') {
      live.ch = state.stamp;
      commit(live);
      live = null;
      opts.onStroke?.();
      return;
    }
    const p = e.pressure && e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 1;
    live.s = live.s * (0.5 + p / 2);
    redraw();
    opts.onStrokeStart?.();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!live) return;
    const [x, y] = pos(e);
    if (SHAPE_TOOLS.includes(live.t)) {
      live.p[2] = x;
      live.p[3] = y;
      redraw();
      return;
    }
    const last = [live.p[live.p.length - 2], live.p[live.p.length - 1]];
    if (Math.hypot(x - last[0], y - last[1]) < 0.003) return;
    addPoint(live, x, y);
    redraw();
  });

  const end = () => {
    if (!live) return;
    const s = live;
    live = null;
    if (SHAPE_TOOLS.includes(s.t)) {
      if (Math.hypot(s.p[2] - s.p[0], s.p[3] - s.p[1]) > 0.01) commit(s);
      else redraw();
    } else if (s.p.length >= 4 || s.t === 'spray' || s.t === 'glitter') commit(s);
    else redraw();
    opts.onStroke?.();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function commit(stroke) {
    history.set([...history.strokes, stroke]);
    redraw();
  }

  const ro = new ResizeObserver(fit);
  ro.observe(wrap);
  fit();

  return {
    canvas,
    state,
    history,
    redraw,
    get strokes() {
      return history.strokes;
    },
    set mirror(v) {
      mirror = Boolean(v);
    },
    get mirror() {
      return mirror;
    },
    load(strokes) {
      history.reset(strokes.map(cloneStroke));
      redraw();
    },
    undo() {
      history.undo();
      redraw();
    },
    redo() {
      history.redo();
      redraw();
    },
    clear() {
      history.reset([]);
      redraw();
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    toCanvas: (w, h, bg = '#ffffff') => renderToCanvas(history.strokes, w, h, bg),
    destroy() {
      ro.disconnect();
      canvas.remove();
    },
  };
}
