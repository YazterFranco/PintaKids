/** Mini kit de componentes para los modos (sin framework: botones grandes y paletas). */

import { brushIcon, clearIcon, downloadIcon, eraserIcon, exportIcon, fillIcon, glitterIcon, lineIcon, markerIcon, mirrorIcon, pencilIcon, pickerIcon, rainbowIcon, rectIcon, redoIcon, saveIcon, stampIcon, starToolIcon, ellipseIcon, undoIcon, watercolorIcon, crayonIcon, sprayIcon, backIcon, nextIcon, colorPencilIcon, chalkIcon, neonIcon } from './icons.js';

export const PALETTE = [
  '#ff8fab', '#ffd166', '#4cc9f0', '#8ac926', '#e63946', '#ff9f1c',
  '#7c4dff', '#b5179e', '#06d6a0', '#2a9d8f', '#118ab2', '#3a86ff',
  '#a2d2ff', '#f4d35e', '#ef476f', '#ff6b35', '#d4a373', '#8d5524',
  '#2b2d42', '#ffffff',
];

export const STAMPS = ['⭐', '❤️', '🌸', '🦋', '😊', '🍎', '🚗', '🐟'];

export function btn(label, onClick, cls = 'toolbtn') {
  const b = document.createElement('button');
  b.className = cls;
  b.innerHTML = label;
  b.addEventListener('click', onClick);
  return b;
}

export function pressedButton(inner, title, onPress) {
  const b = document.createElement('button');
  b.className = 'toolbtn';
  b.innerHTML = inner;
  b.title = title;
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => onPress(b));
  return b;
}

export function paletteRow(onPick, initial = PALETTE[0]) {
  const row = document.createElement('div');
  row.className = 'palette';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'colores');
  let current = initial;
  const dots = [];
  for (const hex of PALETTE) {
    const d = document.createElement('button');
    d.className = 'swatch';
    d.style.background = hex;
    d.setAttribute('aria-label', 'color ' + hex);
    d.setAttribute('aria-pressed', String(hex === current));
    d.addEventListener('click', () => {
      current = hex;
      dots.forEach((x) => x.el.setAttribute('aria-pressed', String(x.hex === current)));
      onPick(hex);
    });
    dots.push({ el: d, hex });
    row.appendChild(d);
  }
  return row;
}

/** Grosor con deslizador y vista previa (estilo Simple Draw). Mismo nombre: los modos no cambian. */
export function sizesRow(onPick, initial = 14) {
  const row = document.createElement('div');
  row.className = 'sizes';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'grosor');

  const dot = document.createElement('span');
  dot.className = 'size-preview';
  const sizeDot = (s) => Math.max(6, Math.min(34, s));
  dot.style.width = dot.style.height = sizeDot(initial) + 'px';

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '4';
  input.max = '48';
  input.step = '2';
  input.value = String(initial);
  input.className = 'size-slider';
  input.setAttribute('aria-label', 'grosor del trazo');
  input.addEventListener('input', () => {
    const s = Number(input.value);
    dot.style.width = dot.style.height = sizeDot(s) + 'px';
    onPick(s);
  });

  row.append(dot, input);
  return row;
}

export function toolbar(...children) {
  const t = document.createElement('div');
  t.className = 'toolbar';
  for (const c of children) if (c) t.appendChild(c);
  return t;
}

// ── Botones con icono SVG ─────────────────────────────────────
/** Botón con solo icono SVG (para toolstrip, acciones). */
export function iconBtn(svgStr, title, onClick, cls = 'toolbtn') {
  const b = document.createElement('button');
  b.className = cls;
  b.innerHTML = svgStr;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

/** Botón icono + label pequeña con pressed state. */
export function toolIconBtn(svgStr, label, title, onPress) {
  const b = document.createElement('button');
  b.className = 'toolbtn';
  b.innerHTML = `${svgStr}<small>${label}</small>`;
  b.title = title;
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => onPress(b));
  return b;
}

export const TOOL_ICONS = {
  crayon: crayonIcon,
  marker: markerIcon,
  pencil: pencilIcon,
  colorpencil: colorPencilIcon,
  chalk: chalkIcon,
  neon: neonIcon,
  watercolor: watercolorIcon,
  glitter: glitterIcon,
  spray: sprayIcon,
  rainbow: rainbowIcon,
  rect: rectIcon,
  ellipse: ellipseIcon,
  line: lineIcon,
  star: starToolIcon,
  fill: fillIcon,
  picker: pickerIcon,
  eraser: eraserIcon,
  stamp: stampIcon,
};

export const ACTION_ICONS = {
  undo: undoIcon,
  redo: redoIcon,
  mirror: mirrorIcon,
  export: exportIcon,
  clear: clearIcon,
  save: saveIcon,
  brush: brushIcon,
  fill: fillIcon,
  download: downloadIcon,
  back: backIcon,
  next: nextIcon,
};

/**
 * Mantiene `el` cuadrado y lo más grande posible dentro de `box`.
 * byWidth: la altura de `box` depende de su contenido (no se usa para medir: evita el bucle de ResizeObserver).
 * Solo cambia el tamaño si es distinto y lo aplica en el siguiente frame.
 */
export function fitSquare(box, el, { min = 140, max = Infinity, byWidth = false } = {}) {
  let last = 0;
  let frame = 0;
  const apply = () => {
    frame = 0;
    const r = box.getBoundingClientRect();
    if (!r.width || (!byWidth && !r.height)) return;
    const s = Math.max(min, Math.floor(Math.min(max, byWidth ? r.width : Math.min(r.width, r.height))));
    if (s === last) return;
    last = s;
    el.style.width = el.style.height = s + 'px';
  };
  const ro = new ResizeObserver(() => {
    if (!frame) frame = requestAnimationFrame(apply);
  });
  ro.observe(box);
  return { refit: apply, disconnect: () => ro.disconnect() };
}
