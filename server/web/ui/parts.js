/** Mini kit de componentes para los modos (sin framework: botones grandes y paletas). */

export const PALETTE = [
  '#e63946', '#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#7c4dff',
  '#ef476f', '#8d5524', '#2b2d42', '#95d5b2', '#a2d2ff', '#ffffff',
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

export function sizesRow(onPick, initial = 14) {
  const row = document.createElement('div');
  row.className = 'sizes';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'grosor');
  const specs = [
    [8, 'thin', 18],
    [14, 'mid', 26],
    [24, 'thick', 34],
  ];
  const els = [];
  for (const [size, key, px] of specs) {
    const d = document.createElement('button');
    d.className = 'size-dot';
    d.style.width = d.style.height = px + 'px';
    d.setAttribute('aria-label', key);
    d.setAttribute('aria-pressed', String(size === initial));
    d.title = key;
    d.addEventListener('click', () => {
      els.forEach((x) => x.el.setAttribute('aria-pressed', String(x.size === size)));
      onPick(size);
    });
    els.push({ el: d, size });
    row.appendChild(d);
  }
  return row;
}

export function toolbar(...children) {
  const t = document.createElement('div');
  t.className = 'toolbar';
  for (const c of children) if (c) t.appendChild(c);
  return t;
}
