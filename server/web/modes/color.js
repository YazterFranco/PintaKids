/** Modo Colorear: biblioteca por paquete y nivel + balde con estilos + pinceles que no se salen de la zona. */

import { ACTION_ICONS, fitSquare, iconBtn } from '../ui/parts.js';
import { RAIL_ART, zoomResetIcon, checkIcon, shareIcon } from '../ui/icons.js';
import { KID_COLORS, openColorPicker, pushRecent } from '../ui/colorpicker.js';
import { celebrate } from '../ui/celebrate.js';
import { canvasBlob, shareBlob } from '../ui/share.js';
import { dilateMask, labelRegions, lineMaskFromRGBA } from '../core/colorfill.js';
import { FILL_KINDS, fillRegionStyled, regionWithRing } from '../core/fills.js';
import { paintBrush } from '../core/brushes.js';
import { createViewport } from '../core/viewport.js';

const RENDER = 640; // lienzo lógico: nítido en pantalla y rápido en móvil
const BRUSHES = ['crayon', 'colorpencil', 'marker', 'watercolor'];
const FILL_SWATCH = {
  solid: 'background: var(--fill-color)',
  gradient: 'background: linear-gradient(180deg, color-mix(in srgb, var(--fill-color) 40%, #fff), var(--fill-color))',
  dots: 'background: radial-gradient(circle, var(--fill-color) 30%, transparent 32%) 0 0 / 10px 10px, color-mix(in srgb, var(--fill-color) 38%, #fff)',
  stripes: 'background: repeating-linear-gradient(45deg, var(--fill-color) 0 5px, color-mix(in srgb, var(--fill-color) 38%, #fff) 5px 10px)',
  checks: 'background: repeating-conic-gradient(var(--fill-color) 0 25%, color-mix(in srgb, var(--fill-color) 38%, #fff) 0 50%) 0 0 / 14px 14px',
  stars: 'background: radial-gradient(circle, var(--fill-color) 22%, transparent 24%) 0 0 / 12px 12px, color-mix(in srgb, var(--fill-color) 38%, #fff)',
  magic: 'background: linear-gradient(135deg, #ff7675, #fdcb6e, #00b894, #0984e3, #6c5ce7)',
};

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store, sfx } = ctx;
  const root = document.getElementById('view-color');
  const incoming = ctx.pendingLineart ?? null; // Foto y Dibuja conmigo entregan aquí su línea
  if (incoming) ctx.pendingLineart = null;

  if (root.__pkColor) {
    if (incoming) await root.__pkColor.incoming(incoming);
    else root.__pkColor.refreshMine();
    return;
  }
  root.replaceChildren();
  const en = app.lang === 'en';
  const T = (f) => (en && f.title_en) || f.title;

  /* ---------- estado ---------- */
  let line = null;
  let lineCanvas = null;
  let labels = null;
  let bgLabels = null;
  let fillData = null;
  let undo = [];
  let redo = [];
  let current = { pack: '', file: '', title: '' };
  let color = KID_COLORS[0];
  let tool = 'fill'; // 'fill' | nombre de pincel
  let fillKind = 'solid';
  let brushSize = 26;
  let catalog = null;
  let packFiles = {}; // caché id → archivos
  let filter = { pack: null, level: '' };
  let recents = Array.isArray(app.settings.recentColors) ? app.settings.recentColors : [];

  /* ---------- biblioteca ---------- */
  const picker = document.createElement('div');
  picker.className = 'color-picker';
  const head = document.createElement('div');
  head.className = 'color-head';
  head.innerHTML = `<h2 id="color-title"></h2><p class="note"></p>`;
  head.querySelector('h2').textContent = app.t('color.pick');
  head.querySelector('p').textContent = app.t('color.tap');
  const packRow = document.createElement('div');
  packRow.className = 'packrow';
  const levelRow = document.createElement('div');
  levelRow.className = 'levelrow';
  for (const lv of ['', '1', '2', '3']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip small';
    b.dataset.level = lv;
    b.textContent = lv ? '★'.repeat(Number(lv)) : app.t('color.all');
    b.setAttribute('aria-pressed', String(lv === ''));
    b.setAttribute('aria-label', lv ? app.t('color.level' + lv) : app.t('color.all'));
    b.addEventListener('click', () => {
      filter.level = lv;
      levelRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      renderGrid();
    });
    levelRow.appendChild(b);
  }
  const grid = document.createElement('div');
  grid.className = 'grid';
  picker.append(head, packRow, levelRow, grid);

  /* ---------- vista de pintar ---------- */
  const paintView = document.createElement('div');
  paintView.className = 'color-paint';
  paintView.hidden = true;

  const top = document.createElement('div');
  top.className = 'color-top';
  const back = iconBtn(ACTION_ICONS.back, app.t('color.another'), openPicker);
  const titleEl = document.createElement('h2');
  const undoBtn = iconBtn(ACTION_ICONS.undo, app.t('draw.undo'), doUndo);
  undoBtn.dataset.testid = 'color-undo';
  const redoBtn = iconBtn(ACTION_ICONS.redo, app.t('draw.redo'), doRedo);
  redoBtn.dataset.testid = 'color-redo';
  const zoomBtn = iconBtn(zoomResetIcon, app.t('draw.zoomReset'), resetZoom);
  zoomBtn.hidden = true;
  const shareBtn = iconBtn(shareIcon, app.t('draw.share'), share);
  const saveBtn = iconBtn(checkIcon, app.t('draw.save'), save, 'toolbtn save');
  saveBtn.dataset.testid = 'color-save';
  top.append(back, titleEl, zoomBtn, undoBtn, redoBtn, shareBtn, saveBtn);

  const stage = document.createElement('div');
  stage.className = 'color-stage';
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'canvas-wrap';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RENDER;
  canvas.style.transformOrigin = '0 0';
  canvasWrap.appendChild(canvas);
  stage.appendChild(canvasWrap);
  const ctx2 = canvas.getContext('2d', { willReadFrequently: true });
  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = fillCanvas.height = RENDER;
  const fillCtx = fillCanvas.getContext('2d');
  const brushLayer = document.createElement('canvas');
  brushLayer.width = brushLayer.height = RENDER;
  const brushCtx = brushLayer.getContext('2d', { willReadFrequently: true });

  /* bandeja: colores + herramientas */
  const tray = document.createElement('div');
  tray.className = 'color-tray';
  const palette = document.createElement('div');
  palette.className = 'palette tray-palette';
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'swatch swatch-plus';
  plus.setAttribute('aria-label', app.t('draw.mix'));
  plus.addEventListener('click', () => openColorPicker({ current: color, recents, t: app.t, onPick: setColor }));
  for (const hex of KID_COLORS) palette.appendChild(swatch(hex));
  palette.appendChild(plus);

  const tools = document.createElement('div');
  tools.className = 'color-tools';
  const fillBtns = FILL_KINDS.map((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fill-btn';
    b.dataset.fill = k;
    b.setAttribute('aria-label', app.t('color.fill.' + k));
    b.title = app.t('color.fill.' + k);
    b.innerHTML = `<span style="${FILL_SWATCH[k]}"></span>`;
    b.addEventListener('click', () => {
      fillKind = k;
      setTool('fill');
    });
    return b;
  });
  const brushBtns = BRUSHES.map((name) => {
    const b = iconBtn(RAIL_ART[name], app.t('draw.tool.' + name), () => setTool(name));
    b.dataset.brush = name;
    b.classList.add('slim');
    return b;
  });
  const size = document.createElement('input');
  size.type = 'range';
  size.min = '8';
  size.max = '70';
  size.value = String(brushSize);
  size.className = 'size-slider';
  size.setAttribute('aria-label', app.t('draw.size'));
  size.addEventListener('input', () => (brushSize = Number(size.value)));
  const sep = document.createElement('span');
  sep.className = 'tool-sep';
  tools.append(...fillBtns, sep, ...brushBtns, size);
  tray.append(palette, tools);

  const body = document.createElement('div');
  body.className = 'color-body';
  body.append(stage, tray);
  paintView.append(top, body);
  root.append(picker, paintView);

  function swatch(hex) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'swatch';
    d.style.background = hex;
    d.dataset.color = hex;
    d.setAttribute('aria-label', 'color ' + hex);
    d.setAttribute('aria-pressed', String(hex === color));
    d.addEventListener('click', () => setColor(hex));
    return d;
  }

  function setColor(hex) {
    color = hex;
    palette.querySelectorAll('.swatch[data-color]').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.color === hex)));
    if (!KID_COLORS.includes(hex)) {
      plus.style.background = hex;
      recents = pushRecent(recents, hex);
      app.settings.recentColors = recents;
      store.setSetting('recentColors', recents);
    }
    tools.style.setProperty('--fill-color', hex);
    sfx.play('tap');
  }

  function setTool(t) {
    tool = t;
    fillBtns.forEach((b) => b.setAttribute('aria-pressed', String(t === 'fill' && b.dataset.fill === fillKind)));
    brushBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.brush === t)));
    size.hidden = t === 'fill';
  }

  /* ---------- lienzo cuadrado que llena el espacio ---------- */
  const fitStage = fitSquare(stage, canvasWrap).refit;

  /* ---------- preparar un dibujo ---------- */
  const loadImage = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width = off.height = RENDER;
        const c = off.getContext('2d', { willReadFrequently: true });
        const k = Math.min((RENDER * 0.92) / img.width, (RENDER * 0.92) / img.height);
        const dw = img.width * k;
        const dh = img.height * k;
        c.drawImage(img, (RENDER - dw) / 2, (RENDER - dh) / 2, dw, dh);
        resolve({ canvas: off, imageData: c.getImageData(0, 0, RENDER, RENDER) });
      };
      img.onerror = () => reject(new Error('imagen-no-cargo'));
      img.src = url;
    });

  function borderRegions(lbls, count) {
    const bg = new Uint8Array(count);
    const mark = (r) => r >= 0 && (bg[r] = 1);
    for (let i = 0; i < RENDER; i++) {
      mark(lbls[i]);
      mark(lbls[(RENDER - 1) * RENDER + i]);
      mark(lbls[i * RENDER]);
      mark(lbls[i * RENDER + RENDER - 1]);
    }
    return bg;
  }

  function prepare({ canvas: src, imageData }, meta) {
    line = imageData;
    // La línea se dibuja encima tal cual; el blanco del SVG se vuelve transparente para no tapar el color.
    lineCanvas = document.createElement('canvas');
    lineCanvas.width = lineCanvas.height = RENDER;
    const lc = lineCanvas.getContext('2d');
    const ink = new ImageData(new Uint8ClampedArray(imageData.data), RENDER, RENDER);
    for (let i = 0; i < ink.data.length; i += 4) {
      const lum = (ink.data[i] + ink.data[i + 1] + ink.data[i + 2]) / 3;
      ink.data[i + 3] = Math.round(ink.data[i + 3] * Math.min(1, Math.max(0, (235 - lum) / 120)));
    }
    lc.putImageData(ink, 0, 0);
    const mask = dilateMask(lineMaskFromRGBA(imageData.data, RENDER, RENDER), RENDER, RENDER);
    const r = labelRegions(mask, RENDER, RENDER);
    labels = r.labels;
    bgLabels = borderRegions(r.labels, r.regionCount);
    fillData = new Uint8ClampedArray(RENDER * RENDER * 4);
    undo = [];
    redo = [];
    current = meta;
    titleEl.textContent = meta.title;
    resetZoom();
    refreshButtons();
    paint();
  }

  function paint() {
    if (!lineCanvas || !fillData) return;
    fillCtx.putImageData(new ImageData(fillData, RENDER, RENDER), 0, 0);
    ctx2.fillStyle = '#ffffff';
    ctx2.fillRect(0, 0, RENDER, RENDER);
    ctx2.drawImage(fillCanvas, 0, 0);
    ctx2.drawImage(lineCanvas, 0, 0);
  }

  let queued = false;
  const queuePaint = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint();
    });
  };

  const rgba = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  };

  function snapshot() {
    undo.push(fillData.slice());
    if (undo.length > 30) undo.shift();
    redo = [];
    refreshButtons();
  }
  function doUndo() {
    if (!undo.length) return;
    redo.push(fillData);
    fillData = undo.pop();
    refreshButtons();
    paint();
  }
  function doRedo() {
    if (!redo.length) return;
    undo.push(fillData);
    fillData = redo.pop();
    refreshButtons();
    paint();
  }
  function refreshButtons() {
    undoBtn.disabled = !undo.length;
    redoBtn.disabled = !redo.length;
  }

  /* ---------- tocar: balde / pincel recortado a la zona / zoom ---------- */
  const view = createViewport();
  const pointers = new Map();
  let stroke = null; // { region, mask, bbox, base, s }

  function applyZoom() {
    canvas.style.transform = view.scale > 1.01 ? `translate(${view.tx * 100}%, ${view.ty * 100}%) scale(${view.scale})` : '';
    zoomBtn.hidden = view.scale <= 1.01;
  }
  function resetZoom() {
    view.reset();
    applyZoom();
  }

  const norm = (e) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const screen = (e) => {
    const r = canvasWrap.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  function regionAt(x, y) {
    const px = Math.floor(x * RENDER);
    const py = Math.floor(y * RENDER);
    if (px < 0 || py < 0 || px >= RENDER || py >= RENDER) return -1;
    const region = labels[py * RENDER + px];
    return region < 0 || bgLabels[region] ? -1 : region;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!labels) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, screen(e));
    if (pointers.size > 1) {
      if (stroke) {
        fillData = stroke.base;
        undo.pop();
        stroke = null;
        paint();
      }
      return;
    }
    const [x, y] = norm(e);
    const region = regionAt(x, y);
    if (region < 0) return;
    if (tool === 'fill') {
      snapshot();
      fillRegionStyled(fillData, labels, region, fillKind, rgba(color), RENDER);
      sfx.play('fill');
      paint();
      return;
    }
    snapshot();
    const { mask, bbox } = regionWithRing(labels, region, RENDER);
    stroke = { mask, bbox, base: fillData.slice(), s: { t: tool, c: color, s: brushSize * (RENDER / 400), p: [x, y] } };
    renderStroke();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const now = screen(e);
    pointers.set(e.pointerId, now);
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      view.pinch(prev, other, now, other);
      applyZoom();
      return;
    }
    if (!stroke) return;
    const [x, y] = norm(e);
    const p = stroke.s.p;
    if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < 0.003 / view.scale) return;
    p.push(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
    renderStroke();
  });

  const end = (e) => {
    pointers.delete(e.pointerId);
    if (stroke) {
      stroke = null;
      sfx.play('pop');
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  /** Re-pinta el trazo vivo y lo mezcla con la capa de color SOLO dentro de la zona. */
  function renderStroke() {
    const { mask, bbox, base, s } = stroke;
    const w = bbox.x1 - bbox.x0 + 1;
    const h = bbox.y1 - bbox.y0 + 1;
    brushCtx.clearRect(0, 0, RENDER, RENDER);
    paintBrush(brushCtx, s, RENDER, RENDER);
    const ink = brushCtx.getImageData(bbox.x0, bbox.y0, w, h).data;
    const out = base.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (bbox.y0 + y) * RENDER + bbox.x0 + x;
        if (!mask[i]) continue;
        const k = (y * w + x) * 4;
        const a = ink[k + 3] / 255;
        if (!a) continue;
        const o = i * 4;
        const ba = out[o + 3] / 255;
        const oa = a + ba * (1 - a);
        out[o] = (ink[k] * a + out[o] * ba * (1 - a)) / oa;
        out[o + 1] = (ink[k + 1] * a + out[o + 1] * ba * (1 - a)) / oa;
        out[o + 2] = (ink[k + 2] * a + out[o + 2] * ba * (1 - a)) / oa;
        out[o + 3] = oa * 255;
      }
    }
    fillData = out;
    queuePaint();
  }

  /* ---------- guardar / compartir ---------- */
  function finalCanvas() {
    const off = document.createElement('canvas');
    off.width = off.height = RENDER;
    const c = off.getContext('2d');
    c.fillStyle = '#fff';
    c.fillRect(0, 0, RENDER, RENDER);
    fillCtx.putImageData(new ImageData(fillData, RENDER, RENDER), 0, 0);
    c.drawImage(fillCanvas, 0, 0);
    c.drawImage(lineCanvas, 0, 0);
    return off;
  }

  async function save() {
    if (!fillData) return;
    const img = finalCanvas();
    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 300;
    thumb.getContext('2d').drawImage(img, 0, 0, 300, 300);
    await store.putItem({
      id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: 'colored',
      name: current.title,
      png: img.toDataURL('image/png'),
      thumb: thumb.toDataURL('image/png'),
    });
    celebrate(app.t('color.done'));
    addStar();
    toast(app.t('color.done'));
  }

  async function share() {
    if (!fillData) return;
    const blob = await canvasBlob(finalCanvas());
    if (blob) await shareBlob(blob, current.title || 'pintakids', toast);
  }

  /* ---------- biblioteca: paquetes, nivel, recientes, mis dibujos ---------- */
  function openPicker() {
    paintView.hidden = true;
    picker.hidden = false;
    root.classList.remove('color-mode');
    root.scrollTop = 0;
    renderGrid();
  }

  function openCanvas() {
    picker.hidden = true;
    paintView.hidden = false;
    root.classList.add('color-mode');
    requestAnimationFrame(() => {
      fitStage();
      paint();
    });
  }

  function chip(label, attrs, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    Object.assign(b.dataset, attrs);
    b.addEventListener('click', () => {
      packRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      onClick();
    });
    return b;
  }

  async function loadCatalog() {
    catalog = await fetch('/v1/catalog?v=9').then((r) => r.json());
    packRow.append(
      chip(app.t('color.recent'), { special: 'recent' }, () => selectPack('recent')),
      chip(app.t('color.mine'), { special: 'mine' }, () => selectPack('mine')),
    );
    for (const p of catalog.packs) {
      packRow.appendChild(chip((en && p.name_en) || p.name, { pack: p.id }, () => selectPack(p.id)));
    }
    const first = packRow.querySelector('.chip[data-pack]');
    first.setAttribute('aria-pressed', 'true');
    await selectPack(first.dataset.pack);
  }

  async function filesOf(id) {
    packFiles[id] ??= (await fetch(`/v1/catalog/${id}?v=9`).then((r) => r.json())).files;
    return packFiles[id];
  }

  async function selectPack(id) {
    filter.pack = id;
    levelRow.hidden = id === 'mine' || id === 'recent';
    if (id !== 'mine' && id !== 'recent') await filesOf(id);
    renderGrid();
  }

  async function renderGrid() {
    grid.replaceChildren();
    const id = filter.pack;
    if (!id) return;
    if (id === 'mine') {
      const mine = (await store.getItems()).filter((it) => it.kind === 'lineart' && it.png);
      if (!mine.length) grid.innerHTML = `<p class="note">${app.t('color.mineEmpty')}</p>`;
      for (const it of mine) grid.appendChild(card(it.png, it.name ?? '', 0, () => loadImage(it.png).then((d) => prepare(d, { pack: 'mine', file: it.id, title: it.name ?? '' }))));
      return;
    }
    if (id === 'recent') {
      const list = Array.isArray(app.settings.recentColoring) ? app.settings.recentColoring : [];
      if (!list.length) grid.innerHTML = `<p class="note">${app.t('color.recentEmpty')}</p>`;
      for (const r of list) grid.appendChild(card(fileUrl(r.pack, r.file), T(r), r.level, () => openDrawing(r.pack, r)));
      return;
    }
    for (const f of packFiles[id] ?? []) {
      if (filter.level && String(f.level) !== filter.level) continue;
      grid.appendChild(card(fileUrl(id, f.file), T(f), f.level, () => openDrawing(id, f)));
    }
  }

  const fileUrl = (pack, file) => `/v1/catalog/${pack}/files/${file}?v=9`;

  function card(src, title, level, onOpen) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    if (level) b.dataset.level = String(level);
    const img = new Image();
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = src;
    img.alt = '';
    const lab = document.createElement('small');
    lab.textContent = title;
    b.append(img, lab);
    if (level) {
      const lv = document.createElement('span');
      lv.className = 'level-badge';
      lv.textContent = '★'.repeat(level);
      lv.setAttribute('aria-label', app.t('color.level' + level));
      b.appendChild(lv);
    }
    b.addEventListener('click', async () => {
      if (b.disabled) return;
      b.disabled = true;
      try {
        await onOpen();
        openCanvas();
      } catch {
        toast(app.t('color.loadError'));
      } finally {
        b.disabled = false;
      }
    });
    return b;
  }

  async function openDrawing(pack, f) {
    const data = await loadImage(fileUrl(pack, f.file));
    prepare(data, { pack, file: f.file, title: T(f) });
    const entry = { pack, file: f.file, title: f.title, title_en: f.title_en, level: f.level };
    const list = [entry, ...(app.settings.recentColoring ?? []).filter((r) => !(r.pack === pack && r.file === f.file))].slice(0, 8);
    app.settings.recentColoring = list;
    store.setSetting('recentColoring', list);
  }

  /** Lo que llega de Foto o Dibuja conmigo puede tener otro tamaño: se reescala al lienzo de colorear. */
  function fromCanvas(src) {
    const off = document.createElement('canvas');
    off.width = off.height = RENDER;
    const c = off.getContext('2d', { willReadFrequently: true });
    c.drawImage(src, 0, 0, RENDER, RENDER);
    return { canvas: off, imageData: c.getImageData(0, 0, RENDER, RENDER) };
  }

  root.__pkColor = {
    async incoming(data) {
      prepare(fromCanvas(data.canvas), { pack: 'mine', file: 'nuevo', title: data.title ?? app.t('photo.title') });
      openCanvas();
    },
    refreshMine() {
      if (!picker.hidden && (filter.pack === 'mine' || filter.pack === 'recent')) renderGrid();
    },
  };

  /* ---------- arranque ---------- */
  setColor(color);
  setTool('fill');
  if (incoming) await root.__pkColor.incoming(incoming);
  else openPicker();
  loadCatalog().catch(() => (head.querySelector('h2').textContent = app.t('color.loadError')));
  applyI18n(root);
}
