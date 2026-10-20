/** Modo Dibujar: lienzo libre con pinceles, formas, balde, cuentagotas, espejo y guardado. */

import { createSurface } from '../ui/surface.js';
import { paletteRow, sizesRow, toolbar, TOOL_ICONS, ACTION_ICONS, iconBtn, toolIconBtn } from '../ui/parts.js';
import { serializeStrokes } from '../core/strokes.js';
import { thumbnail } from '../core/paint.js';

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store } = ctx;
  const root = document.getElementById('view-draw');
  root.replaceChildren();

  // Estado vacío kawaii si no hay trazos todavía
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.innerHTML = `
    <div class="empty-icon">✏️</div>
    <h2 data-i18n="draw.empty.title">¡Dibuja lo que quieras!</h2>
    <p data-i18n="draw.empty.hint">Elige un pincel y empieza a crear en el lienzo.</p>
  `;
  root.appendChild(emptyState);

  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  root.appendChild(wrap);

  let bg = '#ffffff';
  const surface = createSurface(wrap, {
    onStroke: () => {
      emptyState.hidden = true;
      refresh();
    },
    onPickColor: (hex) => toast(hex),
  });
  surface.state.tool = 'crayon';

  const TOOLS = ['crayon', 'marker', 'pencil', 'watercolor', 'glitter', 'spray', 'rainbow', 'rect', 'ellipse', 'line', 'star', 'fill', 'picker', 'eraser', 'stamp'];

  const toolBtns = [];
  const toolRow = toolbar();
  toolRow.classList.add('toolstrip');
  for (const tool of TOOLS) {
    const b = toolIconBtn(TOOL_ICONS[tool], app.t(`draw.tool.${tool}`), tool, (el) => {
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
    const stamps = ['⭐', '❤️', '🌸', '🦋', '😊', '🍎', '🚗', '🐟'];
    stampIdx = (stampIdx + 1) % stamps.length;
    surface.state.stamp = stamps[stampIdx];
    toast(surface.state.stamp);
  }

  const swatches = paletteRow((c) => (surface.state.color = c));
  root.appendChild(toolbar(swatches, sizesRow((s) => (surface.state.size = s))));

  // Fondo del lienzo (blanco / crema / pizarra).
  const BGS = [['#ffffff', 'Blanco'], ['#fff8ec', 'Crema'], ['#22303f', 'Pizarra']];
  const bgBtns = [];
  const bgRow = toolbar();
  bgRow.classList.add('bgrow');
  for (const [hex, label] of BGS) {
    const swatch = document.createElement('button');
    swatch.className = 'toolbtn bg-swatch';
    swatch.innerHTML = `<span class="bg-dot" style="background:${hex}"></span><small>${label}</small>`;
    swatch.title = label;
    swatch.setAttribute('aria-pressed', String(hex === '#ffffff'));
    swatch.addEventListener('click', () => {
      bg = hex;
      wrap.style.background = hex;
      bgBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === swatch)));
    });
    bgBtns.push(swatch);
    bgRow.appendChild(swatch);
  }
  const label = document.createElement('small');
  label.className = 'bg-label';
  label.setAttribute('data-i18n', 'draw.bg');
  bgRow.prepend(label);

  function refresh() {
    undoBtn.disabled = !surface.canUndo();
    redoBtn.disabled = !surface.canRedo();
  }

  const undoBtn = iconBtn(ACTION_ICONS.undo, 'Deshacer', () => surface.undo());
  undoBtn.setAttribute('data-testid', 'undo');
  const redoBtn = iconBtn(ACTION_ICONS.redo, 'Rehacer', () => surface.redo());
  const mirrorBtn = iconBtn(ACTION_ICONS.mirror, 'Espejo', () => {
    surface.mirror = !surface.mirror;
    mirrorBtn.setAttribute('aria-pressed', String(surface.mirror));
  });
  mirrorBtn.setAttribute('aria-pressed', 'false');
  const exportBtn = iconBtn(ACTION_ICONS.export, 'Exportar PNG', exportPng);
  const clearBtn = iconBtn(ACTION_ICONS.clear, 'Borrar todo', () => {
    if (surface.strokes.length && !confirm(app.t('draw.confirmClear'))) return;
    surface.clear();
    emptyState.hidden = false;
  });
  const saveBtn = iconBtn(ACTION_ICONS.save, 'Guardar', save, 'toolbtn big');

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
