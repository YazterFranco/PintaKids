/** Modo Dibujar: lienzo libre con pinceles infantiles, espejo, undo/redo y guardado a galería. */

import { createSurface } from '../ui/surface.js';
import { btn, paletteRow, sizesRow, toolbar, pressedButton, STAMPS } from '../ui/parts.js';
import { serializeStrokes } from '../core/strokes.js';
import { thumbnail } from '../core/paint.js';

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store } = ctx;
  const root = document.getElementById('view-draw');
  root.replaceChildren();

  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  root.appendChild(wrap);

  const surface = createSurface(wrap, { onStroke: () => refresh() });
  surface.state.tool = 'crayon';

  const TOOLS = [
    ['crayon', '🖍️'],
    ['marker', '🖊️'],
    ['pencil', '✏️'],
    ['watercolor', '💧'],
    ['glitter', '✨'],
    ['spray', '🫧'],
    ['rainbow', '🌈'],
    ['eraser', '🧽'],
    ['stamp', '⭐'],
  ];

  const toolBtns = [];
  const toolRow = toolbar();
  for (const [tool, emoji] of TOOLS) {
    const b = pressedButton(`<span>${emoji}</span><small data-i18n="draw.tool.${tool}">${tool}</small>`, tool, (el) => {
      surface.state.tool = tool;
      toolBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === el)));
      if (tool === 'stamp') chooseStamp();
    });
    b.setAttribute('aria-pressed', String(tool === 'crayon'));
    toolBtns.push(b);
    toolRow.appendChild(b);
  }
  root.appendChild(toolRow);

  let stampIdx = 0;
  function chooseStamp() {
    stampIdx = (stampIdx + 1) % STAMPS.length;
    surface.state.stamp = STAMPS[stampIdx];
    toast(surface.state.stamp);
  }

  root.appendChild(toolbar(
    paletteRow((c) => (surface.state.color = c)),
    sizesRow((s) => (surface.state.size = s)),
  ));

  function refresh() {
    undoBtn.disabled = !surface.canUndo();
    redoBtn.disabled = !surface.canRedo();
  }

  const undoBtn = btn('↩️', () => surface.undo());
  const redoBtn = btn('↪️', () => surface.redo());
  const mirrorBtn = pressedButton('🪞', 'espejo', (el) => {
    surface.mirror = !surface.mirror;
    el.setAttribute('aria-pressed', String(surface.mirror));
  });
  const clearBtn = btn('🗑️', () => {
    if (surface.strokes.length && !confirm(app.t('draw.confirmClear'))) return;
    surface.clear();
  });
  const saveBtn = btn('💾', save, 'toolbtn big');

  async function save() {
    if (!surface.strokes.length) return;
    const item = {
      id: 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: 'drawing',
      name: app.t('draw.title'),
      strokes: serializeStrokes(surface.strokes),
      thumb: thumbnail(surface.strokes),
    };
    await store.putItem(item);
    addStar();
    toast(app.t('draw.saved'));
  }

  root.appendChild(toolbar(undoBtn, redoBtn, mirrorBtn, clearBtn, saveBtn));
  refresh();
  applyI18n(root);
}
