/** Modo Cuentos: libro de páginas dibujadas por el niño, con su voz y exportación PDF. */

import { createSurface } from '../ui/surface.js';
import { btn, toolbar } from '../ui/parts.js';
import { buildPdf, newStory, addPage, setCaption, validateStory } from '../core/story.js';
import { deserializeStrokes } from '../core/strokes.js';
import { renderToCanvas } from '../core/paint.js';
import { speak } from '../core/tts.js';

let editing = null; // { story, item }

export async function mount(ctx) {
  const { app, toast, addStar, applyI18n, store } = ctx;
  const root = document.getElementById('view-story');
  root.replaceChildren();

  const items = (await store.getItems()).filter((i) => i.kind === 'story');

  const head = document.createElement('h2');
  head.textContent = app.t('story.title');
  const newBtn = btn('➕ ' + app.t('story.new'), startNew, 'toolbtn big');
  root.appendChild(head);
  root.appendChild(toolbar(newBtn));

  if (!editing && items.length) {
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const it of items) {
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML = `<span style="font-size:46px">📖</span><small>${escapeHtml(it.name || app.t('story.title'))}</small>`;
      card.addEventListener('click', () => openStory(it));
      grid.appendChild(card);
      const del = btn('🗑️', async (e) => {
        e?.stopPropagation?.();
        await store.deleteItem(it.id);
        mount(ctx);
      });
    }
    root.appendChild(grid);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  }

  async function startNew() {
    const name = prompt(app.t('story.titleAsk'), '');
    if (name === null) return;
    const story = { ...newStory(''), title: name || app.t('story.title'), pages: [] };
    story.pages.push({ drawing: '[]', caption: '', voice: null });
    const item = { id: 's_' + Date.now().toString(36), kind: 'story', name: story.title, story };
    await store.putItem(item);
    editing = { story, item };
    mount(ctx);
  }

  function openStory(item) {
    editing = { story: item.story, item };
    renderEditor();
  }

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

  async function renderEditor() {
    root.replaceChildren();
    const head2 = document.createElement('h2');
    head2.textContent = editing.story.title;
    const back = btn('↩', () => {
      editing = null;
      mount(ctx);
    });
    root.appendChild(toolbar(head2, back));

    const pageCount = editing.story.pages.length;
    for (let pi = 0; pi < pageCount; pi++) {
      const page = editing.story.pages[pi];
      const card = document.createElement('div');
      card.className = 'page-card';
      const lbl = document.createElement('b');
      lbl.textContent = app.t('story.pageOf', { n: pi + 1 });

      const mini = document.createElement('div');
      mini.className = 'mini-canvas';
      card.append(lbl, mini);
      if (items.length) {
        const del = btn('🗑️', async () => {
          await store.deleteItem(it.id);
          editing = null;
          mount(ctx);
        });
        card.appendChild(del);
      }

      const caption = document.createElement('input');
      caption.className = 'caption';
      caption.placeholder = app.t('story.caption');
      caption.value = page.caption;
      caption.addEventListener('change', async () => {
        editing.story = setCaption(editing.story, pi, caption.value);
        await persist();
      });
      card.appendChild(caption);

      const openBtn = btn('✏️ ' + app.t('story.drawHere'), () => openPageEditor(pi), 'toolbtn big');
      card.appendChild(openBtn);

      // voz grabada (si el dispositivo la permite)
      const voiceRow = document.createElement('div');
      voiceRow.className = 'btn-row';
      const recBtn = btn('🎙️', () => recordVoice(pi, voiceRow));
      voiceRow.appendChild(recBtn);
      if (page.voice) {
        const play = document.createElement('audio');
        play.controls = true;
        play.src = page.voice;
        play.style.height = '36px';
        voiceRow.appendChild(play);
      }
      card.appendChild(voiceRow);

      // vista previa del dibujo de la página
      const prev = document.createElement('img');
      const strokes = deserializeStrokes(page.drawing);
      if (strokes.ok && strokes.strokes.length) {
        prev.src = renderToCanvas(strokes.strokes, 360, 270).toDataURL('image/png');
        prev.alt = '';
        prev.style.borderRadius = '12px';
        prev.style.width = '100%';
        card.appendChild(prev);
      }
      root.appendChild(card);
    }

    const bottom = toolbar(
      btn('➕ ' + app.t('story.addPage'), async () => {
        editing.story = addPage(editing.story, { drawing: '[]', caption: '' });
        await persist();
        renderEditor();
      }),
      btn('🔊 ' + app.t('story.read'), readAloud),
      btn('📄 ' + app.t('story.export'), exportPdf),
    );
    root.appendChild(bottom);
    applyI18n(root);
  }

  function openPageEditor(pi) {
    root.replaceChildren();
    const bar = toolbar(
      btn('↩', async () => {
        const strokes = surface.strokes;
        editing.story.pages[pi] = { ...editing.story.pages[pi], drawing: JSON.stringify(strokes.map(serializeOne)) };
        await persist();
        renderEditor();
      }, 'toolbtn big'),
    );
    root.appendChild(bar);
    const wrap = document.createElement('div');
    wrap.className = 'canvas-wrap';
    root.appendChild(wrap);
    const surface = createSurface(wrap, {});
    const st = deserializeStrokes(editing.story.pages[pi].drawing);
    if (st.ok) surface.load(st.strokes);
    surface.state.tool = 'crayon';
  }

  function serializeOne(s) {
    return { t: s.t, c: s.c, s: s.s, p: s.p.map((v) => Math.round(v * 1e4) / 1e4), m: Boolean(s.m), ch: s.ch };
  }

  function readAloud() {
    const text = [editing.story.title, ...editing.story.pages.map((p) => p.caption)].filter(Boolean).join('. ');
    speak(text, app.lang, ctx);
  }

  async function exportPdf() {
    const pages = [];
    for (const pg of editing.story.pages) {
      const st = deserializeStrokes(pg.drawing);
      const entry = { text: pg.caption };
      if (st.ok && st.strokes.length) {
        const canvas = renderToCanvas(st.strokes, 640, 480);
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
        if (blob) {
          entry.imageJpeg = new Uint8Array(await blob.arrayBuffer());
          entry.imageW = 640;
          entry.imageH = 480;
        }
      }
      pages.push(entry);
    }
    try {
      const pdf = buildPdf(pages, { title: editing.story.title });
      const blob = new Blob([pdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
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

  async function recordVoice(pi, row) {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast('🎤 ✗');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: defaultMime() });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          editing.story.pages[pi] = { ...editing.story.pages[pi], voice: String(reader.result) };
          if (await persist()) renderEditor();
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      toast('🎙️…');
      setTimeout(() => rec.stop(), 6000); // máx. 6 s por página: suficiente para una frase
    } catch {
      toast('🎤 ✗');
    }
  }

  function defaultMime() {
    for (const m of ['audio/webm', 'audio/mp4', 'audio/ogg']) {
      if (MediaRecorder.isTypeSupported?.(m)) return m;
    }
    return '';
  }

  if (editing) renderEditor();
  applyI18n(root);
}
