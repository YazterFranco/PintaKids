/**
 * Dibujos por pasos: cada SVG del catálogo se divide en <g data-step="N" data-name="clave">.
 * - Orden en el archivo = orden de PINTADO (atrás → adelante; los rellenos blancos tapan).
 * - data-step = orden de DIBUJO (como en un tutorial: primero la cabeza, luego lo que va detrás).
 * Puro (sin DOM): funciona igual en el navegador y en las pruebas de Node.
 */

const STEP_OPEN = /^<g\b([^>]*)>/;

function attr(attrs, name) {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return m ? m[1] : null;
}

/** Devuelve el índice justo después del </g> que cierra el <g> que empieza en `start`. */
function closeOf(src, start) {
  const re = /<g\b[^>]*?(\/?)>|<\/g>/g;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[0].startsWith('</')) depth--;
    else if (!m[1]) depth++;
    if (depth === 0) return re.lastIndex;
  }
  throw new Error('svg-mal-formado: <g> sin cerrar');
}

export function parseSteps(svgText) {
  const open = /<svg\b([^>]*)>/.exec(svgText);
  if (!open) throw new Error('svg-mal-formado: falta <svg>');
  const rootAttrs = open[1].trim();
  const viewBox = attr(rootAttrs, 'viewBox');
  if (!viewBox) throw new Error('svg-mal-formado: falta viewBox');
  const end = svgText.lastIndexOf('</svg>');
  let i = open.index + open[0].length;
  const steps = [];
  let order = 0;
  while (i < end) {
    const rest = svgText.slice(i, end);
    const ws = /^(\s+|<!--[^]*?-->)/.exec(rest);
    if (ws) {
      i += ws[0].length;
      continue;
    }
    const g = STEP_OPEN.exec(rest);
    if (!g || attr(g[1], 'data-step') === null) throw new Error('svg-mal-formado: contenido fuera de un paso');
    const key = attr(g[1], 'data-name');
    if (!key) throw new Error('svg-mal-formado: paso sin data-name');
    const stop = closeOf(svgText, i);
    steps.push({ n: Number(attr(g[1], 'data-step')), key, markup: svgText.slice(i, stop), order: order++ });
    i = stop;
  }
  steps.sort((a, b) => a.n - b.n);
  steps.forEach((s, k) => {
    if (s.n !== k + 1) throw new Error('svg-mal-formado: pasos no consecutivos');
  });
  return { viewBox, rootAttrs, steps };
}

/**
 * SVG con los pasos 1..n, pintados en su orden de archivo.
 * earlier: 'normal' | 'dim' (gris claro) | 'hide' (trazo blanco: tapa pero no se ve)
 * current: { stroke, dash } para resaltar el paso n como guía.
 */
const DIM = '#c9c6d4';
const INK_FILL = /fill="#2b2d42"/g;
const recolor = (markup, color) => markup.replace(INK_FILL, `fill="${color}"`);

export function svgUpTo(parsed, n, { earlier = 'normal', current = null } = {}) {
  const body = parsed.steps
    .filter((s) => s.n <= n)
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      if (s.n === n && current) {
        const dash = current.dash ? ` stroke-dasharray="${current.dash}"` : '';
        return `<g stroke="${current.stroke}"${dash}>${s.markup}</g>`;
      }
      // Sin opacidad: el relleno blanco debe seguir tapando lo que queda detrás.
      if (s.n < n && earlier === 'dim') return `<g stroke="${DIM}">${recolor(s.markup, DIM)}</g>`;
      if (s.n < n && earlier === 'hide') return `<g stroke="#ffffff">${recolor(s.markup, '#ffffff')}</g>`;
      return s.markup;
    })
    .join('');
  return `<svg ${parsed.rootAttrs}>${body}</svg>`;
}

export function stepOnly(parsed, n) {
  const s = parsed.steps.find((x) => x.n === n);
  return `<svg ${parsed.rootAttrs}>${s ? s.markup : ''}</svg>`;
}
