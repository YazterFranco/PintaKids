/** Galería: todo lo que el niño ha creado, con abrir/compartir/borrar. */

import { btn, toolbar, iconBtn, ACTION_ICONS } from '../ui/parts.js';
import { deserializeStrokes } from '../core/strokes.js';
import { renderToCanvas } from '../core/paint.js';
import { tabColor, tabDraw, tabPhoto, tabStory } from '../ui/icons.js';

const KIND_ICON = { drawing: tabDraw, colored: tabColor, lineart: tabPhoto, story: tabStory };

export async function mount(ctx) {
  const { app, toast, applyI18n, store } = ctx;
  const root = document.getElementById('view-gallery');
  root.replaceChildren();

  const head = document.createElement('h2');
  head.textContent = app.t('gallery.title');
  root.appendChild(head);

  const items = (await store.getItems()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'panel note';
    empty.textContent = app.t('gallery.empty');
    root.appendChild(empty);
    applyI18n(root);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid';
  root.appendChild(grid);

  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'card thumb';
    const img = document.createElement('img');
    img.alt = it.name ?? '';
    if (it.thumb) img.src = it.thumb;
    else if (it.png) img.src = it.png;
    else {
      const st = deserializeStrokes(it.strokes ?? '[]');
      img.src = st.ok ? renderToCanvas(st.strokes, 220, 220).toDataURL() : '';
    }
    const label = document.createElement('small');
    label.innerHTML = `<span style="display:inline-flex;vertical-align:middle;width:16px;height:16px">${KIND_ICON[it.kind] ?? tabDraw}</span> ${(it.name ?? '')}`;
    const actions = document.createElement('div');
    actions.className = 'btn-row';

    if (it.kind === 'story') {
      actions.appendChild(iconBtn(tabStory, 'Abrir cuento', () => app.go('story')));
    }
    actions.appendChild(iconBtn(ACTION_ICONS.export, 'Compartir', () => share(it), 'toolbtn'));
    const del = iconBtn(ACTION_ICONS.clear, 'Borrar', async () => {
      if (!confirm(app.t('gallery.delete') + '?')) return;
      await store.deleteItem(it.id);
      mount(ctx);
    });
    del.classList.add('del');
    del.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    actions.appendChild(del);

    card.append(img, label, actions);
    grid.appendChild(card);
  }

  async function share(it) {
    const blob = await itemBlob(it);
    if (!blob) return;
    const file = new File([blob], (it.name || 'pintakids') + '.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Pintakids' });
        return;
      } catch {
        /* el niño canceló: seguir al fallback */
      }
    }
    // Fallback Android: puente nativo (guarda a la galería del teléfono).
    if (window.PintakidsBridge?.saveImage) {
      const dataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(blob);
      });
      window.PintakidsBridge.saveImage(String(dataUrl), (it.name || 'pintakids') + '.png');
      toast('📲');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (it.name || 'pintakids') + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function itemBlob(it) {
    if (it.png) {
      const r = await fetch(it.png);
      return r.blob();
    }
    const st = deserializeStrokes(it.strokes ?? '[]');
    if (!st.ok) return null;
    const canvas = renderToCanvas(st.strokes, 1024, 1024, it.bg || "#ffffff");
    return new Promise((res) => canvas.toBlob(res, 'image/png'));
  }

  applyI18n(root);
}
