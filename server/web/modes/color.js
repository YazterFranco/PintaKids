/** Modo Colorear: biblioteca gratuita + rellenar tocando sin salirse de la línea. */

import { PALETTE, iconBtn, paletteRow, sizesRow, ACTION_ICONS } from '../ui/parts.js';
import { dilateMask, fillRegion, labelRegions, lineMaskFromRGBA } from '../core/colorfill.js';

const RENDER = 640; // lienzo lógico: suficiente para pantalla y rápido en móvil

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store } = ctx;
  const root = document.getElementById('view-color');
  const incoming = ctx.pendingLineart ?? null; // foto→colorear entrega aquí su máscara
  if (incoming) {
    ctx.pendingLineart = null;
    root.replaceChildren();
  }

  // Mantener el dibujo si ya estaba montado (navegación interna).
  if (root.childElementCount) {
    if (incoming && root.__pkColorIncoming) await root.__pkColorIncoming(incoming);
    return;
  }

  build();

  function build() {
    root.replaceChildren();
    root.classList.remove('color-mode');
    root.scrollTop = 0;

    /* ---------- estado ---------- */
    let line = null; // ImageData de la línea (trazo sobre transparente)
    let lineCanvas = null; // misma línea como canvas (para dibujar encima)
    let labels = null; // Int32Array de regiones
    let bgLabels = null; // regiones que tocan el borde (fondo: no se pintan)
    let fillData = null; // Uint8ClampedArray capa de color
    let fillImage = null; // ImageData que comparte/refleja fillData
    let fillCanvas = null;
    let fillCtx = null;
    let undoFills = [];
    let current = { pack: '', file: '', title: '' };
    let color = PALETTE[0];
    let mode = 'fill'; // 'fill' | 'brush'
    let brushSize = 30;
    let drawing = false;
    let catalog = null; // caché del índice del catálogo
    let busy = false;

    /* ---------- DOM estable ---------- */
    const picker = document.createElement('div');
    picker.className = 'color-picker';

    const head = document.createElement('div');
    head.className = 'color-head';
    const pickerTitle = document.createElement('h2');
    pickerTitle.id = 'color-title';
    pickerTitle.textContent = app.t('color.pick');
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = app.t('color.tap');
    head.append(pickerTitle, note);

    const chips = document.createElement('div');
    chips.className = 'packrow';
    const grid = document.createElement('div');
    grid.className = 'grid';
    picker.append(head, chips, grid);

    const paintView = document.createElement('div');
    paintView.className = 'color-paint';
    paintView.hidden = true;

    const top = document.createElement('div');
    top.className = 'color-top';
    const back = iconBtn(ACTION_ICONS.back, app.t('color.another'), openPicker);
    const titleEl = document.createElement('h2');
    titleEl.id = 'color-paint-title';
    const undoBtn = iconBtn(ACTION_ICONS.undo, app.t('draw.undo'), undo);
    const saveBtn = iconBtn(ACTION_ICONS.save, app.t('draw.save'), () => saveItem('colored', current.title), 'toolbtn save');
    top.append(back, titleEl, undoBtn, saveBtn);

    const stage = document.createElement('div');
    stage.className = 'color-stage';
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = RENDER;
    canvas.style.touchAction = 'none';
    canvasWrap.appendChild(canvas);
    stage.appendChild(canvasWrap);

    const ctx2 = canvas.getContext('2d', { willReadFrequently: true });

    const tray = document.createElement('div');
    tray.className = 'color-tray';
    const colorRow = paletteRow((c) => (color = c));
    colorRow.classList.add('tray-palette');

    const actions = document.createElement('div');
    actions.className = 'color-actions';
    const fillBtn = iconBtn(ACTION_ICONS.fill, app.t('color.fill'), () => setMode('fill'));
    const brushBtn = iconBtn(ACTION_ICONS.brush, app.t('color.brush'), () => setMode('brush'));
    const sizes = sizesRow((s) => (brushSize = s), 30);
    const tip = document.createElement('span');
    tip.className = 'color-tip';
    const clearBtn = iconBtn(ACTION_ICONS.clear, app.t('color.clear'), clearFills);
    const dl = iconBtn(ACTION_ICONS.download, app.t('color.download'), download);
    actions.append(fillBtn, brushBtn, sizes, tip, clearBtn, dl);
    tray.append(colorRow, actions);

    const body = document.createElement('div');
    body.className = 'color-body';
    body.append(stage, tray);
    paintView.append(top, body);
    root.append(picker, paintView);

    /* ---------- tamaño del lienzo (siempre cuadrado) ---------- */
    function fitStage() {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const s = Math.max(140, Math.floor(Math.min(r.width, r.height)));
      canvasWrap.style.width = s + 'px';
      canvasWrap.style.height = s + 'px';
    }
    const ro = new ResizeObserver(fitStage);
    ro.observe(stage);

    /* ---------- carga de SVG ---------- */
    const loadSvg = (url) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const off = document.createElement('canvas');
          off.width = off.height = RENDER;
          const c = off.getContext('2d', { willReadFrequently: true });
          // 4 % de margen: el trazo nunca se corta en el borde.
          const scale = Math.min((RENDER * 0.92) / img.width, (RENDER * 0.92) / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          c.drawImage(img, (RENDER - dw) / 2, (RENDER - dh) / 2, dw, dh);
          resolve({ canvas: off, imageData: c.getImageData(0, 0, RENDER, RENDER) });
        };
        img.onerror = () => reject(new Error('svg-no-cargo'));
        img.src = url;
      });

    /** Regiones que tocan el borde = fondo de la hoja (no deben rellenarse). */
    function borderRegions(lbls, size, count) {
      const bg = new Uint8Array(count);
      const mark = (r) => {
        if (r >= 0) bg[r] = 1;
      };
      for (let i = 0; i < size; i++) {
        mark(lbls[i]);
        mark(lbls[(size - 1) * size + i]);
        mark(lbls[i * size]);
        mark(lbls[i * size + size - 1]);
      }
      return bg;
    }

    async function prepareFromLine({ canvas: src, imageData }, title, pack = '', file = '') {
      line = imageData;
      lineCanvas = src;
      const mask = dilateMask(lineMaskFromRGBA(imageData.data, RENDER, RENDER), RENDER, RENDER);
      const r = labelRegions(mask, RENDER, RENDER);
      labels = r.labels;
      bgLabels = borderRegions(r.labels, RENDER, r.regionCount);

      fillData = new Uint8ClampedArray(RENDER * RENDER * 4);
      fillImage = new ImageData(fillData, RENDER, RENDER);
      fillCanvas = document.createElement('canvas');
      fillCanvas.width = fillCanvas.height = RENDER;
      fillCtx = fillCanvas.getContext('2d');

      undoFills = [];
      current = { pack, file, title };
      titleEl.textContent = title;
      paint();
    }

    function syncFillImage() {
      if (fillImage.data !== fillData) fillImage.data.set(fillData);
    }

    function paint() {
      if (!lineCanvas || !fillImage) return;
      syncFillImage();
      fillCtx.putImageData(fillImage, 0, 0);
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, RENDER, RENDER);
      ctx2.drawImage(fillCanvas, 0, 0);
      ctx2.drawImage(lineCanvas, 0, 0);
    }

    // Evita repintar más de una vez por frame al arrastrar el pincel.
    let paintQueued = false;
    function queuePaint() {
      if (paintQueued) return;
      paintQueued = true;
      requestAnimationFrame(() => {
        paintQueued = false;
        paint();
      });
    }

    function rgba(hex) {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }

    function pushUndo() {
      undoFills.push(fillData.slice());
      if (undoFills.length > 30) undoFills.shift();
    }

    function stampAt(x, y, isStart) {
      if (!labels) return;
      const px = Math.floor(x * RENDER);
      const py = Math.floor(y * RENDER);
      if (px < 0 || py < 0 || px >= RENDER || py >= RENDER) return;
      const i = py * RENDER + px;
      const region = labels[i];
      if (region < 0 || bgLabels[region]) return; // línea o fondo: no se pinta

      if (mode === 'brush') {
        if (isStart) pushUndo();
        const [r, g, b] = rgba(color);
        const rad = (brushSize / 400) * RENDER;
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (dx * dx + dy * dy > rad * rad) continue;
            const j = (py + Math.round(dy)) * RENDER + (px + Math.round(dx));
            if (j >= 0 && j < labels.length && labels[j] === region) {
              const o = j * 4;
              fillData[o] = r;
              fillData[o + 1] = g;
              fillData[o + 2] = b;
              fillData[o + 3] = 255;
            }
          }
        }
        queuePaint();
      } else {
        pushUndo();
        fillRegion(fillData, labels, region, rgba(color));
        paint();
      }
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!labels) return;
      e.preventDefault();
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const r = canvas.getBoundingClientRect();
      stampAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, true);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing || mode !== 'brush') return;
      const r = canvas.getBoundingClientRect();
      stampAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, false);
    });
    const stop = () => (drawing = false);
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);

    function undo() {
      const prev = undoFills.pop();
      if (!prev) return;
      fillData = prev;
      fillImage = new ImageData(fillData, RENDER, RENDER);
      paint();
    }

    function clearFills() {
      if (!fillData) return;
      pushUndo();
      fillData.fill(0);
      paint();
    }

    function mergedImageData() {
      const merged = new ImageData(RENDER, RENDER);
      for (let i = 0; i < RENDER * RENDER; i++) {
        const o = i * 4;
        const a = fillData[o + 3];
        merged.data[o] = (fillData[o] * a + 255 * (255 - a)) / 255;
        merged.data[o + 1] = (fillData[o + 1] * a + 255 * (255 - a)) / 255;
        merged.data[o + 2] = (fillData[o + 2] * a + 255 * (255 - a)) / 255;
        if (line.data[o + 3] > 100) {
          merged.data[o] = line.data[o];
          merged.data[o + 1] = line.data[o + 1];
          merged.data[o + 2] = line.data[o + 2];
        }
        merged.data[o + 3] = 255;
      }
      return merged;
    }

    function saveItem(kind, name) {
      const off = document.createElement('canvas');
      off.width = off.height = 480;
      off.getContext('2d').putImageData(cropToContent(mergedImageData(), 480), 0, 0);
      const item = {
        id: kind.slice(0, 1) + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        kind,
        name,
        png: off.toDataURL('image/png'),
        thumb: off.toDataURL('image/png'),
      };
      store.putItem(item);
      addStar();
      toast(app.t('color.done'));
    }

    function download() {
      const merged = mergedImageData();
      const off = document.createElement('canvas');
      off.width = off.height = RENDER;
      off.getContext('2d').putImageData(cropToContent(merged, RENDER), 0, 0);
      const a = document.createElement('a');
      a.download = (current.title || 'pintakids') + '.png';
      a.href = off.toDataURL('image/png');
      a.click();
    }

    // recorte suave al contenido (para que la miniatura no sea todo blanco)
    function cropToContent(imgData, size) {
      const { data, width } = imgData;
      let minX = width, minY = width, maxX = 0, maxY = 0;
      let any = false;
      for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
          const o = (y * width + x) * 4;
          if (data[o] < 250 || data[o + 1] < 250 || data[o + 2] < 250) {
            any = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!any) return imgData;
      const side = Math.max(maxX - minX, maxY - minY) + 20;
      const sx = Math.max(0, minX - 10);
      const sy = Math.max(0, minY - 10);
      const cropped = new ImageData(size, size);
      const cd = cropped.data;
      for (let i = 0; i < size * size; i++) {
        cd[i * 4] = 255;
        cd[i * 4 + 1] = 255;
        cd[i * 4 + 2] = 255;
        cd[i * 4 + 3] = 255;
      }
      const sc = size / side;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const ox = sx + x / sc;
          const oy = sy + y / sc;
          const ix = Math.floor(ox);
          const iy = Math.floor(oy);
          if (ix < 0 || iy < 0 || ix >= width || iy >= width) continue;
          const so = (iy * width + ix) * 4;
          const to = (y * size + x) * 4;
          cd[to] = data[so];
          cd[to + 1] = data[so + 1];
          cd[to + 2] = data[so + 2];
          cd[to + 3] = 255;
        }
      }
      return cropped;
    }

    /* ---------- elegir dibujo ---------- */
    function setMode(m) {
      mode = m;
      fillBtn.setAttribute('aria-pressed', String(m === 'fill'));
      brushBtn.setAttribute('aria-pressed', String(m === 'brush'));
      sizes.hidden = m !== 'brush';
      tip.hidden = m === 'brush';
      tip.textContent = app.t(m === 'brush' ? 'color.brushHint' : 'color.tap');
    }

    function openPicker() {
      paintView.hidden = true;
      picker.hidden = false;
      root.classList.remove('color-mode');
      root.scrollTop = 0;
    }

    function openCanvas() {
      picker.hidden = true;
      paintView.hidden = false;
      root.classList.add('color-mode');
      titleEl.textContent = current.title || app.t('color.pick');
      requestAnimationFrame(() => {
        fitStage();
        paint();
      });
    }

    async function fillGrid() {
      if (catalog) return;
      catalog = await fetch('/v1/catalog?v=8').then((r) => r.json());
      let first = true;
      for (const pack of catalog.packs) {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.type = 'button';
        chip.textContent = app.t('color.pack.' + pack.id) ?? pack.name;
        chip.addEventListener('click', () => loadPack(pack.id, chip));
        chips.appendChild(chip);
        if (first) {
          first = false;
          loadPack(pack.id, chip);
        }
      }
    }

    async function loadPack(id, chipActive) {
      chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chipActive)));
      grid.replaceChildren();
      const pack = await fetch('/v1/catalog/' + id + '?v=8').then((r) => r.json());
      for (const f of pack.files) {
        const card = document.createElement('button');
        card.className = 'card';
        card.type = 'button';
        const img = new Image();
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = `/v1/catalog/${id}/files/${f.file}?v=8`;
        img.alt = f.title;
        const lab = document.createElement('small');
        lab.textContent = f.title;
        card.append(img, lab);
        card.addEventListener('click', async () => {
          if (busy) return;
          busy = true;
          card.disabled = true;
          try {
            const data = await loadSvg(img.src);
            await prepareFromLine(data, f.title, id, f.file);
            openCanvas();
          } catch {
            toast(app.t('color.loadError') ?? 'No se pudo abrir el dibujo');
          } finally {
            busy = false;
            card.disabled = false;
          }
        });
        grid.appendChild(card);
      }
    }

    /* ---------- foto → colorear ---------- */
    root.__pkColorIncoming = async (mask) => {
      await prepareFromLine(mask, app.t('photo.title'), 'photo', 'photo');
      openCanvas();
    };

    /* ---------- arranque ---------- */
    setMode('fill');
    if (incoming) {
      root.__pkColorIncoming(incoming);
    } else {
      openPicker();
      fillGrid().catch(() => {
        pickerTitle.textContent = app.t('color.loadError') ?? 'No se pudo cargar';
      });
    }
    applyI18n(root);
  }
}
