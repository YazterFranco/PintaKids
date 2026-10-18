/** Modo Foto: foto o dibujo propio → máscara de líneas → se abre en Colorear. Todo local. */

import { btn, toolbar, iconBtn, ACTION_ICONS } from '../ui/parts.js';
import { photoToLineart } from '../core/lineart.js';
import { tabColor } from '../ui/icons.js';

const RENDER = 900;

export async function mount(ctx) {
  const { app, toast, applyI18n, store } = ctx;
  const root = document.getElementById('view-photo');
  if (root.childElementCount) return;

  root.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'panel';
  root.appendChild(panel);

  const preview = document.createElement('div');
  preview.className = 'canvas-wrap';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RENDER;
  canvas.style.touchAction = 'none';
  preview.appendChild(canvas);
  const c = canvas.getContext('2d');

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.capture = 'environment';
  file.hidden = true;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '10';
  slider.max = '120';
  slider.value = '40';
  slider.id = 'intensity';

  let currentSrc = null;
  let currentMask = null;
  let drawing = false;
  let erase = false;

  function render() {
    if (!currentSrc) return;
    const { mask, threshold } = photoToLineart(currentSrc.rgba, currentSrc.w, currentSrc.h, Number(slider.value) || null);
    currentMask = mask;
    const scale = RENDER / currentSrc.w;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, RENDER, RENDER);
    c.strokeStyle = '#234';
    c.lineWidth = Math.max(1, scale);
    for (let y = 0; y < currentSrc.h; y++) {
      let run = -1;
      for (let x = 0; x <= currentSrc.w; x++) {
        const on = x < currentSrc.w && mask[y * currentSrc.w + x];
        if (on && run < 0) run = x;
        if (!on && run >= 0) {
          c.beginPath();
          c.moveTo((run + 0.5) * scale, (y + 0.5) * scale);
          c.lineTo((x - 0.5) * scale, (y + 0.5) * scale);
          c.stroke();
          run = -1;
        }
      }
    }
    document.getElementById('thr').textContent = String(threshold);
  }

  function toColorView() {
    if (!currentMask) return;
    // Convertir máscara a ImageData de línea transparente para Colorear.
    const off = document.createElement('canvas');
    off.width = off.height = RENDER;
    const oc = off.getContext('2d');
    oc.fillStyle = '#fff';
    oc.fillRect(0, 0, RENDER, RENDER);
    const src = currentSrc.rgba;
    oc.drawImage(currentSrc.canvas, 0, 0, RENDER, RENDER);
    const imgData = oc.getImageData(0, 0, RENDER, RENDER);
    for (let i = 0; i < currentMask.length; i++) {
      const o = i * 4;
      if (currentMask[i]) {
        imgData.data[o] = 34;
        imgData.data[o + 1] = 51;
        imgData.data[o + 2] = 68;
        imgData.data[o + 3] = 255;
      } else {
        imgData.data[o + 3] = 0;
      }
    }
    oc.clearRect(0, 0, RENDER, RENDER);
    oc.putImageData(imgData, 0, 0);
    store.putItem({
      id: 'l_' + Date.now().toString(36),
      kind: 'lineart',
      name: app.t('photo.title'),
      strokes: '[]',
      thumb: off.toDataURL('image/png'),
      png: off.toDataURL('image/png'),
    });
    toast('✨');
    ctx.pendingLineart = { canvas: off, imageData: imgData };
    app.go('color');
  }

  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const maxSide = 600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const oc = off.getContext('2d', { willReadFrequently: true });
    oc.drawImage(img, 0, 0, w, h);
    currentSrc = { canvas: off, w, h, rgba: oc.getImageData(0, 0, w, h).data };
    URL.revokeObjectURL(url);
    render();
  });

  slider.addEventListener('input', render);

  const take = iconBtn(ACTION_ICONS.export + '<small>' + app.t('photo.take') + '</small>', app.t('photo.take'), () => file.click(), 'toolbtn big'); take.dataset.testid='photo-take';
  const use = iconBtn(tabColor + '<small>' + app.t('photo.use') + '</small>', app.t('photo.use'), toColorView); use.dataset.testid='photo-use';
  panel.append(
    (() => {
      const h = document.createElement('h2');
      h.textContent = app.t('photo.title');
      return h;
    })(),
    (() => {
      const n = document.createElement('div');
      n.className = 'note';
      n.textContent = app.t('photo.hint');
      return n;
    })(),
    toolbar(take),
    toolbar(
      (() => {
        const s = document.createElement('span');
        s.className = 'note';
        s.textContent = app.t('photo.intensity') + ' ';
        return s;
      })(),
      slider,
      (() => {
        const s = document.createElement('span');
        s.id = 'thr';
        return s;
      })(),
    ),
    toolbar(use),
  );
  root.appendChild(preview);
  root.appendChild(file);
  applyI18n(root);
}
