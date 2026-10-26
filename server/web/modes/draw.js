/** Modo Dibujar (estilo Simple Draw): lienzo grande, barra lateral de pinceles, color, espejos y fondos. */

import { createSurface } from '../ui/surface.js';
import { ACTION_ICONS, iconBtn } from '../ui/parts.js';
import { bgIcon, shareIcon, zoomResetIcon, mirrorIcon, RAIL_ART, checkIcon } from '../ui/icons.js';
import { openColorPicker, pushRecent } from '../ui/colorpicker.js';
import { canvasBlob, shareBlob, squareThumb } from '../ui/share.js';
import { STAMP_SHAPES } from '../core/brushes.js';
import { deserializeStrokes, serializeStrokes } from '../core/strokes.js';

const RAIL = [
  'crayon', 'colorpencil', 'marker', 'watercolor', 'chalk', 'neon', 'glitter', 'spray', 'rainbow',
  'stamp', 'rect', 'ellipse', 'line', 'star', 'fill', 'picker', 'eraser',
];

const MIRRORS = ['off', 'v', 'h', 'quad', 'kaleido'];

/** Fondos: color base + capa opcional pintada bajo los trazos. */
const BACKGROUNDS = {
  white: { color: '#ffffff' },
  paper: { color: '#fbf6ea', underlay: paperTexture },
  board: { color: '#2f3e3a' },
  grid: { color: '#ffffff', underlay: gridLines },
  dots: { color: '#ffffff', underlay: dotGrid },
};

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store, sfx } = ctx;
  const root = document.getElementById('view-draw');
  if (root.__pkDraw) {
    // ya montado: solo recoger un borrador pendiente (p. ej. "abrir" desde Galería)
    await root.__pkDraw.restoreIfRequested();
    return;
  }
  root.replaceChildren();
  root.classList.add('draw-mode');

  let bgKey = 'white';
  let page = null; // { src, img } dibujo del catálogo como fondo
  let recents = Array.isArray(app.settings.recentColors) ? app.settings.recentColors : [];

  /* ---------- lienzo ---------- */
  const main = document.createElement('div');
  main.className = 'draw-main';
  const rail = document.createElement('div');
  rail.className = 'draw-rail';
  rail.setAttribute('role', 'toolbar');
  rail.setAttribute('aria-orientation', 'vertical');
  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  main.append(rail, wrap);

  const surface = createSurface(wrap, {
    underlay: (c, w, h) => {
      BACKGROUNDS[bgKey].underlay?.(c, w, h);
      if (page?.img?.complete) drawPage(c, page.img, w, h);
    },
    onStroke: () => refresh(),
    onPickColor: (hex) => setColor(hex),
    onZoom: (s) => (zoomBtn.hidden = s <= 1.01),
  });
  surface.state.tool = 'crayon';
  surface.state.size = 14;

  /* ---------- barra superior ---------- */
  const top = document.createElement('div');
  top.className = 'draw-top';
  const undoBtn = iconBtn(ACTION_ICONS.undo, app.t('draw.undo'), () => surface.undo());
  undoBtn.dataset.testid = 'undo';
  const redoBtn = iconBtn(ACTION_ICONS.redo, app.t('draw.redo'), () => surface.redo());
  const mirrorBtn = iconBtn(mirrorIcon, app.t('draw.mirror'), () => openMirror());
  mirrorBtn.dataset.testid = 'mirror-btn';
  const bgBtn = iconBtn(bgIcon, app.t('draw.bg'), () => openBackgrounds());
  const zoomBtn = iconBtn(zoomResetIcon, app.t('draw.zoomReset'), () => {
    surface.resetView();
    zoomBtn.hidden = true;
  });
  zoomBtn.hidden = true;
  const clearBtn = iconBtn(ACTION_ICONS.clear, app.t('draw.clear'), () => {
    if (surface.strokes.length && !confirm(app.t('draw.confirmClear'))) return;
    surface.clear();
  });
  clearBtn.dataset.testid = 'clear';
  const shareBtn = iconBtn(shareIcon, app.t('draw.share'), share);
  const spacer = document.createElement('span');
  spacer.className = 'spacer';
  const saveBtn = iconBtn(checkIcon + `<small>${app.t('draw.save')}</small>`, app.t('draw.save'), save, 'toolbtn save');
  saveBtn.dataset.testid = 'save';
  for (const b of [undoBtn, redoBtn, mirrorBtn, bgBtn, zoomBtn, clearBtn, shareBtn]) b.classList.add('slim');
  top.append(undoBtn, redoBtn, mirrorBtn, bgBtn, zoomBtn, clearBtn, spacer, shareBtn, saveBtn);

  /* ---------- barra lateral de herramientas ---------- */
  const toolBtns = new Map();
  for (const tool of RAIL) {
    const b = iconBtn(RAIL_ART[tool], app.t(`draw.tool.${tool}`), () => selectTool(tool));
    b.dataset.testid = `tool-${tool}`;
    b.setAttribute('aria-label', app.t(`draw.tool.${tool}`));
    b.setAttribute('aria-pressed', String(tool === surface.state.tool));
    if (tool === 'stamp' || tool === 'rect' || tool === 'fill') b.classList.add('rail-gap');
    toolBtns.set(tool, b);
    rail.appendChild(b);
  }

  function selectTool(tool) {
    const again = surface.state.tool === tool;
    surface.state.tool = tool;
    for (const [k, b] of toolBtns) b.setAttribute('aria-pressed', String(k === tool));
    sfx.play('tap');
    if (tool === 'picker') toast(app.t('draw.pickerHint'));
    if (tool === 'fill') toast(app.t('draw.fillHint'));
    if (tool === 'stamp' || again) openToolSheet(tool);
  }

  /* ---------- barra inferior: color + recientes + grosor ---------- */
  const bottom = document.createElement('div');
  bottom.className = 'draw-bottom';
  const colorBtn = document.createElement('button');
  colorBtn.type = 'button';
  colorBtn.className = 'color-btn';
  colorBtn.dataset.testid = 'color-btn';
  colorBtn.setAttribute('aria-label', app.t('draw.color'));
  colorBtn.addEventListener('click', () =>
    openColorPicker({ current: surface.state.color, recents, t: app.t, onPick: setColor }),
  );
  const recentRow = document.createElement('div');
  recentRow.className = 'recent-colors';
  const size = document.createElement('input');
  size.type = 'range';
  size.min = '2';
  size.max = '60';
  size.value = String(surface.state.size);
  size.className = 'size-slider';
  size.setAttribute('aria-label', app.t('draw.size'));
  const sizeDot = document.createElement('span');
  sizeDot.className = 'size-preview';
  size.addEventListener('input', () => {
    surface.state.size = Number(size.value);
    paintSizeDot();
  });
  const sizeBox = document.createElement('div');
  sizeBox.className = 'sizes';
  sizeBox.append(sizeDot, size);
  bottom.append(colorBtn, recentRow, sizeBox);

  function paintSizeDot() {
    const d = Math.max(6, Math.min(30, surface.state.size * 0.6));
    sizeDot.style.width = sizeDot.style.height = d + 'px';
    sizeDot.style.background = surface.state.color;
  }

  function setColor(hex) {
    surface.state.color = hex;
    colorBtn.style.background = hex;
    colorBtn.dataset.color = hex;
    recents = pushRecent(recents, hex);
    app.settings.recentColors = recents;
    store.setSetting('recentColors', recents);
    renderRecents();
    paintSizeDot();
  }

  function renderRecents() {
    recentRow.replaceChildren();
    for (const hex of recents.slice(0, 6)) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'swatch';
      d.style.background = hex;
      d.dataset.color = hex;
      d.setAttribute('aria-label', 'color ' + hex);
      d.setAttribute('aria-pressed', String(hex === surface.state.color));
      d.addEventListener('click', () => setColor(hex));
      recentRow.appendChild(d);
    }
  }

  /* ---------- hojas emergentes ---------- */
  function sheet(titleKey, build) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    const el = document.createElement('div');
    el.className = 'sheet';
    const h = document.createElement('h3');
    h.className = 'sheet-title';
    h.textContent = app.t(titleKey);
    el.appendChild(h);
    const close = () => {
      backdrop.remove();
      el.remove();
    };
    backdrop.addEventListener('click', close);
    build(el, close);
    document.body.append(backdrop, el);
    return close;
  }

  function openMirror() {
    sheet('draw.mirror', (el, close) => {
      const row = document.createElement('div');
      row.className = 'sheet-options';
      for (const m of MIRRORS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'option';
        b.dataset.mirror = m;
        b.setAttribute('aria-pressed', String((surface.mirror || 'off') === m));
        b.innerHTML = `${mirrorPreview(m)}<small>${app.t('draw.mirror.' + m)}</small>`;
        b.addEventListener('click', () => {
          surface.setMirror(m === 'off' ? false : m);
          mirrorBtn.setAttribute('aria-pressed', String(m !== 'off'));
          surface.present();
          close();
        });
        row.appendChild(b);
      }
      el.appendChild(row);
    });
  }

  function openBackgrounds() {
    sheet('draw.bg', (el, close) => {
      const row = document.createElement('div');
      row.className = 'sheet-options';
      for (const [key, bg] of Object.entries(BACKGROUNDS)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'option';
        b.setAttribute('aria-pressed', String(key === bgKey && !page));
        const sw = document.createElement('canvas');
        sw.width = sw.height = 56;
        sw.className = 'bg-preview';
        const c = sw.getContext('2d');
        c.fillStyle = bg.color;
        c.fillRect(0, 0, 56, 56);
        bg.underlay?.(c, 56, 56);
        b.append(sw);
        b.insertAdjacentHTML('beforeend', `<small>${app.t('draw.bg.' + key)}</small>`);
        b.addEventListener('click', () => {
          setBackground(key, null);
          close();
        });
        row.appendChild(b);
      }
      el.appendChild(row);
      const pages = document.createElement('div');
      pages.className = 'page-grid';
      const ph = document.createElement('h3');
      ph.className = 'sheet-title';
      ph.textContent = app.t('draw.bg.page');
      el.append(ph, pages);
      fillPages(pages, close);
    });
  }

  async function fillPages(grid, close) {
    try {
      const cat = await fetch('/v1/catalog?v=9').then((r) => r.json());
      for (const pack of cat.packs.slice(0, 4)) {
        const data = await fetch(`/v1/catalog/${pack.id}?v=9`).then((r) => r.json());
        for (const f of data.files.slice(0, 6)) {
          const src = `/v1/catalog/${pack.id}/files/${f.file}?v=9`;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'page-card-btn';
          b.innerHTML = `<img alt="" loading="lazy" src="${src}">`;
          b.setAttribute('aria-label', f.title);
          b.addEventListener('click', () => {
            setBackground('white', { src });
            close();
          });
          grid.appendChild(b);
        }
      }
    } catch {
      /* sin catálogo: solo fondos lisos */
    }
  }

  function setBackground(key, pageRef) {
    bgKey = BACKGROUNDS[key] ? key : 'white';
    wrap.style.background = BACKGROUNDS[bgKey].color;
    page = null;
    if (pageRef?.src) {
      const img = new Image();
      img.onload = () => surface.present();
      img.src = pageRef.src;
      page = { src: pageRef.src, img };
    }
    if (bgKey === 'board' && surface.state.color === '#6c5ce7') setColor('#ffffff');
    surface.present();
    scheduleDraft();
  }

  function openToolSheet(tool) {
    sheet(`draw.tool.${tool}`, (el, close) => {
      if (tool === 'stamp') {
        const row = document.createElement('div');
        row.className = 'sheet-options';
        for (const name of Object.keys(STAMP_SHAPES)) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'option';
          b.setAttribute('aria-pressed', String(surface.state.stamp === name));
          const cv = document.createElement('canvas');
          cv.width = cv.height = 48;
          const c = cv.getContext('2d');
          c.translate(24, 24);
          c.fillStyle = surface.state.color;
          STAMP_SHAPES[name](c, 40);
          b.appendChild(cv);
          b.addEventListener('click', () => {
            surface.state.stamp = name;
            close();
          });
          row.appendChild(b);
        }
        el.appendChild(row);
      }
      const op = document.createElement('label');
      op.className = 'sheet-slider';
      op.innerHTML = `<span>${app.t('draw.opacity')}</span>`;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '10';
      input.max = '100';
      input.value = String(Math.round(surface.state.opacity * 100));
      input.addEventListener('input', () => (surface.state.opacity = Number(input.value) / 100));
      op.appendChild(input);
      el.appendChild(op);
    });
  }

  /* ---------- guardar, compartir, autoguardado ---------- */
  function refresh() {
    undoBtn.disabled = !surface.canUndo();
    redoBtn.disabled = !surface.canRedo();
    scheduleDraft();
  }

  let draftTimer = 0;
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const draft = { strokes: serializeStrokes(surface.strokes), bg: bgKey, page: page?.src ?? null };
      app.settings.drawDraft = draft;
      store.setSetting('drawDraft', draft);
    }, 800);
  }

  function snapshot() {
    return surface.toCanvas(surface.canvas.width, surface.canvas.height, BACKGROUNDS[bgKey].color);
  }

  async function save() {
    if (!surface.strokes.length) return toast(app.t('draw.empty.hint'));
    const img = snapshot();
    await store.putItem({
      id: 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: 'drawing',
      name: app.t('draw.title'),
      strokes: serializeStrokes(surface.strokes),
      thumb: squareThumb(img, 300, BACKGROUNDS[bgKey].color),
      png: img.toDataURL('image/png'),
      bg: BACKGROUNDS[bgKey].color,
      bgKey,
      page: page?.src ?? null,
    });
    addStar();
    toast(app.t('draw.saved'));
  }

  async function share() {
    if (!surface.strokes.length) return;
    const blob = await canvasBlob(snapshot());
    if (blob) await shareBlob(blob, 'pintakids', toast);
  }

  async function restoreDraft() {
    const draft = (await store.getSettings()).drawDraft;
    if (!draft) return;
    const st = deserializeStrokes(draft.strokes ?? '[]');
    setBackground(draft.bg ?? 'white', draft.page ? { src: draft.page } : null);
    if (st.ok) surface.load(st.strokes);
    refresh();
  }

  root.__pkDraw = {
    async restoreIfRequested() {
      if (!app.settings.drawOpenRequest) return;
      app.settings.drawOpenRequest = false;
      await restoreDraft();
    },
  };

  root.append(top, main, bottom);
  setColor(recents[0] ?? '#6c5ce7');
  setBackground('white', null);
  await restoreDraft();
  app.settings.drawOpenRequest = false;
  refresh();
  applyI18n(root);
}

/* ---------- fondos procedurales (deterministas, sin imágenes) ---------- */
function paperTexture(c, w, h) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  c.save();
  c.fillStyle = 'rgba(120, 90, 40, 0.05)';
  const n = Math.round((w * h) / 90);
  for (let i = 0; i < n; i++) c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1);
  c.restore();
}

function gridLines(c, w, h) {
  const step = Math.max(8, Math.round(Math.min(w, h) / 18));
  c.save();
  c.strokeStyle = 'rgba(9, 132, 227, 0.16)';
  c.lineWidth = Math.max(1, step / 30);
  c.beginPath();
  for (let x = step; x < w; x += step) {
    c.moveTo(x, 0);
    c.lineTo(x, h);
  }
  for (let y = step; y < h; y += step) {
    c.moveTo(0, y);
    c.lineTo(w, y);
  }
  c.stroke();
  c.restore();
}

function dotGrid(c, w, h) {
  const step = Math.max(8, Math.round(Math.min(w, h) / 18));
  c.save();
  c.fillStyle = 'rgba(45, 52, 54, 0.22)';
  for (let x = step; x < w; x += step) for (let y = step; y < h; y += step) c.fillRect(x - 1, y - 1, Math.max(2, step / 12), Math.max(2, step / 12));
  c.restore();
}

function drawPage(c, img, w, h) {
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight) * 0.94;
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function mirrorPreview(m) {
  const lines = {
    off: '',
    v: '<path d="M24 4v40" stroke-dasharray="3 3"/>',
    h: '<path d="M4 24h40" stroke-dasharray="3 3"/>',
    quad: '<path d="M24 4v40M4 24h40" stroke-dasharray="3 3"/>',
    kaleido: '<path d="M24 4v40M7 14l34 20M7 34l34-20" stroke-dasharray="3 3"/>',
  };
  return `<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <rect x="4" y="4" width="40" height="40" rx="8" stroke-opacity=".35"/>${lines[m]}</svg>`;
}
