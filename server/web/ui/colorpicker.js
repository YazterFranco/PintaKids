/** Hoja de color: 24 colores infantiles, selector HSV (tono + cuadro saturación/brillo) y recientes. */

export const KID_COLORS = [
  '#ff7675', '#e84393', '#fd79a8', '#fab1a0', '#e17055', '#ff9f1c',
  '#fdcb6e', '#ffeaa7', '#badc58', '#00b894', '#55efc4', '#00cec9',
  '#74b9ff', '#0984e3', '#3742fa', '#6c5ce7', '#a29bfe', '#b33771',
  '#8d6e63', '#d4a373', '#ffffff', '#b2bec3', '#636e72', '#2d3436',
];

export function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [((h * 60) + 360) % 360, max ? d / max : 0, max];
}

export function hsvToHex(h, s, v) {
  const f = (k) => {
    const x = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return '#' + [f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}

/** Abre la hoja; `onPick(hex)` al elegir. Devuelve una función para cerrarla. */
export function openColorPicker({ current, recents = [], t = (k) => k, onPick }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet cp-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', t('draw.color'));

  const close = () => {
    backdrop.remove();
    sheet.remove();
  };
  const pick = (hex) => {
    onPick(hex);
    close();
  };
  backdrop.addEventListener('click', close);

  const grid = document.createElement('div');
  grid.className = 'cp-grid';
  for (const hex of KID_COLORS) grid.appendChild(dot(hex, hex === current, () => pick(hex)));

  // selector HSV
  let [h, s, v] = hexToHsv(current || '#6c5ce7');
  const sv = document.createElement('canvas');
  sv.className = 'cp-sv';
  sv.width = 240;
  sv.height = 140;
  const hue = document.createElement('input');
  hue.type = 'range';
  hue.min = '0';
  hue.max = '359';
  hue.value = String(Math.round(h));
  hue.className = 'cp-hue';
  hue.setAttribute('aria-label', 'tono');
  const preview = document.createElement('button');
  preview.type = 'button';
  preview.className = 'btn primary cp-use';
  preview.textContent = t('common.ok');

  function drawSv() {
    const c = sv.getContext('2d');
    const gx = c.createLinearGradient(0, 0, sv.width, 0);
    gx.addColorStop(0, '#fff');
    gx.addColorStop(1, hsvToHex(h, 1, 1));
    c.fillStyle = gx;
    c.fillRect(0, 0, sv.width, sv.height);
    const gy = c.createLinearGradient(0, 0, 0, sv.height);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(1, '#000');
    c.fillStyle = gy;
    c.fillRect(0, 0, sv.width, sv.height);
    c.strokeStyle = v > 0.5 ? '#000' : '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(s * sv.width, (1 - v) * sv.height, 8, 0, Math.PI * 2);
    c.stroke();
    const hex = hsvToHex(h, s, v);
    preview.style.background = hex;
    preview.style.color = v > 0.6 && s < 0.5 ? '#2d3436' : '#fff';
    preview.dataset.color = hex;
  }
  const svPick = (e) => {
    const r = sv.getBoundingClientRect();
    s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    drawSv();
  };
  sv.addEventListener('pointerdown', (e) => {
    sv.setPointerCapture(e.pointerId);
    svPick(e);
  });
  sv.addEventListener('pointermove', (e) => e.buttons && svPick(e));
  hue.addEventListener('input', () => {
    h = Number(hue.value);
    drawSv();
  });
  preview.addEventListener('click', () => pick(hsvToHex(h, s, v)));

  const mixer = document.createElement('div');
  mixer.className = 'cp-mixer';
  mixer.append(sv, hue, preview);

  sheet.append(title(t('draw.color')), grid);
  if (recents.length) {
    const rec = document.createElement('div');
    rec.className = 'cp-grid cp-recents';
    for (const hex of recents) rec.appendChild(dot(hex, false, () => pick(hex)));
    sheet.append(title(t('draw.recent')), rec);
  }
  sheet.append(title(t('draw.mix')), mixer);
  document.body.append(backdrop, sheet);
  drawSv();
  return close;
}

function title(text) {
  const el = document.createElement('h3');
  el.className = 'sheet-title';
  el.textContent = text;
  return el;
}

function dot(hex, on, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.style.background = hex;
  b.dataset.color = hex;
  b.setAttribute('aria-label', 'color ' + hex);
  b.setAttribute('aria-pressed', String(on));
  b.addEventListener('click', onClick);
  return b;
}

/** Lista de recientes: el nuevo primero, sin repetir, máximo 8. */
export function pushRecent(list, hex) {
  return [hex, ...list.filter((c) => c !== hex)].slice(0, 8);
}
