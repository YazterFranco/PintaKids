/** Mini kit de componentes para los modos (sin framework: botones grandes y paletas). */

export const PALETTE = [
  '#2b2d42', '#e63946', '#ff6b35', '#ff9f1c', '#ffd166', '#f4d35e',
  '#8ac926', '#06d6a0', '#2a9d8f', '#4cc9f0', '#a2d2ff', '#118ab2',
  '#3a86ff', '#7c4dff', '#b5179e', '#ef476f', '#ff8fab', '#8d5524',
  '#d4a373', '#ffffff',
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
