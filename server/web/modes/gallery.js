/** Galería: todo lo que el niño ha creado. Abrir para seguir, compartir o borrar. */

import { ACTION_ICONS, iconBtn } from '../ui/parts.js';
import { shareIcon, tabColor, tabDraw, tabPhoto, tabStory, tabGallery } from '../ui/icons.js';
import { shareBlob } from '../ui/share.js';
import { deserializeStrokes } from '../core/strokes.js';
import { renderToCanvas } from '../core/paint.js';
import { pageImage } from './story.js';

const KIND_ICON = { drawing: tabDraw, colored: tabColor, lineart: tabPhoto, story: tabStory };

const loadImg = (src) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

export async function mount(ctx) {
  const { app, toast, applyI18n, store } = ctx;
  const root = document.getElementById('view-gallery');
  root.replaceChildren();

  const head = document.createElement('div');
  head.className = 'color-head';
  head.innerHTML = '<h2></h2>';
  head.querySelector('h2').textContent = app.t('gallery.title');
  root.appendChild(head);

  const items = (await store.getItems()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<div class="empty-art">${tabGallery}</div><p></p>`;
    empty.querySelector('p').textContent = app.t('gallery.empty');
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn primary';
    go.textContent = app.t('home.draw');
    go.addEventListener('click', () => app.go('draw'));
    empty.appendChild(go);
    root.appendChild(empty);
    applyI18n(root);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid gallery-grid';
  root.appendChild(grid);

  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'card thumb';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'thumb-open';
    open.dataset.testid = 'gallery-open';
    open.setAttribute('aria-label', app.t('gallery.openItem'));
    const img = document.createElement('img');
    img.alt = it.name ?? '';
    img.src = it.thumb || it.png || (it.kind === 'story' ? storyCover(it) : preview(it));
    open.appendChild(img);
    open.addEventListener('click', () => openItem(it));

    const label = document.createElement('small');
    label.innerHTML = `<span class="kind-icon">${KIND_ICON[it.kind] ?? tabDraw}</span>`;
    label.append(document.createTextNode(it.name ?? ''));

    const actions = document.createElement('div');
    actions.className = 'btn-row thumb-actions';
    actions.appendChild(iconBtn(shareIcon, app.t('gallery.share'), () => share(it), 'toolbtn slim'));
    const del = iconBtn(ACTION_ICONS.clear, app.t('gallery.delete'), async () => {
      if (!confirm(app.t('gallery.deleteConfirm'))) return;
      await store.deleteItem(it.id);
      mount(ctx);
    }, 'toolbtn slim');
    actions.appendChild(del);
    card.append(open, label, actions);
    grid.appendChild(card);
  }
  applyI18n(root);

  function storyCover(it) {
    const pg = it.story?.pages?.find((p) => pageImage(p));
    return pg ? pageImage(pg) : '';
  }

  function preview(it) {
    const st = deserializeStrokes(it.strokes ?? '[]');
    return st.ok ? renderToCanvas(st.strokes, 220, 220, it.bg || '#ffffff').toDataURL() : '';
  }

  async function openItem(it) {
    if (it.kind === 'drawing') {
      // Lo que estaba sin guardar en Dibujar no se pierde: va a la galería antes de abrir el otro.
      const cur = app.settings.drawDraft ?? (await store.getSettings()).drawDraft;
      if (cur?.dirty && cur.itemId !== it.id && hasStrokes(cur.strokes)) await keepDraft(cur);
      // Dibujar recoge el borrador al montarse (o al volver, si ya estaba montado).
      const draft = { strokes: it.strokes ?? '[]', bg: it.bgKey ?? 'white', page: it.page ?? null, itemId: it.id, dirty: false };
      app.settings.drawDraft = draft;
      app.settings.drawOpenRequest = true;
      await store.setSetting('drawDraft', draft);
      return app.go('draw');
    }
    if (it.kind === 'lineart' && it.png) {
      const im = await loadImg(it.png);
      const c = document.createElement('canvas');
      c.width = c.height = 640;
      c.getContext('2d').drawImage(im, 0, 0, 640, 640);
      ctx.pendingLineart = { canvas: c, title: it.name };
      return app.go('color');
    }
    if (it.kind === 'story') return app.go('story');
    viewer(it);
  }

  function hasStrokes(json) {
    const st = deserializeStrokes(json ?? '[]');
    return st.ok && st.strokes.length > 0;
  }

  async function keepDraft(d) {
    const st = deserializeStrokes(d.strokes);
    const bg = d.bgColor ?? '#ffffff';
    const thumb = d.thumb ?? renderToCanvas(st.strokes, 300, 300, bg).toDataURL('image/png');
    await store.putItem({
      id: d.itemId ?? 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: 'drawing',
      name: app.t('draw.title'),
      strokes: d.strokes,
      thumb,
      bg,
      bgKey: d.bg ?? 'white',
      page: d.page ?? null,
    });
    toast(app.t('gallery.autoSaved'));
  }

  function viewer(it) {
    const layer = document.createElement('div');
    layer.className = 'overlay';
    layer.innerHTML = `<div class="overlay-card viewer-card"><img alt=""><div class="btn-row"></div></div>`;
    layer.querySelector('img').src = it.png || it.thumb;
    const row = layer.querySelector('.btn-row');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn';
    close.textContent = app.t('common.close');
    close.addEventListener('click', () => layer.remove());
    const sh = document.createElement('button');
    sh.type = 'button';
    sh.className = 'btn primary';
    sh.textContent = app.t('gallery.share');
    sh.addEventListener('click', () => share(it));
    row.append(sh, close);
    layer.addEventListener('click', (e) => e.target === layer && layer.remove());
    document.body.appendChild(layer);
  }

  async function share(it) {
    let blob = null;
    const src = it.png || (it.kind === 'story' ? storyCover(it) : '');
    if (src) blob = await (await fetch(src)).blob();
    else {
      const st = deserializeStrokes(it.strokes ?? '[]');
      if (st.ok) blob = await new Promise((res) => renderToCanvas(st.strokes, 1024, 1024, it.bg || '#ffffff').toBlob(res, 'image/png'));
    }
    if (blob) await shareBlob(blob, it.name || 'pintakids', toast);
  }
}
