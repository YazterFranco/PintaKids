/** Arranque: i18n, navegación por pestañas, ajustes, límites de tiempo y SW. */

import { store } from './core/store.js';
import { DEFAULT_LANG, normalizeLang, t } from './core/i18n.js';
import { starIcon, crayonLogo, tabColor, tabDraw, tabGallery, tabLearn, tabParents, tabPhoto, tabStory, clockIcon } from './ui/icons.js';

const app = {
  lang: DEFAULT_LANG,
  dict: {},
  settings: {},
  stars: 0,
  go(view) {
    location.hash = '#/' + view;
  },
  t(key, params) {
    return t({ es: app.base.es, en: app.base.en }, app.lang, key, params);
  },
};

async function loadDicts() {
  const [es, en] = await Promise.all([
    fetch('/i18n/es.json?v=6').then((r) => r.json()),
    fetch('/i18n/en.json?v=6').then((r) => r.json()),
  ]);
  app.base = { es, en };
}

export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = app.t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = app.t(el.dataset.i18nTitle);
  document.documentElement.lang = app.lang;
}

export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 2200);
}

export function addStar() {
  app.stars++;
  document.getElementById('starScore').innerHTML = starIcon + ' ' + app.stars;
  store.setSetting('stars', app.stars);
}

/* ---------- tiempo límite suave (por día, sin castigo: solo cortina amable) ---------- */
let limitTimer = null;
export function armTimeLimit() {
  clearInterval(limitTimer);
  const minutes = Number(app.settings.timeLimit ?? 0);
  document.getElementById('timeUp').hidden = true;
  if (!minutes) return;
  const today = new Date().toISOString().slice(0, 10);
  if (app.settings.timeDay !== today) {
    app.settings.timeDay = today;
    app.settings.timeUsedMs = 0;
    store.setSetting('timeDay', today);
    store.setSetting('timeUsedMs', 0);
  }
  let last = Date.now();
  limitTimer = setInterval(() => {
    const now = Date.now();
    app.settings.timeUsedMs = (app.settings.timeUsedMs ?? 0) + (now - last);
    last = now;
    store.setSetting('timeUsedMs', app.settings.timeUsedMs);
    if (app.settings.timeUsedMs > minutes * 60_000) {
      document.getElementById('timeUp').hidden = false;
      clearInterval(limitTimer);
    }
  }, 5000);
}

/* ---------- navegación ---------- */
const VIEWS = ['draw', 'color', 'learn', 'photo', 'story', 'gallery', 'parents'];
const modules = {};
// Contexto compartido: los modos pueden pasarse datos (p. ej. foto→colorear) sin recargar.
const ctx = { app, toast, addStar, applyI18n, store };
let viewSeq = 0; // la última navegación pedida gana (evita que el boot pise un toque)
let shownView = null; // se inicializa en la primera vista para aplicar .view-enter

async function showView(name) {
  if (!VIEWS.includes(name)) name = 'draw';
  const seq = ++viewSeq;
  const prev = shownView;
  shownView = name;

  // Mostrar la vista de inmediato: algunos modos (puerta de padres) esperan
  // interacción del usuario antes de terminar su montaje.
  for (const v of VIEWS) {
    const el = document.getElementById('view-' + v);
    el.hidden = v !== name;
    if (v !== name) el.classList.remove('view-enter');
  }
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === name)));
  document.getElementById('timeUp').hidden = true;

  const el = document.getElementById('view-' + name);
  if (prev !== name) {
    el.classList.remove('view-enter');
    void el.offsetWidth; // force reflow
    el.classList.add('view-enter');
  }

  try {
    if (!modules[name]) modules[name] = await import('./modes/' + name + '.js?v=6');
    if (seq !== viewSeq) return;
    await modules[name].mount(ctx);
  } catch (err) {
    console.error('mount ' + name, err);
    if (typeof window.__pkShowRepair === 'function') {
      window.__pkShowRepair('No se pudo abrir "' + name + '": ' + (err?.message || err));
    }
    return;
  }
  if (seq !== viewSeq) return;
  applyI18n(el);
}

function currentView() {
  return (location.hash.replace('#/', '') || 'draw').split('/')[0];
}

window.addEventListener('hashchange', () => showView(currentView()));
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => app.go(b.dataset.view)));
window.addEventListener('offline', () => (document.getElementById('offline').hidden = false));
window.addEventListener('online', () => (document.getElementById('offline').hidden = true));

/* ---------- boot ---------- */
function injectTabIcons() {
  const icons = { draw: tabDraw, color: tabColor, learn: tabLearn, photo: tabPhoto, story: tabStory, gallery: tabGallery, parents: tabParents };
  document.querySelectorAll('.tab').forEach((b) => {
    const span = b.querySelector('.tab-icon');
    if (span) span.innerHTML = icons[b.dataset.view] || '';
  });
  const logo = document.getElementById('logo-icon');
  if (logo) logo.innerHTML = crayonLogo;
  const clock = document.getElementById('clock-icon');
  if (clock) clock.innerHTML = clockIcon;
}

async function boot() {
  if ('serviceWorker' in navigator) {
    // Sin recarga forzada: el SW es network-first y la próxima visita ya trae lo nuevo.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  app.settings = await store.getSettings();
  app.lang = normalizeLang(app.settings.lang ?? (navigator.language.startsWith('en') ? 'en' : 'es'));
  app.stars = Number(app.settings.stars ?? 0);
  document.getElementById('starScore').innerHTML = starIcon + ' ' + app.stars;
  injectTabIcons();
  await loadDicts();
  applyI18n();
  if (navigator.onLine === false) document.getElementById('offline').hidden = false;
  window.__pkReady = true;
  await showView(currentView());
  // Si el peque tocó una pestaña mientras arrancaba, respetar su elección.
  if (currentView() !== shownView) await showView(currentView());
  armTimeLimit();
}

boot().catch((e) => {
  console.error('boot:', e);
  document.body.insertAdjacentHTML('beforeend', '<div class="toast">Ups… recarga la página</div>');
});

export { app };
