/** Inicio: tarjetas grandes ilustradas para cada modo (sustituye a la barra de pestañas). */

import { sfx } from '../core/sfx.js';

const INK = '#2d3436';

// Ilustraciones originales (planas, 120×90) para cada tarjeta.
const ART = {
  draw: `<svg viewBox="0 0 120 90" aria-hidden="true">
    <path d="M14 70 C30 40 48 78 64 50 S96 30 106 46" fill="none" stroke="#ff7675" stroke-width="9" stroke-linecap="round"/>
    <path d="M18 54 C34 30 50 60 66 36" fill="none" stroke="#fdcb6e" stroke-width="7" stroke-linecap="round" opacity=".9"/>
    <g transform="rotate(35 86 40)"><rect x="80" y="8" width="13" height="52" rx="4" fill="#6c5ce7" stroke="${INK}" stroke-width="3"/>
    <rect x="80" y="44" width="13" height="8" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <path d="M80 60 L86.5 76 L93 60 Z" fill="#ffeaa7" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g></svg>`,
  learn: `<svg viewBox="0 0 120 90" aria-hidden="true">
    <rect x="10" y="8" width="100" height="74" rx="12" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <path d="M38 62 C30 46 40 30 60 30 C80 30 90 46 82 62 Z" fill="none" stroke="#a29bfe" stroke-width="4" stroke-dasharray="6 7" stroke-linecap="round"/>
    <path d="M40 34 L36 18 L50 28 M80 34 L84 18 L70 28" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="52" cy="46" r="3.5" fill="${INK}"/><circle cx="68" cy="46" r="3.5" fill="${INK}"/>
    <path d="M90 66 l4 -8 l4 8 l8 1 l-6 6 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -6 Z" fill="#fdcb6e" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  color: `<svg viewBox="0 0 120 90" aria-hidden="true">
    <path d="M60 10 C30 10 12 30 12 50 C12 70 30 80 46 80 C54 80 56 74 52 68 C48 62 52 56 60 56 L74 56 C94 56 108 46 108 34 C108 20 88 10 60 10 Z" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="34" cy="44" r="8" fill="#ff7675" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="44" cy="24" r="8" fill="#fdcb6e" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="66" cy="20" r="8" fill="#00b894" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="88" cy="30" r="8" fill="#0984e3" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="30" cy="64" r="6" fill="#a29bfe" stroke="${INK}" stroke-width="2.5"/></svg>`,
  photo: `<svg viewBox="0 0 120 90" aria-hidden="true">
    <rect x="12" y="22" width="96" height="60" rx="12" fill="#74b9ff" stroke="${INK}" stroke-width="3"/>
    <path d="M40 22 L46 12 L74 12 L80 22" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="60" cy="52" r="20" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="60" cy="52" r="11" fill="#dfe6e9" stroke="${INK}" stroke-width="3"/>
    <path d="M94 34 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 Z" fill="#fdcb6e"/></svg>`,
  story: `<svg viewBox="0 0 120 90" aria-hidden="true">
    <path d="M60 18 C46 10 26 10 12 16 L12 78 C26 72 46 72 60 80 Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M60 18 C74 10 94 10 108 16 L108 78 C94 72 74 72 60 80 Z" fill="#ffeaa7" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 30 H48 M24 40 H48 M24 50 H42" stroke="#b2bec3" stroke-width="3" stroke-linecap="round"/>
    <circle cx="84" cy="38" r="9" fill="#ff7675" stroke="${INK}" stroke-width="2.5"/>
    <path d="M70 64 L80 52 L88 60 L94 54 L100 64 Z" fill="#00b894" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  gallery: `<svg viewBox="0 0 120 90" aria-hidden="true">
    <rect x="16" y="14" width="50" height="40" rx="6" fill="#fff" stroke="${INK}" stroke-width="3" transform="rotate(-8 41 34)"/>
    <rect x="54" y="30" width="50" height="44" rx="6" fill="#fff" stroke="${INK}" stroke-width="3" transform="rotate(6 79 52)"/>
    <circle cx="36" cy="30" r="7" fill="#fdcb6e" stroke="${INK}" stroke-width="2.5"/>
    <path d="M62 66 L74 50 L84 60 L90 54 L98 66 Z" fill="#a29bfe" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
};

const CARDS = [
  { view: 'draw', tint: '#ffe8e6' },
  { view: 'learn', tint: '#ece9ff' },
  { view: 'color', tint: '#fff4d6' },
  { view: 'photo', tint: '#e3f2ff' },
  { view: 'story', tint: '#fff0e0' },
  { view: 'gallery', tint: '#e2f7ef' },
];

export async function mount(ctx) {
  const { app, applyI18n } = ctx;
  const root = document.getElementById('view-home');
  root.replaceChildren();

  const hello = document.createElement('p');
  hello.className = 'home-hello';
  hello.dataset.i18n = 'home.hello';

  const grid = document.createElement('div');
  grid.className = 'home-grid';
  for (const { view, tint } of CARDS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'home-card';
    card.dataset.testid = `home-card-${view}`;
    card.style.setProperty('--tint', tint);
    card.innerHTML = `<span class="home-art">${ART[view]}</span>
      <span class="home-label"><b data-i18n="home.${view}"></b><small data-i18n="home.${view}.sub"></small></span>`;
    card.addEventListener('click', () => {
      sfx.play('tap');
      app.go(view);
    });
    grid.appendChild(card);
  }

  root.append(hello, grid);
  applyI18n(root);
}
