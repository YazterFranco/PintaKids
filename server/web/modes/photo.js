/** Modo Foto: una foto o un dibujo en papel → líneas limpias para colorear. Todo en el dispositivo. */

import { iconBtn, ACTION_ICONS, fitSquare } from '../ui/parts.js';
import { tabColor } from '../ui/icons.js';
import { photoToLineart } from '../core/lineart.js';

const PROC = 400; // resolución de proceso (rápida en móvil)
const VIEW = 600; // vista previa
const INK = [45, 52, 54];

export async function mount(ctx) {
  const { app, toast, applyI18n, store } = ctx;
  const root = document.getElementById('view-photo');
  if (root.childElementCount) return;

  const panel = document.createElement('div');
  panel.className = 'panel photo-panel';
  const h = document.createElement('h2');
  h.textContent = app.t('photo.title');
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = app.t('photo.hint');

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.hidden = true;
  const take = iconBtn(ACTION_ICONS.export + '<small>' + app.t('photo.take') + '</small>', app.t('photo.take'), () => file.click(), 'toolbtn big');
  take.dataset.testid = 'photo-take';

  const slider = (key, testid, min, max, value) => {
    const label = document.createElement('label');
    label.className = 'sheet-slider';
    label.innerHTML = `<span>${app.t(key)}</span>`;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.dataset.testid = testid;
    input.addEventListener('input', schedule);
    label.appendChild(input);
    return { label, input };
  };
  const detail = slider('photo.detail', 'photo-detail', 0, 100, 50);
  const thick = slider('photo.thickness', 'photo-thickness', 1, 4, 2);
  const controls = document.createElement('div');
  controls.className = 'photo-controls';
  controls.hidden = true;
  controls.append(detail.label, thick.label);

  const use = iconBtn(tabColor + '<small>' + app.t('photo.use') + '</small>', app.t('photo.use'), toColor, 'toolbtn big');
  use.dataset.testid = 'photo-use';
  use.disabled = true;
  panel.append(h, note, take, controls);

  const stageBox = document.createElement('div');
  stageBox.className = 'color-stage photo-stage';
  const preview = document.createElement('div');
  preview.className = 'canvas-wrap';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = VIEW;
  canvas.style.touchAction = 'none';
  preview.appendChild(canvas);
  stageBox.appendChild(preview);
  const moveHint = document.createElement('p');
  moveHint.className = 'note photo-move';
  moveHint.textContent = app.t('photo.move');
  moveHint.hidden = true;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  root.append(panel, stageBox, moveHint, use, file);

  fitSquare(stageBox, preview, { min: 160, max: 560, byWidth: true });

  /* ---------- foto y recorte cuadrado ---------- */
  let img = null;
  let crop = { x: 0, y: 0, side: 0 }; // en píxeles de la foto
  let mask = null;

  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
    } catch {
      toast(app.t('color.loadError'));
      return;
    } finally {
      URL.revokeObjectURL(url);
    }
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    crop = { side, x: (img.naturalWidth - side) / 2, y: (img.naturalHeight - side) / 2 };
    controls.hidden = false;
    moveHint.hidden = img.naturalWidth === img.naturalHeight;
    use.disabled = false;
    render();
  });

  let queued = false;
  function schedule() {
    if (queued || !img) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  function render() {
    if (!img) return;
    const proc = document.createElement('canvas');
    proc.width = proc.height = PROC;
    const pc = proc.getContext('2d', { willReadFrequently: true });
    pc.fillStyle = '#fff';
    pc.fillRect(0, 0, PROC, PROC);
    pc.drawImage(img, crop.x, crop.y, crop.side, crop.side, 0, 0, PROC, PROC);
    const rgba = pc.getImageData(0, 0, PROC, PROC).data;
    mask = photoToLineart(rgba, PROC, PROC, { detail: Number(detail.input.value) / 100, thickness: Number(thick.input.value) }).mask;

    // vista: foto muy tenue (para encuadrar) + líneas
    c.fillStyle = '#fff';
    c.fillRect(0, 0, VIEW, VIEW);
    c.globalAlpha = 0.16;
    c.drawImage(proc, 0, 0, VIEW, VIEW);
    c.globalAlpha = 1;
    c.drawImage(maskCanvas(PROC), 0, 0, VIEW, VIEW);
  }

  function maskCanvas(size) {
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const oc = out.getContext('2d');
    const d = oc.createImageData(size, size);
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const o = i * 4;
      d.data[o] = INK[0];
      d.data[o + 1] = INK[1];
      d.data[o + 2] = INK[2];
      d.data[o + 3] = 255;
    }
    oc.putImageData(d, 0, 0);
    return out;
  }

  /* arrastrar para mover el recorte cuando la foto no es cuadrada */
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!img) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, crop: { ...crop } };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const k = crop.side / r.width;
    crop.x = Math.min(img.naturalWidth - crop.side, Math.max(0, drag.crop.x - (e.clientX - drag.x) * k));
    crop.y = Math.min(img.naturalHeight - crop.side, Math.max(0, drag.crop.y - (e.clientY - drag.y) * k));
    schedule();
  });
  const stop = () => (drag = null);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  async function toColor() {
    if (!mask) return;
    const out = maskCanvas(PROC);
    const png = out.toDataURL('image/png');
    await store.putItem({ id: 'l_' + Date.now().toString(36), kind: 'lineart', name: app.t('photo.title'), png, thumb: png });
    toast('✨');
    ctx.pendingLineart = { canvas: out, title: app.t('photo.title') };
    app.go('color');
  }

  applyI18n(root);
}
