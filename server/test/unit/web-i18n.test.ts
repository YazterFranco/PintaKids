import { equal, ok } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DEFAULT_LANG, diffKeys, normalizeLang, pickLang, SUPPORTED, t } from '../../web/core/i18n.js';

const es = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'web', 'i18n', 'es.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'web', 'i18n', 'en.json'), 'utf8'));

test('ES y EN tienen exactamente las mismas claves', () => {
  const { missing, extra } = diffKeys(es, en);
  equal(missing.length, 0, 'faltan en EN: ' + missing.join(', '));
  equal(extra.length, 0, 'sobran en EN: ' + extra.join(', '));
});

test('sin valores vacíos ni duplicados silenciosos', () => {
  for (const [lang, d] of [['es', es], ['en', en]]) {
    for (const [k, v] of Object.entries(d)) {
      ok(typeof v === 'string' && v.trim() !== '', `${lang}: ${k} vacío`);
      ok(k.match(/^[a-z]+(\.[a-z][a-zA-Z0-9]*)+$/), `${lang}: clave con forma rara ${k}`);
    }
  }
});

test('parametrización {n}/{total} presente en ambos idiomas', () => {
  ok(es['learn.step'].includes('{n}') && es['learn.step'].includes('{total}'));
  ok(en['learn.step'].includes('{n}') && en['learn.step'].includes('{total}'));
  equal(t({ es, en }, 'es', 'learn.step', { n: 2, total: 5 }), 'Paso 2 de 5');
  equal(t({ es, en }, 'en', 'learn.step', { n: 2, total: 5 }), 'Step 2 of 5');
});

test('fallback y normalizaciones', () => {
  equal(t({ es, en }, 'en', 'app.name'), 'Pintakids');
  equal(t({ es }, 'fr', 'app.name'), 'Pintakids', 'idioma desconocido cae a ES');
  equal(t({ es, en }, 'es', 'no.existe.clave'), 'no.existe.clave');
  equal(normalizeLang('ES-mx'), 'es');
  equal(normalizeLang('de'), DEFAULT_LANG);
  equal(normalizeLang('en-GB'), 'en');
  equal(SUPPORTED.join(','), 'es,en');
  equal(pickLang('auto', 'en-US'), 'en');
  equal(pickLang('es', 'en-US'), 'es');
  equal(pickLang(null, 'fr'), 'es');
});
