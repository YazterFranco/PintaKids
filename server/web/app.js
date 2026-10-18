/** Arranque: i18n, navegación por pestañas, ajustes, límites de tiempo y SW. */

import { store } from './core/store.js';
import { DEFAULT_LANG, normalizeLang, t } from './core/i18n.js';

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
    fetch('/i18n/es.json').then((r) => r.json()),
    fetch('/i18n/en.json').then((r) => r.json()),
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
  document.getElementById('starScore').textContent = '⭐ ' + app.stars;
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

async function showView(name) {
  if (!VIEWS.includes(name)) name = 'draw';
  for (const v of VIEWS) {
    const el = document.getElementById('view-' + v);
    el.hidden = v !== name;
  }
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === name)));
  document.getElementById('timeUp').hidden = true;
  if (!modules[name]) modules[name] = await import('./modes/' + name + '.js');
  await modules[name].mount(ctx);
  applyI18n(document.getElementById('view-' + name));
}

function currentView() {
  return (location.hash.replace('#/', '') || 'draw').split('/')[0];
}

window.addEventListener('hashchange', () => showView(currentView()));
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => app.go(b.dataset.view)));
window.addEventListener('offline', () => (document.getElementById('offline').hidden = false));
window.addEventListener('online', () => (document.getElementById('offline').hidden = true));

/* ---------- boot ---------- */
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  app.settings = await store.getSettings();
  app.lang = normalizeLang(app.settings.lang ?? (navigator.language.startsWith('en') ? 'en' : 'es'));
  app.stars = Number(app.settings.stars ?? 0);
  document.getElementById('starScore').textContent = '⭐ ' + app.stars;
  await loadDicts();
  applyI18n();
  if (navigator.onLine === false) document.getElementById('offline').hidden = false;
  await showView(currentView());
  armTimeLimit();
}

boot().catch((e) => {
  console.error('boot:', e);
  document.body.insertAdjacentHTML('beforeend', '<div class="toast">Ups… recarga la página 🙏</div>');
});

export { app };
