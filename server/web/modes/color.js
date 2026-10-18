/** Modo Colorear: biblioteca gratuita + rellenar tocando sin salirse de la línea. */

import { PALETTE, btn, paletteRow, sizesRow, toolbar } from '../ui/parts.js';
import { dilateMask, fillRegion, labelRegions, lineMaskFromRGBA } from '../core/colorfill.js';

const RENDER = 900; // lienzo lógico para detectar regiones (rápido y suficiente en pantalla)

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store } = ctx;
  const root = document.getElementById('view-color');
  const incoming = ctx.pendingLineart ?? null; // foto→colorear entrega aquí su máscara
  if (incoming) {
    ctx.pendingLineart = null;
    root.replaceChildren();
  }

  // Mantener la vista montada si ya estaba (navegación interna): reconstruir solo si está vacía.
  if (!root.childElementCount) build();

  async function build() {
    root.replaceChildren();

    const head = document.createElement('div');
    head.className = 'panel';
    root.appendChild(head);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'canvas-wrap';
    canvasWrap.style.flex = '1';

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = RENDER;
    canvas.style.touchAction = 'none';
    canvasWrap.appendChild(canvas);
    const ctx2 = canvas.getContext('2d', { willReadFrequently: true });

    let line = null; // ImageData de la línea (trazo sobre transparente): fuente de máscara
    let lineCanvas = null; // misma línea como canvas, para composiciones con drawImage (putImageData no mezcla alfa)
    let labels = null; // Int32Array de regiones
    let fillData = null; // Uint8ClampedArray color layer
    let undoFills = [];
    let current = { pack: '', file: '', title: '' };
    let color = PALETTE[0];
    let brush = false;
    let brushSize = 30;

    const colorRow = paletteRow((c) => (color = c));

    const loadSvg = (url) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const off = document.createElement('canvas');
          off.width = off.height = RENDER;
          const c = off.getContext('2d', { willReadFrequently: true });
          // Sin fondo: la línea queda sobre transparente.
          const scale = Math.min(RENDER / img.width, RENDER / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          c.drawImage(img, (RENDER - dw) / 2, (RENDER - dh) / 2, dw, dh);
          resolve({ canvas: off, imageData: c.getImageData(0, 0, RENDER, RENDER) });
        };
        img.onerror = () => reject(new Error('svg-no-cargo'));
        img.src = url;
      });

    async function prepareFromLine({ canvas, imageData }, title, pack = '', file = '') {
      line = imageData;
      lineCanvas = canvas;
      const mask = dilateMask(lineMaskFromRGBA(imageData.data, RENDER, RENDER), RENDER, RENDER);
      const r = labelRegions(mask, RENDER, RENDER);
      labels = r.labels;
      fillData = new Uint8ClampedArray(RENDER * RENDER * 4);
      undoFills = [];
      current = { pack, file, title };
      paint();
      const titleEl = document.getElementById('color-title');
      if (titleEl) titleEl.textContent = title;
    }

    function paint() {
      const out = new ImageData(RENDER, RENDER);
      // capa color sobre fondo blanco, luego la línea encima
      const d = out.data;
      for (let i = 0; i < RENDER * RENDER; i++) {
        const o = i * 4;
        const a = fillData[o + 3];
        d[o] = (fillData[o] * a + 255 * (255 - a)) / 255;
        d[o + 1] = (fillData[o + 1] * a + 255 * (255 - a)) / 255;
        d[o + 2] = (fillData[o + 2] * a + 255 * (255 - a)) / 255;
        d[o + 3] = 255;
      }
      ctx2.putImageData(out, 0, 0);
      ctx2.drawImage(lineCanvas, 0, 0);
    }

    function rgba(hex) {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }

    let lastPaint = null; // una sola entrada de undo por trazo de brocha
    function stampAt(x, y, isStart) {
      const px = Math.floor(x * RENDER);
      const py = Math.floor(y * RENDER);
      const i = py * RENDER + px;
      if (i < 0 || i >= labels.length) return;
      const region = labels[i];
      if (region < 0) return; // sobre la línea: ignorar (los niños perdonan, las líneas mandan)
      if (brush) {
        // pincel dentro de la región: círculo recortado
        if (isStart) {
          undoFills.push(fillData.slice());
          if (undoFills.length > 30) undoFills.shift();
          lastPaint = performance.now();
        }
        const rad = (brushSize / 400) * RENDER;
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (dx * dx + dy * dy > rad * rad) continue;
            const j = (py + Math.round(dy)) * RENDER + (px + Math.round(dx));
            if (j >= 0 && j < labels.length && labels[j] === region) {
              const o = j * 4;
              fillData[o] = rgba(color)[0];
              fillData[o + 1] = rgba(color)[1];
              fillData[o + 2] = rgba(color)[2];
              fillData[o + 3] = 255;
            }
          }
        }
      } else {
        undoFills.push(fillData.slice());
        if (undoFills.length > 30) undoFills.shift();
        fillRegion(fillData, labels, region, rgba(color));
      }
      paint();
    }

    let drawing = false;
    canvas.addEventListener('pointerdown', (e) => {
      if (!labels) return;
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const r = canvas.getBoundingClientRect();
      stampAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, true);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing || !brush) return;
      const r = canvas.getBoundingClientRect();
      stampAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, false);
    });
    canvas.addEventListener('pointerup', () => (drawing = false));

    function undo() {
      const prev = undoFills.pop();
      if (prev) {
        fillData = prev;
        paint();
      }
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

    /* ---------- panel de elección ---------- */
    async function openPicker() {
      head.replaceChildren();
      canvasWrap.hidden = true;
      root.insertBefore(canvasWrap, null);

      const title = document.createElement('h2');
      title.id = 'color-title';
      title.textContent = app.t('color.pick');
      const hint = document.createElement('div');
      hint.className = 'note';
      hint.textContent = app.t('color.tap');

      const chips = document.createElement('div');
      chips.className = 'packrow';
      const grid = document.createElement('div');
      grid.className = 'grid';
      head.append(title, chips, grid);
      if (incoming) {
        // viene de foto→colorear: ya hay máscara, no hace falta elegir
        chips.style.display = 'none';
      }

      const idx = await fetch('/v1/catalog').then((r) => r.json());
      let first = true;
      for (const pack of idx.packs) {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = app.t('color.pack.' + pack.id) ?? pack.name;
        chip.addEventListener('click', () => loadPack(pack.id, chip));
        chips.appendChild(chip);
        if (first) {
          first = false;
          loadPack(pack.id, chip);
        }
      }

      async function loadPack(id, chipActive) {
        chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chipActive)));
        grid.replaceChildren();
        const pack = await fetch('/v1/catalog/' + id).then((r) => r.json());
        for (const f of pack.files) {
          const card = document.createElement('button');
          card.className = 'card';
          const img = new Image();
          img.src = `/v1/catalog/${id}/files/${f.file}`;
          img.alt = f.title;
          const lab = document.createElement('small');
          lab.textContent = f.title;
          card.append(img, lab);
          card.addEventListener('click', async () => {
            const data = await loadSvg(img.src);
            await prepareFromLine(data, f.title, id, f.file);
            openCanvas();
          });
          grid.appendChild(card);
        }
      }
    }

    function openCanvas() {
      head.replaceChildren();
      const title = document.createElement('h2');
      title.id = 'color-title';
      head.append(title);

      const back = btn('↩️ ' + app.t('color.pick'), openPicker);
      const brushBtn = document.createElement('button');
      brushBtn.className = 'toolbtn';
      brushBtn.textContent = '🖌️';
      brushBtn.title = app.t('color.brush');
      brushBtn.setAttribute('aria-pressed', 'false');
      brushBtn.addEventListener('click', () => {
        brush = !brush;
        brushBtn.setAttribute('aria-pressed', String(brush));
      });
      const undoBtn = btn('↩️', undo);
      const dl = btn('⬇️', download);
      const save = btn('⭐', () => saveItem('colored', current.title), 'toolbtn big');
      root.appendChild(canvasWrap);
      canvasWrap.hidden = false;
      head.appendChild(toolbar(back, brushBtn, undoBtn, colorRow, sizesRow((s) => (brushSize = s), 30), dl, save));
      title.textContent = current.title;
    }

    if (incoming) {
      current = { title: app.t('photo.title') };
      await prepareFromLine(incoming, app.t('photo.title'), 'photo', 'photo');
      openCanvas();
    } else {
      await openPicker();
    }
    root.appendChild(canvasWrap);
    applyI18n(root);
  }
}
