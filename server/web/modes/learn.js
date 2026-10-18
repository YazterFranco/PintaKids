/** Modo Aprender: lecciones de trazo a trazo + repaso de letras y números con voz. */

import { createSurface } from '../ui/surface.js';
import { btn, toolbar } from '../ui/parts.js';
import { speak } from '../core/tts.js';

// Guías: puntos normalizados de trazos punteados que el niño repasa (originales del proyecto).
const LESSONS = [
  {
    id: 'sol', name: '☀️', words: { es: 'Sol', en: 'Sun' },
    steps: [
      { guide: [[0.5, 0.5], [0.7, 0.5], [0.7, 0.3], [0.5, 0.3], [0.3, 0.3], [0.3, 0.5], [0.5, 0.5], [0.7, 0.7], [0.5, 0.7], [0.3, 0.7], [0.3, 0.5]] },
      { rays: true },
    ],
  },
  {
    id: 'casa', name: '🏠', words: { es: 'Casa', en: 'House' },
    steps: [
      { guide: [[0.25, 0.55], [0.75, 0.55], [0.75, 0.9], [0.25, 0.9], [0.25, 0.55]] },
      { guide: [[0.2, 0.55], [0.5, 0.3], [0.8, 0.55]] },
      { guide: [[0.42, 0.9], [0.42, 0.68], [0.58, 0.68], [0.58, 0.9]] },
    ],
  },
  {
    id: 'gato', name: '🐱', words: { es: 'Gato', en: 'Cat' },
    steps: [
      { circle: [0.5, 0.5, 0.22] },
      { guide: [[0.33, 0.34], [0.37, 0.2], [0.45, 0.31]] },
      { guide: [[0.67, 0.34], [0.63, 0.2], [0.55, 0.31]] },
      { dots: [[0.43, 0.47], [0.57, 0.47]], guide: [[0.47, 0.58], [0.5, 0.61], [0.53, 0.58]] },
    ],
  },
  {
    id: 'cohete', name: '🚀', words: { es: 'Cohete', en: 'Rocket' },
    steps: [
      { guide: [[0.35, 0.75], [0.35, 0.4], [0.5, 0.2], [0.65, 0.4], [0.65, 0.75], [0.35, 0.75]] },
      { circle: [0.5, 0.42, 0.08] },
      { guide: [[0.35, 0.6], [0.2, 0.8], [0.35, 0.75]] },
      { guide: [[0.65, 0.6], [0.8, 0.8], [0.65, 0.75]] },
    ],
  },
  {
    id: 'pajarito', name: '🐤', words: { es: 'Pájaro', en: 'Bird' },
    steps: [
      { circle: [0.45, 0.5, 0.2] },
      { circle: [0.68, 0.34, 0.12] },
      { guide: [[0.78, 0.32], [0.88, 0.36], [0.78, 0.4]] },
      { guide: [[0.3, 0.5], [0.15, 0.42], [0.2, 0.58]] },
    ],
  },
  {
    id: 'flor', name: '🌸', words: { es: 'Flor', en: 'Flower' },
    steps: [
      { circle: [0.5, 0.35, 0.1] },
      { petals: true },
      { guide: [[0.5, 0.62], [0.5, 0.9]] },
      { guide: [[0.5, 0.78], [0.32, 0.7], [0.5, 0.72]] },
    ],
  },
];

const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789'.split('');

function drawGuide(c, step, w, h) {
  c.save();
  c.strokeStyle = '#b9a7e6';
  c.lineWidth = Math.max(6, w / 70);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.setLineDash([w / 60, w / 30]);
  if (step.guide) {
    c.beginPath();
    step.guide.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)));
    c.stroke();
  }
  if (step.circle) {
    const [cx, cy, r] = step.circle;
    c.beginPath();
    c.arc(cx * w, cy * h, r * w, 0, Math.PI * 2);
    c.stroke();
  }
  if (step.rays) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      c.beginPath();
      c.moveTo(0.5 * w + Math.cos(a) * 0.28 * w, 0.5 * h + Math.sin(a) * 0.28 * h);
      c.lineTo(0.5 * w + Math.cos(a) * 0.4 * w, 0.5 * h + Math.sin(a) * 0.4 * h);
      c.stroke();
    }
  }
  if (step.petals) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      c.beginPath();
      c.arc(0.5 * w + Math.cos(a) * 0.17 * w, 0.42 * h + Math.sin(a) * 0.17 * h, 0.09 * w, 0, Math.PI * 2);
      c.stroke();
    }
  }
  if (step.dots) {
    c.setLineDash([]);
    c.fillStyle = '#b9a7e6';
    for (const [x, y] of step.dots) {
      c.beginPath();
      c.arc(x * w, y * h, w / 60, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (step.letter) {
    c.setLineDash([w / 55, w / 28]);
    c.font = `bold ${w * 0.7}px system-ui`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeStyle = '#b9a7e6';
    c.strokeText(step.letter, w / 2, h / 2);
  }
  c.restore();
}

export async function mount(ctx) {
  const { app, addStar, applyI18n } = ctx;
  const root = document.getElementById('view-learn');
  root.replaceChildren();

  const head = document.createElement('h2');
  head.textContent = app.t('learn.title');
  const letterBtn = btn('🔤', openLetters, 'toolbtn big');
  root.appendChild(head);
  root.appendChild(letterBtn);

  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const lesson of LESSONS) {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `<span style="font-size:46px">${lesson.name}</span><small>${lesson.words[app.lang] ?? lesson.words.es}</small>`;
    card.addEventListener('click', () => openLesson(lesson)); card.dataset.testid='learn-card';
    grid.appendChild(card);
  }
  root.appendChild(grid);

  let stepIdx = 0;
  let surface = null;
  let wrap = null;
  let stepsRow = null;
  let lessonBar = null;
  let current = null;

  function ensureCanvas() {
    if (wrap) return;
    wrap = document.createElement('div');
    wrap.className = 'canvas-wrap';
    root.appendChild(wrap);
    stepsRow = document.createElement('div');
    stepsRow.className = 'steps';
    lessonBar = toolbar(
      btn('↩️', () => surface.undo()),
      btn('🧽', () => surface.clear()),
      (()=>{const b=btn('✅ '+app.t('learn.tapNext'), nextStep, 'toolbtn big'); b.dataset.testid='learn-next'; return b})(),
      btn('↩', () => backToGrid()),
    );
    root.appendChild(stepsRow);
    root.appendChild(lessonBar);
    surface = createSurface(wrap, {
      paint: async (c, strokes, live, w, h) => {
        for (let i = 0; i < Math.min(stepIdx + 1, current?.steps.length ?? 0); i++) drawGuide(c, current.steps[i], w, h);
        const { paintAll, paintStroke } = await import('../core/paint.js');
        paintAll(c, strokes, w, h);
        if (live) paintStroke(c, live, w, h);
      },
    });
    surface.state.tool = 'crayon';
  }

  function backToGrid() {
    for (const el of [wrap, stepsRow, lessonBar]) {
      el?.remove();
    }
    wrap = null;
    stepsRow = null;
    lessonBar = null;
    surface = null;
    grid.hidden = false;
    letterBtn.hidden = false;
  }

  function drawStep() {
    surface.redraw();
    stepsRow.replaceChildren();
    current.steps.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'dot-step' + (i <= stepIdx ? ' on' : '');
      stepsRow.appendChild(d);
    });
    speak(`${current.words[app.lang] ?? current.words.es}`, app.lang, ctx);
  }

  function openLesson(lesson) {
    current = lesson;
    stepIdx = 0;
    grid.hidden = true;
    letterBtn.hidden = true;
    ensureCanvas();
    surface.clear();
    drawStep();
  }

  function nextStep() {
    if (stepIdx < current.steps.length - 1) {
      stepIdx++;
      drawStep();
    } else {
      addStar();
      speak(app.lang === 'en' ? 'Great job!' : '¡Muy bien!', app.lang, ctx);
      backToGrid();
    }
  }

  function openLetters() {
    current = { words: { es: 'Letras', en: 'Letters' }, steps: LETTERS.map((l) => ({ letter: l })) };
    stepIdx = 0;
    grid.hidden = true;
    letterBtn.hidden = true;
    ensureCanvas();
    surface.clear();
    drawStep();
  }

  applyI18n(root);
}
