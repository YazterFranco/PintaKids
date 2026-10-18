/** Galería: todo lo que el niño ha creado, con abrir/compartir/borrar. */

import { btn, toolbar } from '../ui/parts.js';
import { deserializeStrokes } from '../core/strokes.js';
import { renderToCanvas } from '../core/paint.js';

const KIND_EMOJI = { drawing: '🎨', colored: '🖍️', lineart: '📷', story: '📖' };

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
    label.textContent = (KIND_EMOJI[it.kind] ?? '🎨') + ' ' + (it.name ?? '');
    const actions = document.createElement('div');
    actions.className = 'btn-row';

    if (it.kind === 'story') {
      actions.appendChild(btn('📖', () => app.go('story')));
    }
    actions.appendChild(btn('📤', () => share(it), 'toolbtn'));
    const del = btn('🗑️', async () => {
      if (!confirm(app.t('gallery.delete') + '?')) return;
      await store.deleteItem(it.id);
      toast('🗑️');
      mount(ctx);
    });
    del.classList.add('del');
    del.textContent = '×';
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
