/** Modo Cuentos: libro de páginas dibujadas por el niño, con texto, su voz, lectura y PDF. */

import { createSurface } from '../ui/surface.js';
import { ACTION_ICONS, iconBtn, toolbar } from '../ui/parts.js';
import { checkIcon, tabStory } from '../ui/icons.js';
import { KID_COLORS } from '../ui/colorpicker.js';
import { addPage, buildPdf, newStory, setCaption, validateStory } from '../core/story.js';
import { deserializeStrokes, serializeStrokes } from '../core/strokes.js';
import { renderToCanvas } from '../core/paint.js';
import { speak } from '../core/tts.js';

const PAGE_W = 640;
const PAGE_H = 480;

let editing = null; // { story, item }

/** Imagen de una página: la guardada (v2) o, si es un cuento viejo, re-pintada desde los trazos. */
export function pageImage(pg) {
  if (pg.png) return pg.png;
  const st = deserializeStrokes(pg.drawing ?? '[]');
  if (!st.ok || !st.strokes.length) return null;
  return renderToCanvas(st.strokes, PAGE_W, PAGE_H).toDataURL('image/png');
}

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store } = ctx;
  const root = document.getElementById('view-story');
  root.replaceChildren();
  root.classList.remove('story-drawing');

  if (editing) return renderEditor();

  /* ---------- lista de cuentos ---------- */
  const items = (await store.getItems()).filter((i) => i.kind === 'story').sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const head = document.createElement('div');
  head.className = 'color-head';
  head.innerHTML = '<h2></h2><p class="note"></p>';
  head.querySelector('h2').textContent = app.t('story.title');
  head.querySelector('p').textContent = app.t('story.hint');
  const newBtn = iconBtn(ACTION_ICONS.next + '<small>' + app.t('story.new') + '</small>', app.t('story.new'), startNew, 'toolbtn big');
  newBtn.dataset.testid = 'story-new';
  root.append(head, toolbar(newBtn));

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<div class="empty-art">${tabStory}</div><p></p>`;
    empty.querySelector('p').textContent = app.t('story.empty');
    root.appendChild(empty);
  }

  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'card story-card';
    card.dataset.testid = 'story-card';
    const cover = document.createElement('button');
    cover.type = 'button';
    cover.className = 'story-cover';
    const src = it.story?.pages?.[0] ? pageImage(it.story.pages[0]) : null;
    cover.innerHTML = src ? `<img alt="" src="${src}">` : `<span class="cover-icon">${tabStory}</span>`;
    cover.addEventListener('click', () => {
      editing = { story: it.story, item: it };
      renderEditor();
    });
    const title = document.createElement('small');
    title.textContent = it.name || app.t('story.title');
    const pages = document.createElement('span');
    pages.className = 'note';
    pages.textContent = app.t('story.pages', { n: it.story?.pages?.length ?? 0 });
    const del = iconBtn(ACTION_ICONS.clear, app.t('story.delete'), async () => {
      if (!confirm(app.t('story.deleteConfirm'))) return;
      await store.deleteItem(it.id);
      mount(ctx);
    }, 'toolbtn slim del');
    del.dataset.testid = 'story-delete';
    card.append(cover, title, pages, del);
    grid.appendChild(card);
  }
  root.appendChild(grid);
  applyI18n(root);

  async function startNew() {
    const name = prompt(app.t('story.titleAsk'), '');
    if (name === null) return;
    const story = { ...newStory(''), title: name || app.t('story.title'), pages: [] };
    story.pages.push({ drawing: '[]', caption: '', voice: null });
    const item = { id: 's_' + Date.now().toString(36), kind: 'story', name: story.title, story };
    await store.putItem(item);
    editing = { story, item };
    renderEditor();
  }

  /* ---------- editor ---------- */
  async function persist() {
    const errors = validateStory(editing.story);
    if (errors.length) {
      toast('⚠️ ' + errors[0]);
      return false;
    }
    editing.item.story = editing.story;
    editing.item.name = editing.story.title;
    await store.putItem(editing.item);
    return true;
  }

  function renderEditor() {
    root.replaceChildren();
    root.classList.remove('story-drawing');
    const bar = document.createElement('div');
    bar.className = 'color-top';
    const back = iconBtn(ACTION_ICONS.back, app.t('common.back'), () => {
      editing = null;
      mount(ctx);
    });
    back.dataset.testid = 'story-list';
    const title = document.createElement('h2');
    title.textContent = editing.story.title;
    bar.append(back, title);
    root.appendChild(bar);

    editing.story.pages.forEach((pg, pi) => {
      const card = document.createElement('div');
      card.className = 'page-card';
      const lbl = document.createElement('b');
      lbl.textContent = app.t('story.pageOf', { n: pi + 1 });

      const mini = document.createElement('button');
      mini.type = 'button';
      mini.className = 'mini-canvas';
      mini.dataset.testid = 'story-draw';
      mini.setAttribute('aria-label', app.t('story.drawHere'));
      const src = pageImage(pg);
      mini.innerHTML = src ? `<img alt="" src="${src}">` : `<span class="mini-hint">${app.t('story.drawHere')}</span>`;
      mini.addEventListener('click', () => openPageEditor(pi));

      const caption = document.createElement('input');
      caption.className = 'caption';
      caption.type = 'text';
      caption.placeholder = app.t(pi === 0 ? 'story.caption1' : 'story.captionN');
      caption.value = pg.caption;
      caption.addEventListener('change', async () => {
        editing.story = setCaption(editing.story, pi, caption.value);
        await persist();
      });

      const row = document.createElement('div');
      row.className = 'btn-row';
      const rec = iconBtn('🎙️<small>' + app.t('story.record') + '</small>', app.t('story.record'), () => recordVoice(pi), 'toolbtn slim');
      row.appendChild(rec);
      if (pg.voice) {
        const play = document.createElement('audio');
        play.controls = true;
        play.src = pg.voice;
        row.appendChild(play);
      }
      if (editing.story.pages.length > 1) {
        const delPage = iconBtn(ACTION_ICONS.clear, app.t('story.deletePage'), async () => {
          if (!confirm(app.t('story.deletePage') + '?')) return;
          editing.story = { ...editing.story, pages: editing.story.pages.filter((_, k) => k !== pi) };
          await persist();
          renderEditor();
        }, 'toolbtn slim');
        row.appendChild(delPage);
      }
      card.append(lbl, mini, caption, row);
      root.appendChild(card);
    });

    const addBtn = iconBtn(ACTION_ICONS.next + '<small>' + app.t('story.addPage') + '</small>', app.t('story.addPage'), async () => {
      editing.story = addPage(editing.story, { drawing: '[]', caption: '' });
      await persist();
      renderEditor();
    });
    addBtn.dataset.testid = 'story-addpage';
    const readBtn = iconBtn(tabStory + '<small>' + app.t('story.read') + '</small>', app.t('story.read'), openReader, 'toolbtn big');
    readBtn.dataset.testid = 'story-read';
    const pdfBtn = iconBtn(ACTION_ICONS.download + '<small>' + app.t('story.export') + '</small>', app.t('story.export'), exportPdf);
    pdfBtn.dataset.testid = 'story-pdf';
    root.appendChild(toolbar(addBtn, readBtn, pdfBtn));
    applyI18n(root);
  }

  /* ---------- dibujar una página ---------- */
  function openPageEditor(pi) {
    root.replaceChildren();
    root.classList.add('story-drawing');
    const bar = document.createElement('div');
    bar.className = 'color-top';
    const label = document.createElement('h2');
    label.textContent = `${editing.story.title} · ${app.t('story.pageOf', { n: pi + 1 })}`;
    const undo = iconBtn(ACTION_ICONS.undo, app.t('draw.undo'), () => surface.undo());
    const done = iconBtn(checkIcon + `<small>${app.t('learn.done')}</small>`, app.t('learn.done'), async () => {
      const out = surface.toCanvas(PAGE_W, PAGE_H, '#ffffff');
      editing.story.pages[pi] = {
        ...editing.story.pages[pi],
        drawing: serializeStrokes(surface.strokes),
        png: surface.strokes.length ? out.toDataURL('image/jpeg', 0.85) : null,
      };
      await persist();
      renderEditor();
    }, 'toolbtn save');
    done.dataset.testid = 'story-back';
    bar.append(label, undo, done);

    const stage = document.createElement('div');
    stage.className = 'story-stage';
    const wrap = document.createElement('div');
    wrap.className = 'canvas-wrap';
    stage.appendChild(wrap);
    const pal = document.createElement('div');
    pal.className = 'palette tray-palette story-palette';
    root.append(bar, stage, pal);

    const surface = createSurface(wrap, {});
    const st = deserializeStrokes(editing.story.pages[pi].drawing);
    if (st.ok) surface.load(st.strokes);
    surface.state.tool = 'crayon';
    surface.state.color = KID_COLORS[23];
    for (const hex of KID_COLORS) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'swatch';
      d.style.background = hex;
      d.setAttribute('aria-label', 'color ' + hex);
      d.setAttribute('aria-pressed', String(hex === surface.state.color));
      d.addEventListener('click', () => {
        surface.state.color = hex;
        pal.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s === d)));
      });
      pal.appendChild(d);
    }
  }

  /* ---------- leer el cuento (paso de página animado) ---------- */
  function openReader() {
    const pages = editing.story.pages;
    let k = 0;
    const layer = document.createElement('div');
    layer.className = 'overlay story-reader';
    layer.innerHTML = `<div class="reader-book">
        <div class="reader-sheet"><div class="reader-img"></div><p class="reader-text"></p></div>
        <div class="reader-nav">
          <button type="button" class="btn" data-testid="reader-prev"></button>
          <span class="step-pill" data-testid="reader-page"></span>
          <button type="button" class="btn primary" data-testid="reader-next"></button>
        </div>
        <button type="button" class="btn reader-close"></button>
      </div>`;
    const sheet = layer.querySelector('.reader-sheet');
    const prev = layer.querySelector('[data-testid="reader-prev"]');
    const next = layer.querySelector('[data-testid="reader-next"]');
    prev.textContent = '←';
    prev.setAttribute('aria-label', app.t('story.prev'));
    next.textContent = '→';
    next.setAttribute('aria-label', app.t('story.next'));
    const close = layer.querySelector('.reader-close');
    close.textContent = app.t('common.close');
    const show = (dir) => {
      const pg = pages[k];
      const src = pageImage(pg);
      layer.querySelector('.reader-img').innerHTML = src ? `<img alt="" src="${src}">` : '';
      layer.querySelector('.reader-text').textContent = pg.caption || '';
      layer.querySelector('[data-testid="reader-page"]').textContent = app.t('story.pageOf', { n: k + 1 });
      prev.disabled = k === 0;
      next.textContent = k === pages.length - 1 ? '✓' : '→';
      sheet.classList.remove('turn-next', 'turn-prev');
      void sheet.offsetWidth;
      if (dir) sheet.classList.add(dir > 0 ? 'turn-next' : 'turn-prev');
      if (pg.voice) new Audio(pg.voice).play().catch(() => {});
      else speak([k === 0 ? editing.story.title : '', pg.caption].filter(Boolean).join('. '), app.lang, ctx);
    };
    prev.addEventListener('click', () => {
      if (k > 0) {
        k--;
        show(-1);
      }
    });
    next.addEventListener('click', () => {
      if (k < pages.length - 1) {
        k++;
        show(1);
      } else {
        layer.remove();
        addStar();
      }
    });
    close.addEventListener('click', () => {
      window.speechSynthesis?.cancel();
      layer.remove();
    });
    document.body.appendChild(layer);
    show(0);
  }

  /* ---------- PDF ---------- */
  async function exportPdf() {
    const pages = [];
    for (const pg of editing.story.pages) {
      const entry = { text: pg.caption };
      const src = pageImage(pg);
      if (src) {
        const img = await new Promise((res) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = () => res(null);
          i.src = src;
        });
        if (img) {
          const c = document.createElement('canvas');
          c.width = PAGE_W;
          c.height = PAGE_H;
          const g = c.getContext('2d');
          g.fillStyle = '#fff';
          g.fillRect(0, 0, PAGE_W, PAGE_H);
          g.drawImage(img, 0, 0, PAGE_W, PAGE_H);
          const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
          if (blob) {
            entry.imageJpeg = new Uint8Array(await blob.arrayBuffer());
            entry.imageW = PAGE_W;
            entry.imageH = PAGE_H;
          }
        }
      }
      pages.push(entry);
    }
    try {
      const pdf = buildPdf(pages, { title: editing.story.title });
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = (editing.story.title || 'pintakids') + '.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      addStar();
    } catch (e) {
      toast('⚠️ ' + e.message);
    }
  }

  /* ---------- voz grabada ---------- */
  async function recordVoice(pi) {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('🎤 ✗');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const reader = new FileReader();
        reader.onload = async () => {
          editing.story.pages[pi] = { ...editing.story.pages[pi], voice: String(reader.result) };
          if (await persist()) renderEditor();
        };
        reader.readAsDataURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.start();
      toast('🎙️…');
      setTimeout(() => rec.stop(), 6000); // máx. 6 s por página: una frase
    } catch {
      toast('🎤 ✗');
    }
  }
}
