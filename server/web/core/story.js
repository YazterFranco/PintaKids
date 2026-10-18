/**
 * Modelo de "Mis cuentos" y exportación PDF. Puro: recibe datos, devuelve datos/bytes.
 * Un cuento es: { id, title, author, pages: [{ drawing (strokes JSON), caption }] }.
 */

import { deserializeStrokes } from './strokes.js';

export function newStory(author = '') {
  return { id: 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: '', author, pages: [] };
}

export function addPage(story, page = { drawing: '[]', caption: '' }) {
  if (!Array.isArray(page.drawing) && typeof page.drawing !== 'string') {
    throw new Error('drawing-debe-ser-json-o-arreglo');
  }
  const p = { drawing: typeof page.drawing === 'string' ? page.drawing : JSON.stringify(page.drawing), caption: String(page.caption ?? ''), voice: page.voice ?? null };
  const ok = deserializeStrokes(p.drawing);
  if (!ok.ok) throw new Error('dibujo-invalido:' + ok.error);
  return { ...story, pages: [...story.pages, p] };
}

export function setCaption(story, index, caption) {
  if (index < 0 || index >= story.pages.length) throw new Error('pagina-fuera-de-rango');
  const pages = story.pages.slice();
  pages[index] = { ...pages[index], caption: String(caption) };
  return { ...story, pages };
}

export function validateStory(story) {
  const errors = [];
  if (!story || typeof story !== 'object') return ['cuento-invalido'];
  if (!Array.isArray(story.pages)) errors.push('pages-debe-ser-lista');
  else story.pages.forEach((pg, i) => {
    const d = deserializeStrokes(pg.drawing ?? '[]');
    if (!d.ok) errors.push('pagina-' + i + ':' + d.error);
  });
  return errors;
}

const enc = new TextEncoder();

/**
 * PDF 1.4 mínimo escrito a mano (sin librerías, costo $0): una página por cuento,
 * 612x792 pt (carta), la imagen del dibujo centrada y el título/caption en Helvetica.
 * Nota: los strokes se rasterizan antes (la UI pasa un PNG→base64 JPEG simple o el bitmap).
 * Aquí el generador recibe páginas como { imageJpeg?: Uint8Array, text: string }.
 */
export function buildPdf(pages, meta = { title: 'Pintakids' }) {
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('sin-paginas');
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const latin = (s) => Array.from(String(s)).map((ch) => (ch.charCodeAt(0) > 127 ? '?' : ch)).join('');

  // IDs fijos por convención: 1=Catalog, 2=Pages, 3=Font; imágenes y contenidos desde 4.
  const CATALOG = add({ dict: '/Type /Catalog /Pages 2 0 R' });
  const PAGES = add(null);
  const FONT = add({ dict: '/Type /Font /Subtype /Type1 /BaseFont /Helvetica' });
  equalIds(CATALOG, 1);
  equalIds(PAGES, 2);
  equalIds(FONT, 3);

  const pageIds = [];
  for (const pg of pages) {
    let imageId = null;
    if (pg.imageJpeg) {
      imageId = add({ isImage: true, jpeg: pg.imageJpeg, w: pg.imageW ?? 300, h: pg.imageH ?? 300 });
    }
    let stream = '';
    if (imageId) {
      const scale = 492 / (pg.imageW ?? 300);
      const dh = Math.min(430, (pg.imageH ?? 300) * scale);
      stream += `q 492 0 0 ${dh.toFixed(2)} 60 ${Math.max(0, 300 - dh).toFixed(2)} cm /Im1 Do Q\n`;
    }
    const text = latin(esc((meta.title ? meta.title + '\n' : '') + (pg.text ?? '')));
    stream += 'BT /F1 14 Tf 60 140 Td 18 TL\n';
    for (const line of text.split('\n')) stream += `(${line}) Tj T*\n`;
    stream += 'ET';
    const contentId = add({ stream });
    const res = `/Resources << /Font << /F1 ${FONT} 0 R >>${imageId ? ` /XObject << /Im1 ${imageId} 0 R >>` : ''} >>`;
    pageIds.push(add({ dict: `/Type /Page /Parent ${PAGES} 0 R /MediaBox [0 0 612 792] ${res} /Contents ${contentId} 0 R` }));
  }
  objects[PAGES - 1] = { dict: `/Type /Pages /Kids [${pageIds.map((id) => id + ' 0 R').join(' ')}] /Count ${pages.length}` };

  return serializePdf(objects, CATALOG);
}

function equalIds(a, b) {
  if (a !== b) throw new Error('orden-de-objetos-roto');
}

function serializePdf(objects, catalogId) {
  const chunks = [];
  let offset = 0;
  const push = (data) => {
    const b = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(b);
    offset += b.length;
  };
  push('%PDF-1.4\n');
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    const num = i + 1;
    const o = objects[i];
    offsets.push(offset);
    if (o == null) {
      push(`${num} 0 obj\n<< >>\nendobj\n`);
    } else if (o.isImage) {
      const { jpeg, w, h } = o;
      push(`${num} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push('\nendstream\nendobj\n');
    } else if (o.stream) {
      const body = (o.extraCommands ?? '') + o.stream;
      push(`${num} 0 obj\n<< /Length ${enc.encode(body).length} >>\nstream\n${body}\nendstream\nendobj\n`);
    } else {
      push(`${num} 0 obj\n<< ${o.dict} >>\nendobj\n`);
    }
  }
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += String(off).padStart(10, '0') + ' 00000 n \n';
  push(xref);
  push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
