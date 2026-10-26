/** Arranque: i18n, navegación por pestañas, ajustes, límites de tiempo y SW. */

import { store } from './core/store.js';
import { DEFAULT_LANG, normalizeLang, t } from './core/i18n.js';
import { starIcon, crayonLogo, homeIcon, lockIcon, clockIcon } from './ui/icons.js';
import { applyTheme } from './modes/parents.js';
import { sfx } from './core/sfx.js';

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
    fetch('/i18n/es.json?v=9').then((r) => r.json()),
    fetch('/i18n/en.json?v=9').then((r) => r.json()),
  ]);
  app.base = { es, en };
}

export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = app.t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = app.t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title); // los lectores de pantalla también cambian de idioma
  }
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
  const el = document.getElementById('starScore');
  el.innerHTML = starIcon + ' ' + app.stars;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  sfx.play('star');
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
const VIEWS = ['home', 'draw', 'learn', 'color', 'photo', 'story', 'gallery', 'parents'];
const TITLES = { home: 'app.name', draw: 'tab.draw', learn: 'tab.learn', color: 'tab.color', photo: 'tab.photo', story: 'tab.story', gallery: 'tab.gallery', parents: 'tab.parents' };
const modules = {};
// Contexto compartido: los modos pueden pasarse datos (p. ej. foto→colorear) sin recargar.
const ctx = { app, toast, addStar, applyI18n, store, sfx, armTimeLimit };
let viewSeq = 0; // la última navegación pedida gana (evita que el boot pise un toque)
let shownView = null; // se inicializa en la primera vista para aplicar .view-enter

async function showView(name) {
  if (!VIEWS.includes(name)) name = 'home';
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
  document.body.dataset.view = name;
  const title = document.getElementById('appbar-title');
  title.dataset.i18n = TITLES[name];
  title.textContent = app.t(TITLES[name]);
  document.getElementById('timeUp').hidden = true;

  const el = document.getElementById('view-' + name);
  if (prev !== name) {
    el.classList.remove('view-enter');
    void el.offsetWidth; // force reflow
    el.classList.add('view-enter');
  }

  try {
    if (!modules[name]) modules[name] = await import('./modes/' + name + '.js?v=9');
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
  return (location.hash.replace('#/', '') || 'home').split('/')[0];
}

window.addEventListener('hashchange', () => showView(currentView()));
document.querySelector('.appbar-home').addEventListener('click', () => app.go('home'));
document.querySelector('.appbar-lock').addEventListener('click', () => app.go('parents'));
function showOffline() {
  const el = document.getElementById('offline');
  el.hidden = false;
  clearTimeout(showOffline._t);
  showOffline._t = setTimeout(() => (el.hidden = true), 5000);
}
window.addEventListener('offline', showOffline);
window.addEventListener('online', () => (document.getElementById('offline').hidden = true));

/* ---------- boot ---------- */
function injectIcons() {
  document.querySelector('.appbar-home').innerHTML = homeIcon;
  document.querySelector('.appbar-lock').innerHTML = lockIcon;
  const logo = document.getElementById('logo-icon');
  if (logo) logo.innerHTML = crayonLogo;
  const clock = document.getElementById('clock-icon');
  if (clock) clock.innerHTML = clockIcon;
}

async function boot() {
  // En el APK todo ya es local (y el SW del WebView saltaría el servidor de assets): sin SW.
  if ('serviceWorker' in navigator && !window.PintakidsBridge) {
    // Sin recarga forzada: el SW es network-first y la próxima visita ya trae lo nuevo.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  app.settings = await store.getSettings();
  app.lang = normalizeLang(app.settings.lang ?? (navigator.language.startsWith('en') ? 'en' : 'es'));
  app.stars = Number(app.settings.stars ?? 0);
  applyTheme(app.settings.theme ?? 'auto');
  sfx.setEnabled(app.settings.sfx);
  document.getElementById('starScore').innerHTML = starIcon + ' ' + app.stars;
  injectIcons();
  await loadDicts();
  applyI18n();
  if (navigator.onLine === false) showOffline();
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
