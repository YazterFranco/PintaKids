/** Modo Dibujar: lienzo libre con pinceles, formas, balde, cuentagotas, espejo y guardado. */

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

  let bg = '#ffffff';
  const surface = createSurface(wrap, {
    onStroke: () => refresh(),
    onPickColor: (hex) => toast(hex),
  });
  surface.state.tool = 'crayon';

  const TOOLS = [
    ['crayon', '🖍️'],
    ['marker', '🖊️'],
    ['pencil', '✏️'],
    ['watercolor', '💧'],
    ['glitter', '✨'],
    ['spray', '🫧'],
    ['rainbow', '🌈'],
    ['rect', '⬜'],
    ['ellipse', '⭕'],
    ['line', '📏'],
    ['star', '🌟'],
    ['fill', '🪣'],
    ['picker', '🎯'],
    ['eraser', '🧽'],
    ['stamp', '⭐'],
  ];

  const toolBtns = [];
  const toolRow = toolbar();
  toolRow.classList.add('toolstrip');
  for (const [tool, emoji] of TOOLS) {
    const b = pressedButton(`<span>${emoji}</span><small data-i18n="draw.tool.${tool}">${tool}</small>`, tool, (el) => {
      surface.state.tool = tool;
      toolBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === el)));
      if (tool === 'stamp') chooseStamp();
      if (tool === 'picker') toast(app.t('draw.pickerHint'));
      if (tool === 'fill') toast(app.t('draw.fillHint'));
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

  const swatches = paletteRow((c) => (surface.state.color = c));
  root.appendChild(toolbar(swatches, sizesRow((s) => (surface.state.size = s))));

  // Fondo del lienzo (blanco / crema / pizarra), como en apps de dibujo clásicas.
  const BGS = [['#ffffff', '⬜'], ['#fff8ec', '🟨'], ['#22303f', '⬛']];
  const bgBtns = [];
  const bgRow = toolbar();
  bgRow.classList.add('bgrow');
  for (const [hex, emoji] of BGS) {
    const b = pressedButton(emoji, hex, (el) => {
      bg = hex;
      wrap.style.background = hex;
      bgBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === el)));
    });
    b.setAttribute('aria-pressed', String(hex === '#ffffff'));
    bgBtns.push(b);
    bgRow.appendChild(b);
  }
  const label = document.createElement('small');
  label.className = 'bg-label';
  label.setAttribute('data-i18n', 'draw.bg');
  bgRow.prepend(label);

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
  const exportBtn = btn('📤', exportPng);
  const clearBtn = btn('🗑️', () => {
    if (surface.strokes.length && !confirm(app.t('draw.confirmClear'))) return;
    surface.clear();
  });
  const saveBtn = btn('💾', save, 'toolbtn big');

  function exportPng() {
    if (!surface.strokes.length) return;
    const out = surface.toCanvas(1400, 1000, bg);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pintakids.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(app.t('draw.exported'));
    }, 'image/png');
  }

  async function save() {
    if (!surface.strokes.length) return;
    const item = {
      id: 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: 'drawing',
      name: app.t('draw.title'),
      strokes: serializeStrokes(surface.strokes),
      thumb: thumbnail(surface.strokes, 220, bg),
      bg,
    };
    await store.putItem(item);
    addStar();
    toast(app.t('draw.saved'));
  }

  root.appendChild(toolbar(bgRow, toolbar(undoBtn, redoBtn, mirrorBtn, exportBtn, clearBtn, saveBtn)));
  refresh();
  applyI18n(root);
}
