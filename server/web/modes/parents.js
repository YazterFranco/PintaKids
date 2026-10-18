/** Zona de padres: puerta matemática, idioma, sonido, tiempo, respaldo, créditos y borrado. */

import { btn, toolbar } from '../ui/parts.js';

export async function mount(ctx) {
  const { app, toast, applyI18n, store } = ctx;
  const root = document.getElementById('view-parents');
  root.replaceChildren();

  if (!sessionStorage.getItem('pk-parents')) {
    const gate = await openGate();
    if (!gate) {
      app.go('draw');
      return;
    }
    sessionStorage.setItem('pk-parents', '1');
    root.replaceChildren();
  } else {
    root.replaceChildren();
  }

  const head = document.createElement('h2');
  head.textContent = app.t('parents.title');
  root.appendChild(head);

  /* idioma + sonido + tiempo */
  const p1 = document.createElement('div');
  p1.className = 'panel';
  const langRow = document.createElement('div');
  langRow.className = 'row';
  const langLbl = document.createElement('span');
  langLbl.textContent = app.t('parents.language');
  const langSel = document.createElement('select');
  langSel.innerHTML = '<option value="es">Español</option><option value="en">English</option>';
  langSel.value = app.lang;
  langSel.addEventListener('change', async () => {
    app.lang = langSel.value;
    await store.setSetting('lang', app.lang);
    location.reload();
  });
  langRow.append(langLbl, langSel);

  const soundRow = document.createElement('div');
  soundRow.className = 'row';
  const soundLbl = document.createElement('span');
  soundLbl.textContent = app.t('parents.sound');
  const soundSel = document.createElement('select');
  soundSel.innerHTML = '<option value="on">Sí</option><option value="off">No</option>';
  soundSel.value = app.settings.sound ?? 'on';
  soundSel.addEventListener('change', async () => {
    app.settings.sound = soundSel.value;
    await store.setSetting('sound', soundSel.value);
  });
  soundRow.append(soundLbl, soundSel);

  const timeRow = document.createElement('div');
  timeRow.className = 'row';
  const timeLbl = document.createElement('span');
  timeLbl.textContent = app.t('parents.timeLimit');
  const timeSel = document.createElement('select');
  timeSel.innerHTML = '<option value="0">Sin límite</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 h</option>';
  timeSel.value = String(app.settings.timeLimit ?? 0);
  timeSel.addEventListener('change', async () => {
    app.settings.timeLimit = Number(timeSel.value);
    app.settings.timeUsedMs = 0;
    await store.setSetting('timeLimit', app.settings.timeLimit);
    await store.setSetting('timeUsedMs', 0);
    const { armTimeLimit } = await import('../app.js');
    armTimeLimit();
  });
  timeRow.append(timeLbl, timeSel);

  p1.append(langRow, soundRow, timeRow);
  root.appendChild(p1);

  /* respaldo */
  const p2 = document.createElement('div');
  p2.className = 'panel';
  const bLbl = document.createElement('b');
  bLbl.textContent = app.t('parents.backup');
  const exportBtn = btn('⬇️', async () => {
    const json = await store.exportBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'pintakids-respaldo.json';
    a.click();
  });
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json';
  importInput.hidden = true;
  const importBtn = btn('⬆️', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const f = importInput.files?.[0];
    if (!f) return;
    const result = await store.importBackup(await f.text());
    toast(result.ok ? '✓ ' + result.imported : '⚠️ ' + result.error);
    if (result.ok) location.reload();
  });
  p2.append(bLbl, toolbar(exportBtn, importBtn, importInput));
  root.appendChild(p2);

  /* créditos y licencias (regla del dueño: todo gratis sin condiciones) */
  const p3 = document.createElement('div');
  p3.className = 'panel';
  const cLbl = document.createElement('b');
  cLbl.textContent = app.t('parents.credits');
  const body = document.createElement('div');
  body.className = 'note';
  body.textContent = app.t('parents.creditsBody');
  p3.append(cLbl, body);
  root.appendChild(p3);

  /* datos */
  const p4 = document.createElement('div');
  p4.className = 'panel';
  const dLbl = document.createElement('b');
  dLbl.textContent = app.t('parents.data');
  const wipe = btn('🗑️ ' + app.t('parents.wipe'), async () => {
    if (!confirm(app.t('parents.wipeConfirm'))) return;
    await store.wipe();
    sessionStorage.removeItem('pk-parents');
    location.reload();
  }, 'toolbtn warn');
  p4.append(dLbl, toolbar(wipe));
  root.appendChild(p4);

  applyI18n(root);
}

function openGate() {
  return new Promise((resolve) => {
    const root = document.getElementById('view-parents');
    root.replaceChildren();
    const a = 3 + Math.floor(Math.random() * 8);
    const b = 3 + Math.floor(Math.random() * 8);
    const panel = document.createElement('div');
    panel.className = 'panel';
    const q = document.createElement('div');
    q.className = 'gate-q';
    q.textContent = `${a} × ${b} = ?`;
    const input = document.createElement('input');
    input.className = 'gate-input';
    input.type = 'number';
    input.inputMode = 'numeric';
    const hint = document.createElement('div');
    hint.className = 'note';
    hint.textContent = 'Zona de padres';
    const go = btn('→', () => {
      if (Number(input.value) === a * b) {
        resolve(true);
      } else {
        hint.textContent = '✗';
        input.value = '';
      }
    }, 'toolbtn big');
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go.click());
    panel.append(hint, q, input, go);
    root.appendChild(panel);
  });
}
