import { equal, ok } from 'node:assert';
import { test } from 'node:test';
import { addPage, buildPdf, newStory, setCaption, validateStory } from '../../web/core/story.js';

test('cuento: modelo básico y validación', () => {
  let s = newStory('Ana');
  s = addPage(s, { drawing: JSON.stringify([{ t: 'pencil', c: '#000', s: 4, p: [0.1, 0.1, 0.2, 0.2] }]), caption: 'Había una vez' });
  s = addPage(s, { drawing: '[]', caption: '' });
  s = setCaption(s, 1, 'Un dragón');
  equal(s.pages.length, 2);
  equal(s.pages[1].caption, 'Un dragón');
  equal(validateStory(s).length, 0);
  const broken = { ...s, pages: [{ drawing: 'no-json', caption: '' }] };
  ok(validateStory(broken).some((e) => e.startsWith('pagina-0')));
  ok(validateStory(null).includes('cuento-invalido'));
});

test('cuento: páginas no pueden recibir objetos sin serializar', () => {
  const s = newStory();
  let threw = false;
  try {
    addPage(s, { drawing: { malo: true }, caption: '' });
  } catch {
    threw = true;
  }
  ok(threw);
});

test('PDF: estructura mínima válida (cabecera, xref ordenado, trailer)', () => {
  // JPEG mínimo falso: basta /DCTDecode + longitud coherente para validar el contenedor.
  const fakeJpeg = Uint8Array.from([0xff, 0xd8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0xff, 0xd9]);
  const pdf = buildPdf(
    [
      { imageJpeg: fakeJpeg, imageW: 100, imageH: 80, text: 'Había una vez un dinosaurio astronauta' },
      { text: 'Y comió helado de colores. Fin' },
    ],
    { title: 'El dragón bailarín' },
  );
  const asText = new TextDecoder().decode(pdf);
  ok(asText.startsWith('%PDF-1.4'));
  ok(asText.trimEnd().endsWith('%%EOF'));
  ok(asText.includes('/Count 2'));
  ok(asText.includes('/DCTDecode'));
  const startxref = Number(/startxref\n(\d+)/.exec(asText)[1]);
  ok(asText.slice(startxref, startxref + 4) === 'xref');
  // Verificar que cada offset del xref apunta a un "N 0 obj" real.
  const xrefSection = asText.slice(startxref);
  const lines = xrefSection.split('\n').filter((l) => /^\d{10} 00000 n/.test(l));
  equal(lines.length, 8, '8 objetos: catálogo, páginas, fuente, imagen, 2 contenidos, 2 páginas');
  for (const l of lines) {
    const off = Number(l.slice(0, 10));
    const around = asText.slice(off, off + 12);
    ok(/\d+ 0 obj/.test(around), `offset ${off} no apunta a objeto: "${around}"`);
  }
});

test('PDF: acentos y símbolos raros no rompen el objeto (se transliteran)', () => {
  const pdf = new TextDecoder().decode(buildPdf([{ text: 'ñÑáéíóú¿?•«»emoji😀' }]));
  ok(pdf.includes('startxref'));
});
