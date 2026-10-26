/**
 * Dibuja conmigo: el niño dibuja un dibujo del catálogo paso a paso (o una letra trazo a trazo).
 * Cada paso: demostración animada del trazo → el niño repasa → "¡Listo!" puntúa 0–3 estrellas.
 * Nunca bloquea. Al final puede colorear SU dibujo o el modelo.
 */

import { createSurface } from '../ui/surface.js';
import { ACTION_ICONS, fitSquare, iconBtn } from '../ui/parts.js';
import { checkIcon, starIcon } from '../ui/icons.js';
import { celebrate } from '../ui/celebrate.js';
import { parseSteps, svgUpTo } from '../core/svgsteps.js';
import { coverage, samplePoints, starsFor } from '../core/guide.js';
import { LETTERS, letterSvg } from '../core/letters.js';
import { serializeStrokes } from '../core/strokes.js';
import { speak } from '../core/tts.js';

const ACCENT = '#6c5ce7';
const SCORE = 160; // resolución de la puntuación (rápida en móvil)
const INKS = ['#2d3436', '#e17055', '#0984e3', '#00b894', '#6c5ce7', '#e84393'];

const svgImage = (svg) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store, sfx } = ctx;
  const root = document.getElementById('view-learn');
  if (root.__pkLearn) return root.__pkLearn.show();
  root.replaceChildren();
  const en = app.lang === 'en';
  const T = (f) => (en && f.title_en) || f.title;

  /* ---------- elegir: dibujos o letras ---------- */
  const picker = document.createElement('div');
  picker.className = 'learn-picker';
  const head = document.createElement('div');
  head.className = 'color-head';
  head.innerHTML = '<h2></h2><p class="note"></p>';
  head.querySelector('h2').textContent = app.t('learn.title');
  head.querySelector('p').textContent = app.t('learn.pick');
  const tabs = document.createElement('div');
  tabs.className = 'segmented';
  const levelRow = document.createElement('div');
  levelRow.className = 'levelrow';
  const grid = document.createElement('div');
  grid.className = 'grid';
  const letterGrid = document.createElement('div');
  letterGrid.className = 'letter-grid';
  letterGrid.hidden = true;
  picker.append(head, tabs, levelRow, grid, letterGrid);

  for (const [id, key] of [['drawings', 'learn.tab.drawings'], ['letters', 'learn.tab.letters']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.tab = id;
    b.textContent = app.t(key);
    b.setAttribute('aria-pressed', String(id === 'drawings'));
    b.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const letters = id === 'letters';
      letterGrid.hidden = !letters;
      grid.hidden = letters;
      levelRow.hidden = letters;
    });
    tabs.appendChild(b);
  }

  let level = '';
  for (const lv of ['', '1', '2', '3']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip small';
    b.dataset.level = lv;
    b.textContent = lv ? '★'.repeat(Number(lv)) : app.t('color.all');
    b.setAttribute('aria-label', lv ? app.t('color.level' + lv) : app.t('color.all'));
    b.setAttribute('aria-pressed', String(lv === ''));
    b.addEventListener('click', () => {
      level = lv;
      levelRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      renderGrid();
    });
    levelRow.appendChild(b);
  }

  for (const ch of Object.keys(LETTERS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'letter-btn';
    b.dataset.letter = ch;
    b.textContent = ch;
    b.addEventListener('click', () => startLetter(ch));
    letterGrid.appendChild(b);
  }

  let drawings = []; // { pack, file, title, title_en, level, steps }
  async function loadCatalog() {
    const cat = await fetch('/v1/catalog?v=9').then((r) => r.json());
    const packs = await Promise.all(cat.packs.map((p) => fetch(`/v1/catalog/${p.id}?v=9`).then((r) => r.json()).then((d) => ({ id: p.id, files: d.files }))));
    drawings = packs.flatMap((p) => p.files.filter((f) => f.steps?.length).map((f) => ({ ...f, pack: p.id })));
    // más fáciles primero, conservando el orden del catálogo
    drawings = drawings.map((d, i) => ({ d, i })).sort((a, b) => (a.d.level - b.d.level) || a.i - b.i).map((x) => x.d);
    renderGrid();
  }

  function renderGrid() {
    grid.replaceChildren();
    for (const d of drawings) {
      if (level && String(d.level) !== level) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.dataset.testid = 'learn-card';
      b.dataset.level = String(d.level);
      b.innerHTML = `<img alt="" loading="lazy" decoding="async" src="/v1/catalog/${d.pack}/files/${d.file}?v=9"><small></small><span class="level-badge">${'★'.repeat(d.level)}</span>`;
      b.querySelector('small').textContent = `${T(d)} · ${app.t('learn.steps', { n: d.steps.length })}`;
      b.addEventListener('click', () => startDrawing(d));
      grid.appendChild(b);
    }
  }

  /* ---------- lección ---------- */
  const lesson = document.createElement('div');
  lesson.className = 'lesson';
  lesson.hidden = true;

  const top = document.createElement('div');
  top.className = 'color-top';
  const back = iconBtn(ACTION_ICONS.back, app.t('common.back'), closeLesson);
  const titleEl = document.createElement('h2');
  const stepEl = document.createElement('span');
  stepEl.className = 'step-pill';
  stepEl.dataset.testid = 'learn-step';
  const replayBtn = iconBtn('<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>', app.t('learn.replay'), () => renderGuide(true));
  const undoBtn = iconBtn(ACTION_ICONS.undo, app.t('draw.undo'), () => surface.undo());
  top.append(back, titleEl, stepEl, replayBtn, undoBtn);

  const stageBox = document.createElement('div');
  stageBox.className = 'color-stage';
  const stage = document.createElement('div');
  stage.className = 'lesson-stage';
  const guide = document.createElement('div');
  guide.className = 'guide-svg';
  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  stage.append(guide, wrap);
  stageBox.appendChild(stage);

  const bottom = document.createElement('div');
  bottom.className = 'lesson-bottom';
  const inks = document.createElement('div');
  inks.className = 'palette';
  const hint = document.createElement('p');
  hint.className = 'lesson-hint';
  const stepStars = document.createElement('span');
  stepStars.className = 'step-stars';
  stepStars.dataset.testid = 'step-stars';
  const nextBtn = iconBtn(checkIcon + `<small>${app.t('learn.done')}</small>`, app.t('learn.done'), next, 'toolbtn big');
  nextBtn.dataset.testid = 'learn-next';
  bottom.append(inks, hint, stepStars, nextBtn);

  const endCard = document.createElement('div');
  endCard.className = 'overlay learn-end';
  endCard.dataset.testid = 'learn-end';
  endCard.hidden = true;

  lesson.append(top, stageBox, bottom);
  root.append(picker, lesson, endCard);

  // Sin zoom: la guía y la puntuación usan el lienzo sin transformar.
  const surface = createSurface(wrap, { label: app.t('learn.title'), zoom: false });
  surface.state.tool = 'crayon';
  surface.state.size = 9;
  surface.state.color = INKS[0];
  for (const hex of INKS) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'swatch';
    d.style.background = hex;
    d.setAttribute('aria-label', 'color ' + hex);
    d.setAttribute('aria-pressed', String(hex === INKS[0]));
    d.addEventListener('click', () => {
      surface.state.color = hex;
      inks.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s === d)));
    });
    inks.appendChild(d);
  }

  const fit = fitSquare(stageBox, stage, { min: 160 }).refit;

  /* estado de la lección */
  let parsed = null;
  let meta = null; // { title, steps:[{es,en}], kind:'drawing'|'letter', pack, file }
  let n = 1;
  let results = [];
  let demoTimer = 0;

  function open(p, m) {
    parsed = p;
    meta = m;
    n = 1;
    results = [];
    delete root.dataset.lastStars;
    surface.clear();
    picker.hidden = true;
    endCard.hidden = true;
    lesson.hidden = false;
    root.classList.add('learn-mode');
    titleEl.textContent = m.title;
    requestAnimationFrame(() => {
      fit();
      renderGuide(true);
    });
  }

  async function startDrawing(d) {
    const svg = await fetch(`/v1/catalog/${d.pack}/files/${d.file}?v=9`).then((r) => r.text());
    open(parseSteps(svg), { title: T(d), steps: d.steps, kind: 'drawing', pack: d.pack, file: d.file });
  }

  function startLetter(ch) {
    const p = parseSteps(letterSvg(ch));
    const steps = p.steps.map((s) => ({ es: app.t('learn.strokeN', { n: s.n }), en: app.t('learn.strokeN', { n: s.n }) }));
    open(p, { title: app.t('learn.letter', { ch }), steps, kind: 'letter', ch });
    speak(app.t('learn.letter', { ch }), app.lang, ctx);
  }

  function stepName(k) {
    const s = meta.steps[k - 1];
    return (s && (en ? s.en : s.es)) || '';
  }

  /** Guía del paso n: lo anterior en gris; el paso actual se "dibuja solo" y luego queda punteado. */
  function renderGuide(demo) {
    clearTimeout(demoTimer);
    const total = parsed.steps.length;
    stepEl.textContent = app.t('learn.step', { n, total });
    hint.textContent = app.t('learn.now', { step: stepName(n) });
    stepStars.textContent = '';
    stepStars.dataset.stars = '';
    guide.innerHTML = svgUpTo(parsed, n, { earlier: 'dim', current: { stroke: ACCENT } });
    const cur = guide.querySelector(`g[stroke="${ACCENT}"]`);
    if (!cur) return;
    const shapes = [...cur.querySelectorAll('path, circle, ellipse, rect, polygon')];
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dashed = () => {
      for (const el of shapes) {
        el.removeAttribute('pathLength');
        el.style.cssText = '';
      }
      cur.setAttribute('stroke-dasharray', '14 11');
      cur.classList.add('marching');
    };
    if (!demo || still) {
      dashed();
    } else {
      shapes.forEach((el, i) => {
        el.setAttribute('pathLength', '1');
        el.style.strokeDasharray = '1';
        el.style.strokeDashoffset = '1';
        el.style.animation = `guide-draw 0.9s ease-in-out ${i * 0.3}s forwards`;
      });
      demoTimer = setTimeout(dashed, 900 + shapes.length * 300 + 250);
    }
    speak(app.t('learn.now', { step: stepName(n) }), app.lang, ctx);
  }

  /** Puntúa el paso actual: % de la parte VISIBLE de la guía con tinta del niño cerca. */
  async function scoreStep() {
    const img = await svgImage(svgUpTo(parsed, n, { earlier: 'hide', current: { stroke: '#ff00ff' } }));
    const c = document.createElement('canvas');
    c.width = c.height = SCORE;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, SCORE, SCORE);
    const gd = g.getImageData(0, 0, SCORE, SCORE).data;
    const mask = new Uint8Array(SCORE * SCORE);
    for (let i = 0; i < mask.length; i++) {
      const o = i * 4;
      mask[i] = gd[o + 3] > 100 && gd[o] > 180 && gd[o + 1] < 110 && gd[o + 2] > 180 ? 1 : 0;
    }
    g.clearRect(0, 0, SCORE, SCORE);
    g.drawImage(surface.canvas, 0, 0, SCORE, SCORE);
    const ink = g.getImageData(0, 0, SCORE, SCORE).data;
    return starsFor(coverage(samplePoints(mask, SCORE, SCORE, 300), ink, SCORE, 4));
  }

  async function next() {
    if (nextBtn.disabled) return;
    nextBtn.disabled = true;
    try {
      const stars = await scoreStep();
      results.push(stars);
      stepStars.dataset.stars = String(stars);
      root.dataset.lastStars = String(stars); // persiste aunque el siguiente paso limpie la vista
      stepStars.innerHTML = [1, 2, 3].map((k) => `<span class="${k <= stars ? 'on' : ''}">${starIcon}</span>`).join('');
      sfx.play(stars ? 'star' : 'pop');
      if (n < parsed.steps.length) {
        n++;
        await new Promise((r) => setTimeout(r, stars ? 550 : 200));
        renderGuide(true);
      } else {
        finish();
      }
    } finally {
      nextBtn.disabled = false;
    }
  }

  function finish() {
    clearTimeout(demoTimer);
    guide.innerHTML = svgUpTo(parsed, parsed.steps.length, { earlier: 'dim' });
    const avg = results.reduce((a, b) => a + b, 0) / Math.max(1, results.length);
    const rating = Math.max(1, Math.round(avg));
    for (let k = 0; k < rating; k++) addStar();
    celebrate();
    speak(app.t(rating === 3 ? 'learn.great3' : 'learn.great'), app.lang, ctx);
    endCard.innerHTML = `<div class="overlay-card learn-end-card">
      <div class="big-stars">${[1, 2, 3].map((k) => `<span class="${k <= rating ? 'on' : ''}">${starIcon}</span>`).join('')}</div>
      <p></p><div class="btn-row end-actions"></div></div>`;
    endCard.querySelector('p').textContent = app.t(rating === 3 ? 'learn.great3' : 'learn.great');
    const actions = endCard.querySelector('.end-actions');
    const button = (key, testid, onClick, primary = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (primary ? ' primary' : '');
      b.dataset.testid = testid;
      b.textContent = app.t(key);
      b.addEventListener('click', onClick);
      actions.appendChild(b);
    };
    button('learn.colorMine', 'learn-color-mine', colorMine, true);
    if (meta.kind === 'drawing') button('learn.colorModel', 'learn-color-model', colorModel);
    button('learn.save', 'learn-save', saveDrawing);
    button('learn.again', 'learn-again', closeLesson);
    endCard.hidden = false;
  }

  /** Las líneas del niño (engrosadas un poco para cerrar huecos) pasan a Colorear. */
  async function colorMine() {
    const S = 640;
    const off = document.createElement('canvas');
    off.width = off.height = S;
    const c = off.getContext('2d', { willReadFrequently: true });
    c.drawImage(surface.canvas, 0, 0, S, S);
    const d = c.getImageData(0, 0, S, S);
    const on = new Uint8Array(S * S);
    for (let i = 0; i < on.length; i++) on[i] = d.data[i * 4 + 3] > 24 ? 1 : 0;
    for (let i = 0; i < on.length; i++) {
      const x = i % S;
      const near = on[i] || (x > 0 && on[i - 1]) || (x < S - 1 && on[i + 1]) || on[i - S] || on[i + S];
      const o = i * 4;
      d.data[o] = 45;
      d.data[o + 1] = 52;
      d.data[o + 2] = 54;
      d.data[o + 3] = near ? 255 : 0;
    }
    c.putImageData(d, 0, 0);
    await store.putItem({
      id: 'l_' + Date.now().toString(36),
      kind: 'lineart',
      name: meta.title,
      png: off.toDataURL('image/png'),
      thumb: off.toDataURL('image/png'),
    });
    ctx.pendingLineart = { canvas: off, title: meta.title };
    closeLesson(false);
    app.go('color');
  }

  async function colorModel() {
    const img = await svgImage(svgUpTo(parsed, parsed.steps.length));
    const off = document.createElement('canvas');
    off.width = off.height = 640;
    const c = off.getContext('2d');
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 640, 640);
    c.drawImage(img, 640 * 0.04, 640 * 0.04, 640 * 0.92, 640 * 0.92);
    ctx.pendingLineart = { canvas: off, title: meta.title };
    closeLesson(false);
    app.go('color');
  }

  async function saveDrawing() {
    const out = surface.toCanvas(surface.canvas.width, surface.canvas.height, '#ffffff');
    const t = document.createElement('canvas');
    t.width = t.height = 300;
    t.getContext('2d').drawImage(out, 0, 0, 300, 300);
    await store.putItem({
      id: 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: 'drawing',
      name: meta.title,
      strokes: serializeStrokes(surface.strokes),
      thumb: t.toDataURL('image/png'),
      png: out.toDataURL('image/png'),
      bg: '#ffffff',
    });
    toast(app.t('draw.saved'));
  }

  function closeLesson() {
    clearTimeout(demoTimer);
    window.speechSynthesis?.cancel();
    lesson.hidden = true;
    endCard.hidden = true;
    picker.hidden = false;
    root.classList.remove('learn-mode');
  }

  root.__pkLearn = { show() {} };
  loadCatalog().catch(() => toast(app.t('color.loadError')));
  applyI18n(root);
}
