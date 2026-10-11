// Página pública: mapa en vivo, lista con paginación y búsqueda, gráficos, guía, emergencias, radio, clima, estado de fuentes y avisos en este teléfono.
(() => {
  const $ = (id) => document.getElementById(id);
  const FMT = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const DIA_SEM = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', weekday: 'short', day: 'numeric', month: 'short' });
  const DIA_CLAVE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' });
  const DIA_CORTO = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', weekday: 'short' });
  const HORA = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', hour: '2-digit', minute: '2-digit' });
  const DIA = 86_400_000;
  const HORA_MS = 3_600_000;
  const NOMBRES = { igc: 'IGC-UP', usgs: 'USGS', emsc: 'EMSC' };
  const COLOR = { alto: '#b42318', medio: '#b54708', bajo: '#1b7f4b' };
  const REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEAFLET_CSS = [
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  ];
  const LEAFLET_JS = [
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  ];
  const quakes = new Map();
  const soportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  const PAG = 20;
  let pagina = 0;
  let busq = null;
  let flashId = null;

  const clase = (mag) => (mag >= 6 ? 'alto' : mag >= 4.5 ? 'medio' : 'bajo');
  const fecha = (t) => `${FMT.format(new Date(t))} hora de Panamá`;

  function hace(t) {
    const min = Math.round((Date.now() - t) / 60_000);
    if (min < 1) return 'hace menos de 1 min';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
  }

  const prefs = {
    get(k, d) {
      try { return localStorage.getItem(k) ?? d; } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ }
    },
  };
  let minMag = Number(prefs.get('minMag', '0'));
  let ventanaH = Number(prefs.get('ventanaH', '24'));

  async function getJson(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function setStatus(text, kind) {
    const s = $('status');
    s.textContent = text;
    s.dataset.kind = kind;
  }

  function setEstadoMapa(text, kind = 'ok') {
    const e = $('mapa-estado');
    e.textContent = text;
    e.dataset.kind = kind;
  }

  // ---------- Tema claro / oscuro ----------
  function temaEfectivo() {
    const f = document.documentElement.dataset.theme;
    if (f) return f;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  $('btn-tema').addEventListener('click', () => {
    const nuevo = temaEfectivo() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nuevo;
    prefs.set('tema', nuevo);
  });

  // ---------- Revelado suave de tarjetas (nunca deja contenido oculto) ----------
  if ('IntersectionObserver' in window && !REDUCIDO) {
    const tarjetas = [...document.querySelectorAll('main .card')];
    const mostrar = (el) => {
      el.classList.add('visible');
      if (mapa) setTimeout(() => mapa.invalidateSize(), 200);
    };
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        mostrar(e.target);
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -20px 0px' });
    tarjetas.forEach((c) => { c.classList.add('reveal'); io.observe(c); });
    // Red de seguridad: si el observador no dispara (impresión, navegadores raros, pestaña de fondo),
    // a los 2,5 s se muestran todas las tarjetas para que nunca quede contenido invisible.
    setTimeout(() => tarjetas.forEach((c) => c.classList.add('visible')), 2500);
  }

  // ---------- Fuentes ----------
  function pintarFuentes(sources) {
    const cont = $('fuentes');
    cont.replaceChildren();
    for (const [k, h] of Object.entries(sources || {})) {
      const chip = document.createElement('span');
      chip.className = `chip ${h.ok ? 'ok' : 'err'}`;
      const cuando = h.ok ? (h.lastOkAt ? hace(h.lastOkAt) : 'ok') : 'sin respuesta';
      chip.textContent = `${NOMBRES[k] ?? k}: ${cuando}`;
      cont.append(chip);
    }
  }

  // ---------- Carga de Leaflet: cdnjs primero, unpkg de respaldo, con tiempo límite ----------
  function cargarScript(url) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => ok();
      s.onerror = () => fail(new Error(url));
      document.head.append(s);
    });
  }

  function cargarCss(url) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url;
    document.head.append(l);
  }

  const conTiempo = (p, ms) => Promise.race([p, new Promise((_, fail) => setTimeout(() => fail(new Error('tiempo')), ms))]);

  async function cargarLeaflet() {
    if (window.L) return true;
    for (let i = 0; i < LEAFLET_JS.length; i++) {
      cargarCss(LEAFLET_CSS[i]);
      try {
        await conTiempo(cargarScript(LEAFLET_JS[i]), 8000);
        if (window.L) return true;
      } catch {
        // Probar el siguiente CDN.
      }
    }
    return false;
  }

  // ---------- Mapa ----------
  let mapa = null;
  let capa = null;
  const marcadores = new Map();
  let ultimoId = null;

  async function iniciarMapa() {
    setEstadoMapa('Cargando mapa…', 'warn');
    const ok = await cargarLeaflet();
    if (!ok) {
      $('mapa').hidden = true;
      setEstadoMapa('No se pudo cargar el mapa. Revise la conexión a internet. La lista de abajo sigue funcionando.', 'err');
      return;
    }
    mapa = L.map('mapa', { scrollWheelZoom: false, tap: true }).setView([8.6, -80.2], 7);
    // Tiles de OpenStreetMap estándar: gratuitos, sin API key ni registro.
    const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa);
    let fallos = 0;
    base.on('tileerror', () => {
      fallos++;
      if (fallos === 4) setEstadoMapa('El mapa de fondo no responde. Los sismos siguen visibles.', 'warn');
    });
    capa = L.layerGroup().addTo(mapa);
    setTimeout(() => mapa.invalidateSize(), 0);
    pintarMapa(visibles(), true);
  }

  function detalle(q) {
    const d = document.createElement('div');
    d.className = 'pop';
    const t = document.createElement('strong');
    t.textContent = `M${q.magnitude.toFixed(1)} · ${q.region}`;
    const s = document.createElement('small');
    s.className = 'muted';
    s.textContent = `${fecha(q.originTime)} · profundidad ${q.depthKm ?? '—'} km · ${q.status === 'revisado' ? 'revisado' : 'preliminar'} · ${NOMBRES[q.source] ?? q.source}`;
    d.append(t, document.createElement('br'), s);
    return d;
  }

  // Redibuja los círculos. Si un detalle estaba abierto, lo vuelve a abrir.
  // "ajustar": ajusta la vista para que se vean todos los sismos mostrados (solo al cambiar filtros).
  function pintarMapa(lista, ajustar) {
    if (!mapa) return;
    const abierto = [...marcadores].find(([, m]) => m.isPopupOpen())?.[0];
    capa.clearLayers();
    marcadores.clear();
    const puntos = [];
    for (const q of lista) {
      if (typeof q.lat !== 'number' || typeof q.lon !== 'number') continue;
      const c = COLOR[clase(q.magnitude)];
      const reciente = Date.now() - q.originTime < HORA_MS;
      const m = L.circleMarker([q.lat, q.lon], {
        radius: Math.min(4 + q.magnitude * 2.2, 22),
        color: c,
        fillColor: c,
        fillOpacity: reciente ? 0.8 : 0.45,
        weight: reciente ? 3 : 1.5,
      });
      m.bindPopup(detalle(q));
      m.addTo(capa);
      marcadores.set(q.id, m);
      puntos.push([q.lat, q.lon]);
    }
    if (ajustar && puntos.length) {
      mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 9 });
    }
    if (abierto && marcadores.has(abierto)) marcadores.get(abierto).openPopup();
    const n = marcadores.size;
    setEstadoMapa(n ? `Mostrando ${n} sismo${n === 1 ? '' : 's'} en el mapa. Se actualiza en vivo.` : 'No hay sismos para mostrar con este filtro.', n ? 'ok' : 'warn');
  }

  function enfocar(id) {
    if (!mapa || !id) return;
    const q = quakes.get(id);
    const m = marcadores.get(id);
    if (m) {
      mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 8));
      m.openPopup();
    } else if (q && typeof q.lat === 'number') {
      mapa.setView([q.lat, q.lon], 8);
    } else {
      return;
    }
    $('card-mapa').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Vistas rápidas del mapa
  document.querySelectorAll('.vistitas .chip-b').forEach((b) => {
    b.addEventListener('click', () => {
      if (!mapa) return;
      mapa.setView([Number(b.dataset.lat), Number(b.dataset.lon)], Number(b.dataset.zoom));
    });
  });

  // ---------- Lista, resumen, último sismo ----------
  function ventanaActiva() {
    if (busq) return busq;
    return { desde: Date.now() - ventanaH * HORA_MS, hasta: Infinity };
  }

  function visibles() {
    const { desde, hasta } = ventanaActiva();
    return [...quakes.values()]
      .filter((q) => q.magnitude >= minMag && q.originTime >= desde && q.originTime <= hasta)
      .sort((a, b) => b.originTime - a.originTime);
  }

  let stNPrev = 0;
  function setStN(v) {
    const el = $('st-n');
    if (REDUCIDO || v === stNPrev || el.textContent !== String(stNPrev)) {
      el.textContent = String(v);
      stNPrev = v;
      return;
    }
    const inicio = stNPrev;
    stNPrev = v;
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / 350);
      el.textContent = String(Math.round(inicio + (v - inicio) * p));
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  function resumen() {
    const ahora = Date.now();
    const todos = [...quakes.values()];
    const dia = todos.filter((q) => ahora - q.originTime <= DIA);
    setStN(dia.length);
    $('st-max').textContent = dia.length ? `M${Math.max(...dia.map((q) => q.magnitude)).toFixed(1)}` : '—';
    const ult = [...todos].sort((a, b) => b.originTime - a.originTime)[0];
    $('st-ultimo').textContent = ult ? hace(ult.originTime) : '—';
  }

  function renderUltimo(u) {
    ultimoId = u ? u.id : null;
    $('ultimo-vacio').hidden = Boolean(u);
    $('ultimo-datos').hidden = !u;
    if (!u) return;
    const mag = $('ult-mag');
    mag.textContent = `M${u.magnitude.toFixed(1)}`;
    mag.className = `mag ${clase(u.magnitude)}`;
    $('ult-region').textContent = u.region;
    $('ult-cuando').textContent = `${fecha(u.originTime)} · ${hace(u.originTime)}`;
    $('ult-det').textContent =
      `Profundidad ${u.depthKm ?? '—'} km · ${u.status === 'revisado' ? 'Dato revisado' : 'Dato preliminar, puede cambiar'}`;
    $('sentido').hidden = false;
    cargarSentido(u.id);
  }

  // ---------- ¿Lo sintió? (reportes ciudadanos, agregados por celda de ~5 km) ----------
  let sentidoReportado = false;

  async function cargarSentido(id) {
    const tot = $('sentido-total');
    if (!id) { $('sentido').hidden = true; return; }
    sentidoReportado = false;
    document.querySelectorAll('#sentido .chip-b').forEach((b) => { b.disabled = false; });
    try {
      const f = await getJson(`/v1/feels?event=${encodeURIComponent(id)}`);
      tot.textContent = f.total ? `${f.total} persona${f.total === 1 ? '' : 's'} lo sintió` : 'Sea el primero en reportar';
    } catch { tot.textContent = ''; }
  }

  async function reportarSentido(intensity) {
    if (!ultimoId || sentidoReportado) return;
    const u = ubicacionGuardada() ?? PRED;
    let r;
    try {
      r = await fetch('/v1/feels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId: ultimoId, location: { lat: u.lat, lon: u.lon }, intensity }),
      });
    } catch {
      $('sentido-total').textContent = 'Sin conexión para registrar su reporte.';
      return;
    }
    if (!r.ok) {
      $('sentido-total').textContent = 'No se pudo registrar. Intente de nuevo.';
      return;
    }
    const d = await r.json();
    sentidoReportado = true;
    document.querySelectorAll('#sentido .chip-b').forEach((b) => { b.disabled = true; });
    $('sentido-total').textContent = `Gracias. Ya son ${d.total} persona${d.total === 1 ? '' : 's'} que lo sintieron`;
  }

  document.querySelectorAll('#sentido .chip-b').forEach((b) => {
    b.addEventListener('click', () => { reportarSentido(Number(b.dataset.int)); });
  });

  function renderPaginacion(total) {
    const totalPag = Math.max(1, Math.ceil(total / PAG));
    $('pag-info').textContent = `Página ${pagina + 1} de ${totalPag} · ${total} sismo${total === 1 ? '' : 's'}`;
    $('btn-prev').disabled = pagina <= 0;
    $('btn-next').disabled = pagina >= totalPag - 1;
  }

  function render(ajustar = false) {
    const todos = [...quakes.values()].sort((a, b) => b.originTime - a.originTime);
    renderUltimo(todos[0]);
    resumen();
    pintarGraficos();

    const filtrados = visibles();
    const totalPag = Math.max(1, Math.ceil(filtrados.length / PAG));
    if (pagina > totalPag - 1) pagina = totalPag - 1;
    if (pagina < 0) pagina = 0;
    const corte = filtrados.slice(pagina * PAG, pagina * PAG + PAG);

    const ul = $('lista');
    ul.replaceChildren();
    for (const q of corte) {
      const li = document.createElement('li');
      li.className = `item a-${clase(q.magnitude)}`;
      if (flashId === q.id) li.classList.add('flash');
      li.tabIndex = 0;
      li.title = 'Ver en el mapa';
      const m = document.createElement('span');
      m.className = `mag ${clase(q.magnitude)}`;
      m.textContent = `M${q.magnitude.toFixed(1)}`;
      const body = document.createElement('div');
      const r = document.createElement('strong');
      r.textContent = q.region;
      const w = document.createElement('small');
      w.className = 'muted';
      const cuando = document.createElement('span');
      cuando.textContent = fecha(q.originTime);
      const ahora = document.createElement('span');
      ahora.className = 'hace';
      ahora.dataset.t = String(q.originTime);
      ahora.textContent = hace(q.originTime);
      const estado = document.createElement('span');
      estado.textContent = q.status === 'revisado' ? 'revisado' : 'preliminar';
      w.append(cuando, ' · ', ahora, ' · ', estado);
      body.append(r, w);
      li.append(m, body);
      li.addEventListener('click', () => enfocar(q.id));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') enfocar(q.id); });
      ul.append(li);
    }
    flashId = null;
    const vacia = $('lista-vacia');
    vacia.hidden = corte.length > 0;
    vacia.textContent = filtrados.length
      ? 'Ningún sismo cumple el filtro elegido (magnitud y tiempo).'
      : 'Todavía no hay sismos registrados.';
    renderPaginacion(filtrados.length);
    pintarMapa(filtrados, ajustar);
  }

  $('btn-prev').addEventListener('click', () => { pagina--; render(false); $('card-lista').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('btn-next').addEventListener('click', () => { pagina++; render(false); $('card-lista').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  // Actualiza solo los textos "hace X" sin redibujar el mapa (así no se cierran los detalles abiertos).
  function actualizarTiempos() {
    document.querySelectorAll('.hace').forEach((el) => {
      el.textContent = hace(Number(el.dataset.t));
    });
    resumen();
    const u = ultimoId ? quakes.get(ultimoId) : null;
    if (u) $('ult-cuando').textContent = `${fecha(u.originTime)} · ${hace(u.originTime)}`;
  }

  // ---------- Gráficos ----------
  let primeraPintada = true;
  function pintarGraficos() {
    const contDias = $('grafico-dias');
    const contMag = $('grafico-mag');
    if (!contDias || !contMag) return;
    const todos = [...quakes.values()];

    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * DIA);
      dias.push({ clave: DIA_CLAVE.format(d), etiqueta: DIA_CORTO.format(d).replace('.', ''), c: 0, m: 0 });
    }
    const porClave = new Map(dias.map((x) => [x.clave, x]));
    for (const q of todos) {
      const b = porClave.get(DIA_CLAVE.format(new Date(q.originTime)));
      if (b) { b.c++; b.m = Math.max(b.m, q.magnitude); }
    }
    const maxC = Math.max(1, ...dias.map((d) => d.c));
    const paso = 46, x0 = 8, H = 140, base = H - 24, maxH = 86;
    const W = x0 * 2 + dias.length * paso;
    let barras = '', textos = '';
    dias.forEach((d, i) => {
      const alto = d.c ? Math.max(6, Math.round((d.c / maxC) * maxH)) : 3;
      const x = x0 + i * paso;
      const y = base - alto;
      const col = d.c ? COLOR[clase(d.m)] : 'var(--line)';
      const anim = primeraPintada && !REDUCIDO ? ' class="b-anim"' : '';
      barras += `<rect${anim} x="${x}" y="${y}" width="32" height="${alto}" rx="6" fill="${col}"><title>${d.etiqueta}: ${d.c} sismo(s)${d.c ? `, mayor M${d.m.toFixed(1)}` : ''}</title></rect>`;
      if (d.c) textos += `<text x="${x + 16}" y="${y - 5}" text-anchor="middle" class="gv">${d.c}</text>`;
      textos += `<text x="${x + 16}" y="${base + 16}" text-anchor="middle">${d.etiqueta}</text>`;
    });
    contDias.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" class="svg-g" role="img" aria-label="Sismos por día en los últimos 7 días">`
      + `<line x1="0" y1="${base}" x2="${W}" y2="${base}" class="eje"/>${barras}${textos}</svg>`;

    const bins = [
      { t: 'M 2.5–3.9', lo: 2.5, hi: 4, color: COLOR.bajo },
      { t: 'M 4–4.9', lo: 4, hi: 5, color: '#f79009' },
      { t: 'M 5–5.9', lo: 5, hi: 6, color: COLOR.medio },
      { t: 'M 6 o más', lo: 6, hi: 99, color: COLOR.alto },
    ];
    for (const q of todos) {
      const b = bins.find((x) => q.magnitude >= x.lo && q.magnitude < x.hi);
      if (b) b.c = (b.c || 0) + 1;
    }
    bins.forEach((b) => { b.c ??= 0; });
    const maxB = Math.max(1, ...bins.map((b) => b.c));
    contMag.innerHTML = bins.map((b) => {
      const w = Math.max(4, Math.round((b.c / maxB) * 100));
      const anim = primeraPintada && !REDUCIDO ? ' anim' : '';
      return `<div class="hm-row"><span class="hm-t">${b.t}</span><span class="hm-bar${anim}" style="width:${w}%;background:${b.color}"></span><span class="hm-c">${b.c}</span></div>`;
    }).join('');
    primeraPintada = false;
  }

  // ---------- Búsqueda por fecha y hora ----------
  function aplicarBusqueda() {
    const f = $('f-fecha').value;
    const info = $('busqueda-info');
    if (!f) {
      busq = null;
      info.hidden = false;
      info.textContent = 'Elija una fecha (y opcionalmente un rango de horas) para filtrar la lista y el mapa. Horario de Panamá.';
      return;
    }
    const t1 = $('f-desde').value || '00:00';
    const t2 = $('f-hasta').value || '23:59';
    const desde = Date.parse(`${f}T${t1}:00-05:00`);
    const hasta = Date.parse(`${f}T${t2}:59-05:00`);
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta < desde) {
      info.hidden = false;
      info.textContent = 'Rango inválido: la hora final debe ser posterior a la inicial.';
      return;
    }
    busq = { desde, hasta };
    info.hidden = false;
    info.textContent = `Mostrando del ${f} ${t1} a las ${t2} (hora de Panamá). Toque «Limpiar» para volver a la vista por ventanas de tiempo.`;
    pagina = 0;
    render(true);
  }

  function limpiarBusqueda() {
    $('f-fecha').value = '';
    $('f-desde').value = '';
    $('f-hasta').value = '';
    busq = null;
    $('busqueda-info').hidden = true;
    pagina = 0;
    render(true);
  }

  $('btn-buscar').addEventListener('click', aplicarBusqueda);
  $('btn-limpiar').addEventListener('click', limpiarBusqueda);

  // ---------- Guía, emergencias, radios y enlaces (desde /v1/guide) ----------
  const ICONOS_GUIA = {
    before: `${SVG}<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 22V12h6v10"/></svg>`,
    during: `${SVG}<path d="M22 12h-4l-3 9L9 3 5 12H2"/></svg>`,
    after: `${SVG}<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
    power: `${SVG}<path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>`,
    kit: `${SVG}<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    tsunami: `${SVG}<path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>`,
    aftershocks: `${SVG}<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`,
  };

  function renderGuia(g) {
    const cont = $('guia');
    cont.replaceChildren();
    for (const s of g.sections || []) {
      const det = document.createElement('details');
      if (s.phase === 'during') det.open = true;
      const sum = document.createElement('summary');
      const ic = document.createElement('span');
      ic.className = 'g-ic';
      ic.innerHTML = ICONOS_GUIA[s.phase] ?? `${SVG}<circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>`;
      const tt = document.createElement('span');
      tt.textContent = s.title;
      sum.append(ic, tt);
      const ul = document.createElement('ul');
      for (const it of s.items) {
        const li = document.createElement('li');
        li.textContent = it.text;
        ul.append(li);
      }
      det.append(sum, ul);
      cont.append(det);
    }
    if (g.disclaimer) {
      const p = document.createElement('p');
      p.className = 'muted guia-nota';
      p.textContent = g.disclaimer;
      cont.append(p);
    }
    renderEmergencias(g);
    renderRadios(g);
    renderEnlaces(g);
  }

  function telHref(fijo) {
    if (fijo.includes('*')) return `tel:${encodeURIComponent(fijo)}`;
    const dig = fijo.replace(/\D/g, '');
    return dig.length <= 3 ? `tel:${dig}` : `tel:+507${dig}`;
  }

  function renderEmergencias(g) {
    const cont = $('emergencias');
    if (!cont || !Array.isArray(g.emergencyNumbers)) return;
    cont.replaceChildren();
    for (const e of g.emergencyNumbers) {
      const esWhats = /whatsapp/i.test(e.name);
      const a = document.createElement('a');
      a.className = `tel${e.highlight ? ' principal' : ''}`;
      const dig = e.phone.replace(/\D/g, '');
      a.href = esWhats ? `https://wa.me/507${dig}` : telHref(e.phone);
      if (esWhats) a.target = '_blank';
      a.rel = 'noopener';
      const n1 = document.createElement('span');
      n1.className = 'tel-nombre';
      n1.textContent = e.name;
      const n2 = document.createElement('span');
      n2.className = 'tel-num';
      n2.textContent = e.phone;
      a.append(n1, n2);
      if (e.note) {
        const n3 = document.createElement('span');
        n3.className = 'tel-nota';
        n3.textContent = e.note;
        a.append(n3);
      }
      if (e.alt) {
        const n4 = document.createElement('span');
        n4.className = 'tel-alt';
        n4.textContent = `También: ${e.alt}`;
        a.append(n4);
      }
      cont.append(a);
    }
  }

  function renderRadios(g) {
    const ul = $('radios');
    if (!ul || !Array.isArray(g.radios)) return;
    ul.replaceChildren();
    for (const r of g.radios) {
      const li = document.createElement('li');
      const f = document.createElement('span');
      f.className = 'r-freq';
      f.textContent = r.freq;
      const nom = document.createElement('span');
      nom.className = 'r-nombre';
      nom.textContent = r.name;
      li.append(f, nom);
      if (r.note) {
        const nt = document.createElement('span');
        nt.className = 'r-nota';
        nt.textContent = r.note;
        li.append(nt);
      }
      if (r.url) {
        const a = document.createElement('a');
        a.href = r.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Escuchar online';
        li.append(a);
      }
      ul.append(li);
    }
  }

  function renderEnlaces(g) {
    const cont = $('enlaces');
    if (!cont || !Array.isArray(g.links)) return;
    cont.replaceChildren();
    for (const l of g.links) {
      const a = document.createElement('a');
      a.className = 'enlace';
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      const s1 = document.createElement('strong');
      s1.textContent = l.name;
      const s2 = document.createElement('small');
      s2.textContent = l.note ?? l.url;
      a.append(s1, s2);
      cont.append(a);
    }
  }

  // ---------- Clima (Open-Meteo, solo en el navegador) ----------
  const CLIMA_URL = 'https://api.open-meteo.com/v1/forecast';
  const VIENTO_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const PRED = { lat: 8.9823, lon: -79.5197, nombre: 'Ciudad de Panamá (predeterminado)' };
  let climaTimer = null;

  function ubicacionGuardada() {
    try {
      const raw = prefs.get('ubic', null);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (Number.isFinite(o?.lat) && Number.isFinite(o?.lon)) return o;
    } catch { /* ignora valores corruptos */ }
    return null;
  }

  const IC_NUBE_CURVA = 'M17.5 14a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A4 4 0 0 0 7 14z';
  const CLIMA_ICONOS = {
    sol: `${SVG}<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
    solnube: `${SVG}<circle cx="8" cy="7.5" r="3"/><path d="M8 2.5v1m-4.5 4h1M4 3.9l.8.8M11.2 3.9l-.8.8"/><path d="M17.5 19a4.5 4.5 0 0 0 .4-9 6 6 0 0 0-11 1.3A4 4 0 0 0 7.5 19z"/></svg>`,
    nube: `${SVG}<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A4 4 0 0 0 7 19z"/></svg>`,
    lluvia: `${SVG}<path d="${IC_NUBE_CURVA}"/><path d="M8 18v2m4-3v3m4-2v2"/></svg>`,
    tormenta: `${SVG}<path d="${IC_NUBE_CURVA}"/><path d="m12.5 14-3 4h4l-2.5 4"/></svg>`,
    nieve: `${SVG}<path d="${IC_NUBE_CURVA}"/><path d="M8 18h.01M12 19h.01M16 18h.01M10 21h.01M14 21h.01"/></svg>`,
    niebla: `${SVG}<path d="M17.5 12a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.6A4 4 0 0 0 7 12z"/><path d="M5 16h14M7 20h10"/></svg>`,
  };

  function wmo(cod) {
    if (cod === 0) return ['Cielo despejado', 'sol'];
    if (cod === 1) return ['Mayormente despejado', 'solnube'];
    if (cod === 2) return ['Parcialmente nublado', 'solnube'];
    if (cod === 3) return ['Nublado', 'nube'];
    if (cod === 45 || cod === 48) return ['Niebla', 'niebla'];
    if (cod >= 51 && cod <= 57) return ['Llovizna', 'lluvia'];
    if (cod >= 61 && cod <= 67) return ['Lluvia', 'lluvia'];
    if (cod >= 71 && cod <= 77) return ['Nieve', 'nieve'];
    if (cod >= 80 && cod <= 82) return ['Chubascos', 'lluvia'];
    if (cod === 85 || cod === 86) return ['Chubascos de nieve', 'nieve'];
    if (cod >= 95) return ['Tormenta eléctrica', 'tormenta'];
    return ['Sin datos', 'nube'];
  }

  function setEstadoClima(texto, fuerte = false) {
    const e = $('clima-estado');
    e.textContent = texto;
    e.style.fontWeight = fuerte ? '600' : '';
  }

  async function cargarClima() {
    const u = ubicacionGuardada() ?? PRED;
    $('clima-lugar').textContent = u.nombre;
    setEstadoClima('Cargando clima…');
    const url = `${CLIMA_URL}?latitude=${u.lat.toFixed(4)}&longitude=${u.lon.toFixed(4)}`
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FPanama&forecast_days=4';
    let d;
    try {
      d = await getJson(url);
    } catch {
      setEstadoClima('No se pudo cargar el clima (¿sin internet?). Reintentelo más tarde.');
      return;
    }
    const cur = d.current ?? {};
    const [desc, icono] = wmo(cur.weather_code ?? 3);
    $('clima-hoy').hidden = false;
    $('clima-icon').innerHTML = CLIMA_ICONOS[icono];
    $('clima-t').textContent = `${Math.round(cur.temperature_2m ?? 0)}°`;
    $('clima-app').textContent = cur.apparent_temperature != null ? `Sensación ${Math.round(cur.apparent_temperature)}°` : '';
    $('clima-desc').textContent = desc;
    const viento = VIENTO_16[Math.round((cur.wind_direction_10m ?? 0) / 22.5) % 16];
    $('clima-viento').textContent =
      `Viento ${Math.round(cur.wind_speed_10m ?? 0)} km/h desde el ${viento} · Lluvia ahora ${cur.precipitation ?? 0} mm/h`;

    const dias = $('clima-dias');
    dias.replaceChildren();
    const lista = d.daily?.time ?? [];
    for (let i = 0; i < lista.length; i++) {
      const [dd, ii] = wmo(d.daily.weather_code?.[i] ?? 3);
      const li = document.createElement('li');
      const dia = document.createElement('span');
      dia.className = 'dia';
      dia.textContent = i === 0 ? 'Hoy' : DIA_SEM.format(new Date(`${lista[i]}T12:00:00-05:00`));
      const ic = document.createElement('span');
      ic.innerHTML = CLIMA_ICONOS[ii];
      const t = document.createElement('span');
      t.innerHTML = `<span class="tmax">${Math.round(d.daily.temperature_2m_max?.[i] ?? 0)}°</span> <span class="tmin">${Math.round(d.daily.temperature_2m_min?.[i] ?? 0)}°</span> · ${dd}`;
      const prob = document.createElement('span');
      prob.className = 'prob';
      prob.textContent = `${d.daily.precipitation_probability_max?.[i] ?? 0}% lluvia`;
      li.append(dia, ic, t, prob);
      dias.append(li);
    }

    const nota = $('clima-nota');
    const maxLluvia = Math.max(0, ...(d.daily?.precipitation_probability_max ?? [0]).slice(0, 3));
    const tormenta = lista.slice(0, 3).some((_, i) => (d.daily?.weather_code?.[i] ?? 0) >= 95);
    if (tormenta) nota.textContent = 'Tormentas en los próximos días: tras un sismo, tenga cuidado con deslizamientos en zonas con grietas o cortes de terreno.';
    else if (maxLluvia >= 60) nota.textContent = 'Lluvia intensa probable: vigile vías anegadas y pendientes inestables, sobre todo si hubo sismos recientes.';
    else nota.textContent = `Actualizado ${HORA.format(new Date())} · Datos de Open-Meteo para ${u.nombre}.`;

    setEstadoClima('');
  }

  function pedirUbicacion() {
    if (!navigator.geolocation) return setEstadoClima('Este navegador no permite obtener la ubicación. Se muestra Ciudad de Panamá.');
    setEstadoClima('Buscando su ubicación…', true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(2));
        const lon = Number(pos.coords.longitude.toFixed(2));
        prefs.set('ubic', JSON.stringify({ lat, lon, nombre: 'Su ubicación (aprox.)' }));
        cargarClima();
      },
      () => setEstadoClima('No se pudo obtener la ubicación (permiso denegado). Se muestra Ciudad de Panamá.', true),
      { timeout: 12_000, maximumAge: 30 * 60_000 },
    );
  }

  $('btn-clima-ubic').addEventListener('click', pedirUbicacion);
  $('btn-clima-recargar').addEventListener('click', () => cargarClima());

  // ---------- Compartir y WhatsApp ----------
  function abrirWhats(texto) {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${location.origin}/`)}`, '_blank', 'noopener');
  }

  function mostrarNuevo(q) {
    const n = $('nuevo');
    n.textContent = `Nuevo sismo M${q.magnitude.toFixed(1)} · ${q.region}`;
    n.dataset.kind = 'alerta';
    n.hidden = false;
    clearTimeout(mostrarNuevo.t);
    mostrarNuevo.t = setTimeout(() => { n.hidden = true; }, 20_000);
  }

  async function cargar() {
    try {
      const d = await getJson('/v1/events?limit=200');
      for (const e of d.events) quakes.set(e.id, e);
    } catch {
      setStatus('No se pudo cargar la lista. Reintentando…', 'warn');
    }
    try {
      render(true);
    } catch (e) {
      console.error('render()', e && e.stack || e);
    }
    try {
      pintarFuentes((await getJson('/v1/health')).sources);
    } catch { /* el estado de fuentes llega también por el canal en vivo */ }
    try {
      renderGuia(await getJson('/v1/guide'));
    } catch { /* la guía es secundaria */ }
  }

  function conectarEnVivo() {
    const es = new EventSource('/v1/live');
    es.onopen = () => setStatus('En vivo', 'ok');
    es.addEventListener('quake', (ev) => {
      const q = JSON.parse(ev.data);
      quakes.set(q.id, q);
      flashId = q.id;
      pagina = 0;
      render(false);
      mostrarNuevo(q);
      const hero = $('hero-sismo');
      if (!REDUCIDO) {
        hero.classList.add('pop-new');
        setTimeout(() => hero.classList.remove('pop-new'), 800);
      }
    });
    es.addEventListener('health', (ev) => {
      const h = JSON.parse(ev.data);
      setStatus(h.ok ? 'En vivo' : 'Fuentes sin respuesta: los datos pueden estar atrasados', h.ok ? 'ok' : 'warn');
      pintarFuentes(h.sources);
    });
    es.onerror = () => setStatus('Sin conexión en vivo. Reintentando…', 'warn');
  }

  // ---------- Filtros ----------
  function iniciarFiltros() {
    const mag = $('filtro-mag');
    mag.value = String(minMag);
    if (mag.value !== String(minMag)) { minMag = 0; mag.value = '0'; }
    mag.addEventListener('change', () => {
      minMag = Number(mag.value);
      prefs.set('minMag', mag.value);
      pagina = 0;
      render(true);
    });

    const tiempo = $('filtro-tiempo');
    if (![1, 24, 168].includes(ventanaH)) ventanaH = 24;
    tiempo.value = String(ventanaH);
    tiempo.addEventListener('change', () => {
      ventanaH = Number(tiempo.value);
      prefs.set('ventanaH', tiempo.value);
      if (busq) limpiarBusqueda();
      pagina = 0;
      render(true);
    });
  }

  async function compartir() {
    const url = `${location.origin}/`;
    const datos = { title: 'Sismos en Panamá', text: 'Sismos en Panamá en vivo, con avisos al teléfono, guía y teléfonos de emergencia.', url };
    try {
      if (navigator.share) {
        await navigator.share(datos);
        return;
      }
      await navigator.clipboard.writeText(url);
      $('share-msg').textContent = 'Enlace copiado. Envíelo por WhatsApp o correo.';
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      $('share-msg').textContent = `Copie este enlace: ${url}`;
    }
  }

  // ---------- Avisos en este teléfono ----------
  const msg = (t) => { $('avisos-msg').textContent = t; };

  function b64ToBytes(s) {
    const pad = '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  // Sin avisos activos, la tarjeta va arriba para activarlos. Activos, baja al final para probar o desactivar.
  function colocarAvisos(arriba) {
    const sec = $('avisos');
    const main = sec.parentElement;
    if (arriba) main.insertBefore(sec, $('nuevo').nextSibling);
    else main.append(sec);
  }

  // Aviso temporal arriba de la página (por ejemplo, "avisos activados").
  function avisoGlobal(texto, kind = 'alerta') {
    const n = $('nuevo');
    n.textContent = texto;
    n.dataset.kind = kind;
    n.hidden = false;
    clearTimeout(mostrarNuevo.t);
    mostrarNuevo.t = setTimeout(() => { n.hidden = true; }, 6_000);
  }

  function marcarActivo() {
    $('avisos-titulo').textContent = 'Avisos activos en este teléfono';
    $('avisos-text').textContent = 'Recibirá una notificación por cada sismo importante. Puede probar el aviso o desactivarlo aquí.';
    $('btn-avisos').hidden = true;
    $('btn-prueba').hidden = false;
    $('btn-desactivar').hidden = false;
    colocarAvisos(false);
    msg('');
  }

  function marcarInactivo(texto) {
    $('avisos-titulo').textContent = 'Avisos en este teléfono';
    $('avisos-text').textContent = 'Reciba una notificación cada vez que haya un sismo importante, aunque tenga el navegador cerrado.';
    $('btn-avisos').textContent = 'Activar avisos';
    $('btn-avisos').hidden = false;
    $('btn-prueba').hidden = true;
    $('btn-desactivar').hidden = true;
    colocarAvisos(true);
    msg(texto || '');
  }

  async function desactivarAvisos() {
    const c = await kvGet('cred');
    if (c) {
      // Quita el dispositivo del servidor; si ya no existe, no pasa nada.
      await fetch(`/v1/devices/${c.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${c.secret}` } }).catch(() => null);
    }
    const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
    const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
    if (sub) await sub.unsubscribe().catch(() => null);
    await kvSet('cred', null);
    marcarInactivo('Avisos desactivados en este teléfono. Puede volver a activarlos cuando quiera.');
  }

  async function activarAvisos() {
    if (!soportado) {
      return msg('Este navegador no admite avisos. En iPhone: abra el enlace en Safari, toque Compartir y "Agregar a la pantalla de inicio", y abra la app desde ahí.');
    }
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (esIOS && !navigator.standalone) {
      return msg('En iPhone y iPad los avisos solo funcionan desde la pantalla de inicio: abra este enlace en Safari, toque Compartir y "Agregar a la pantalla de inicio", y ábralo desde ahí.');
    }
    if (/Firefox/.test(navigator.userAgent) && /Android/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches) {
      return msg('En Firefox de Android los avisos solo funcionan en la app instalada: abra el menú (⋮), toque "Instalar app" o "Añadir a pantalla de inicio", ábrala desde ahí y active los avisos. (En Chrome de Android funcionan sin instalar.)');
    }
    if (/Android/.test(navigator.userAgent) && /\bwv\b/.test(navigator.userAgent)) {
      return msg('Está entrando desde el navegador integrado de una app (WhatsApp, Instagram, correo). Toque el menú de tres puntos y elija "Abrir en Chrome"; desde ahí sí se pueden activar los avisos.');
    }
    let permiso;
    try {
      permiso = await Notification.requestPermission();
    } catch (e) {
      return msg(`El navegador bloqueó el permiso de notificaciones (${e?.name ?? 'error'}). Revíselo en la configuración del sitio.`);
    }
    if (permiso !== 'granted') {
      return msg('Sin permiso de notificaciones no podemos avisarle. Puede cambiarlo en la configuración del navegador.');
    }
    let reg;
    try {
      reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    } catch (e) {
      return msg(`El servicio de avisos no pudo iniciar (${e?.name ?? 'error'}). Recargue la página e intente de nuevo.`);
    }
    let publicKey;
    try {
      ({ publicKey } = await getJson('/v1/web/vapid-key'));
    } catch (e) {
      return msg(`El servidor no devolvió la llave de avisos (${e?.message ?? 'error'}). Intente de nuevo en un minuto.`);
    }
    const opciones = { userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) };
    let sub;
    try {
      // Se recrea la suscripción: una antigua y rota (por ejemplo de otra dirección del túnel) causa AbortError.
      const previa = await reg.pushManager.getSubscription();
      if (previa) await previa.unsubscribe().catch(() => null);
      sub = await reg.pushManager.subscribe(opciones);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        return msg(`El navegador no pudo crear la suscripción de avisos (${e?.name ?? 'error'}). Pruebe cerrar y abrir el navegador otra vez.`);
      }
      try {
        await new Promise((r) => setTimeout(r, 1500));
        sub = await reg.pushManager.subscribe(opciones);
      } catch (e2) {
        if (/GooglePlayServices|not found|missing/.test(String(e2?.message))) {
          return msg('Este teléfono no tiene Google Play Services activo, y Chrome lo necesita para los avisos. Pruebe abrir esta página en Firefox y activar los avisos desde allí.');
        }
        return msg('El servicio de avisos de Chrome rechazó la suscripción (AbortError). Revise en Ajustes de Android > Aplicaciones > Chrome > Notificaciones que estén permitidas, cierre Chrome y vuelva a intentar. Si sigue, active los avisos desde Firefox.');
      }
    }
    let r;
    try {
      r = await fetch('/v1/web/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch {
      return msg('Sin conexión con el servidor. Revise su internet e intente de nuevo.');
    }
    if (!r.ok) {
      let motivo = '';
      try {
        const e = await r.json();
        if (e?.error?.message) motivo = ` Motivo: ${e.error.message}`;
      } catch { /* respuesta sin JSON */ }
      return msg(`El servidor rechazó el registro de este teléfono (código ${r.status}).${motivo}`);
    }
    const d = await r.json();
    try {
      await kvSet('cred', { id: d.deviceId, secret: d.secret, base: location.origin });
    } catch {
      return msg('Este navegador bloquea el almacenamiento necesario para los avisos. Intente en modo normal (no incógnito).');
    }
    marcarActivo();
    avisoGlobal('Avisos activados en este teléfono. Puede probarlos abajo.', 'ok');
  }

  async function probarAviso() {
    const c = await kvGet('cred');
    if (!c) return msg('Active los avisos primero.');
    const r = await fetch(`/v1/devices/${c.id}/drill`, { method: 'POST', headers: { authorization: `Bearer ${c.secret}` } });
    if (r.ok) return msg('Enviado. Debe aparecer una notificación de prueba en unos segundos.');
    if (r.status === 429) return msg('Espere un minuto entre pruebas.');
    msg('No se pudo enviar la prueba.');
  }

  // Si las credenciales ya no sirven (la suscripción fue revocada), se pide reactivar.
  async function verificarAvisos() {
    const c = await kvGet('cred').catch(() => null);
    if (!c) return;
    const r = await fetch(`/v1/devices/${c.id}/pending`, { headers: { authorization: `Bearer ${c.secret}` } }).catch(() => null);
    if (r && r.ok) marcarActivo();
    else marcarInactivo('Los avisos de este teléfono se desactivaron. Vuelva a activarlos.');
  }

  $('btn-avisos').addEventListener('click', () => {
    activarAvisos().catch(() => msg('Ocurrió un error al activar los avisos. Intente de nuevo.'));
  });
  $('btn-prueba').addEventListener('click', () => {
    probarAviso().catch(() => msg('No se pudo enviar la prueba.'));
  });
  $('btn-desactivar').addEventListener('click', () => {
    desactivarAvisos().catch(() => msg('No se pudo desactivar. Intente de nuevo.'));
  });
  $('btn-compartir').addEventListener('click', () => { compartir(); });
  $('btn-ver-mapa').addEventListener('click', () => { enfocar(ultimoId); });
  $('btn-whats').addEventListener('click', () => {
    abrirWhats('Sismos en Panamá en vivo: mapa, avisos al teléfono, guía de emergencia y teléfonos útiles.');
  });
  $('btn-whats-alerta').addEventListener('click', () => {
    const u = ultimoId ? quakes.get(ultimoId) : null;
    if (!u) return;
    abrirWhats(`Sismo M${u.magnitude.toFixed(1)} en ${u.region} · ${fecha(u.originTime)} (${hace(u.originTime)}). Detalles y más sismos:`);
  });

  // ---------- Arranque ----------
  const esAppNativa = /AlertaSismicaApp/.test(navigator.userAgent);
  iniciarFiltros();
  iniciarMapa();
  if (esAppNativa) {
    // Dentro de la app nativa: los avisos los da la app (Web Push no funciona en WebView).
    const tarjeta = $('avisos');
    tarjeta.style.display = 'none';
  } else {
    if (soportado && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    verificarAvisos();
  }
  cargar();
  conectarEnVivo();
  cargarClima();
  climaTimer = setInterval(cargarClima, 30 * 60_000);
  setInterval(actualizarTiempos, 30_000);
  addEventListener('pagehide', () => clearInterval(climaTimer));
})();
