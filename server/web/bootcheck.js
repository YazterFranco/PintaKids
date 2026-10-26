/* Auto-diagnóstico de arranque.
   Si la app no inicia (JS bloqueado, versión vieja en caché, SW atascado),
   muestra un aviso con un botón "Reparar" que limpia SW + caché y recarga. */
(function () {
  var BUILD = 'v9';
  document.documentElement.dataset.build = BUILD;
  window.__pkBuild = BUILD;

  var shown = false;
  var pendingMsg = null;

  function show(msg) {
    if (!document.body) {
      pendingMsg = msg;
      return;
    }
    if (shown) return;
    shown = true;

    var box = document.createElement('div');
    box.id = 'pk-repair';
    box.setAttribute('role', 'alert');
    box.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:100px', 'transform:translateX(-50%)',
      'z-index:2147483647', 'width:min(92vw,420px)',
      'background:#fff7fb', 'color:#2b2d42', 'border:3px solid #ff8fab',
      'border-radius:20px', 'padding:16px 18px',
      'font:600 15px/1.35 system-ui,-apple-system,sans-serif',
      'box-shadow:0 10px 30px rgba(0,0,0,.25)', 'text-align:center'
    ].join(';');

    var title = document.createElement('div');
    title.textContent = 'La app no arrancó bien';
    title.style.cssText = 'font-size:17px;font-weight:800;margin-bottom:6px';

    var detail = document.createElement('div');
    detail.textContent = String(msg || 'No se pudo iniciar.');
    detail.style.cssText = 'font-weight:500;font-size:13px;color:#5a5f7a;margin-bottom:12px;word-break:break-word';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Reparar y recargar';
    btn.style.cssText = 'font:800 15px/1 system-ui,-apple-system,sans-serif;background:#ff8fab;color:#fff;border:0;border-radius:999px;padding:12px 20px;cursor:pointer';
    btn.addEventListener('click', repair);

    box.append(title, detail, btn);
    document.body.appendChild(box);
  }

  window.__pkShowRepair = show;

  async function repair() {
    try {
      if ('serviceWorker' in navigator) {
        var regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(function (r) { return r.unregister(); }));
      }
    } catch (e) {}
    try {
      if (window.caches && caches.keys) {
        var keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }
    } catch (e) {}
    location.replace(location.pathname + '?fresh=' + Date.now());
  }

  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) {
      show('No se pudo cargar ' + String(t.src || t.href || '').split('/').pop());
      return;
    }
    // Aviso inofensivo del navegador (no es un fallo de la app): nunca mostrar "Reparar" por él.
    if (e && e.message && /ResizeObserver loop/i.test(e.message)) return;
    if (e && e.message) show(e.message);
  }, true);

  function arm() {
    if (pendingMsg) show(pendingMsg);
    var tries = 0;
    var iv = setInterval(function () {
      if (window.__pkReady === true) {
        clearInterval(iv);
        var old = document.getElementById('pk-repair');
        if (old) old.remove();
        return;
      }
      tries += 1;
      if (tries === 18) show('La app tardó demasiado en iniciar.');
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
  else arm();
})();
