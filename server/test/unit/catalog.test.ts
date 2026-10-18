import { deepEqual, equal, ok } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Catalog, loadCatalog, svgIsSafe, ALLOWED_LICENSES } from '../../src/catalog.ts';

const GOOD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10h80"/></svg>';

function packDir(root: string, id: string, manifest: unknown, files: Record<string, string> = { 'sol.svg': GOOD_SVG }): string {
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

function tempCatalog(setup: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), 'pintakids-cat-'));
  setup(root);
  return root;
}

test('licencias permitidas: solo gratis sin condiciones', () => {
  deepEqual([...ALLOWED_LICENSES].sort(), ['CC0-1.0', 'Pintakids-Original']);
});

test('acepta dibujos propios y CC0; rechaza cualquier otra licencia', () => {
  const root = tempCatalog((r) => {
    packDir(r, 'animales', {
      name: 'Animales', version: 1,
      files: [
        { file: 'sol.svg', title: 'El sol', license: 'Pintakids-Original' },
        { file: 'pata.svg', title: 'Pata', license: 'CC0-1.0' },
        { file: 'robada.svg', title: 'De pago', license: 'CC-BY-4.0' },
        { file: 'sinlic.svg', title: 'Sin licencia', license: null },
      ],
    }, { 'sol.svg': GOOD_SVG, 'pata.svg': GOOD_SVG, 'robada.svg': GOOD_SVG, 'sinlic.svg': GOOD_SVG });
  });
  try {
    const { packs, rejected } = loadCatalog(root);
    equal(packs.length, 1);
    deepEqual(packs[0].files.map((f) => f.file), ['sol.svg', 'pata.svg']);
    ok(rejected.some((r) => r.reason.includes('licencia-no-gratuita:CC-BY-4.0')));
    ok(rejected.some((r) => r.reason.includes('sin-licencia')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rechaza SVG inseguros (scripts, recursos externos, entidades)', () => {
  ok(!svgIsSafe('<svg><script>alert(1)</script></svg>'));
  ok(!svgIsSafe('<svg><image href="https://malicioso/x.png"/></svg>'));
  ok(!svgIsSafe('<svg><foreignObject><div>html</div></foreignObject></svg>'));
  ok(!svgIsSafe('<!DOCTYPE svg><svg></svg>'));
  ok(svgIsSafe(GOOD_SVG));

  const root = tempCatalog((r) => {
    packDir(r, 'p', { name: 'P', version: 1, files: [{ file: 'sol.svg', title: 'S', license: 'CC0-1.0' }] }, { 'sol.svg': '<svg><script>x()</script></svg>' });
  });
  try {
    const { packs, rejected } = loadCatalog(root);
    equal(packs.length, 0);
    ok(rejected.some((r) => r.reason.startsWith('svg-inseguro')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('manifiesto inválido o con campos faltantes se rechaza sin tumbar el catálogo', () => {
  const root = tempCatalog((r) => {
    packDir(r, 'roto', '{no es json');
    packDir(r, 'corto', { name: 'Sin versión', files: [] });
    packDir(r, 'bueno', { name: 'Bueno', version: 2, files: [{ file: 'sol.svg', title: 'S', license: 'CC0-1.0' }] });
  });
  try {
    const { packs, rejected } = loadCatalog(root);
    deepEqual(packs.map((p) => p.id), ['bueno']);
    equal(rejected.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('archivo declarado pero faltante se rechaza; ruta rara también', () => {
  const root = tempCatalog((r) => {
    packDir(r, 'p', {
      name: 'P', version: 1,
      files: [
        { file: 'noexiste.svg', title: 'X', license: 'CC0-1.0' },
        { file: '../escape.svg', title: 'Y', license: 'CC0-1.0' },
        { file: 'sol.svg', title: 'S', license: 'CC0-1.0' },
      ],
    });
  });
  try {
    const { packs, rejected } = loadCatalog(root);
    deepEqual(packs[0].files.map((f) => f.file), ['sol.svg']);
    ok(rejected.some((r) => r.reason.includes('archivo-invalido')));
    ok(rejected.some((r) => r.reason.includes('archivo-faltante')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Catalog.file sirve solo lo indexado: nunca lee rutas ajenas', () => {
  const root = tempCatalog((r) => {
    packDir(r, 'p', { name: 'P', version: 1, files: [{ file: 'sol.svg', title: 'S', license: 'CC0-1.0' }] });
    writeFileSync(join(r, 'secreto.svg'), GOOD_SVG);
  });
  try {
    const cat = new Catalog(root);
    ok(cat.file('p', 'sol.svg'));
    equal(cat.file('p', 'pata.svg'), null);
    equal(cat.file('p', '../secreto.svg'), null);
    equal(cat.file('../p', 'sol.svg'), null);
    equal(cat.file('p', 'secreto.svg'), null);
    deepEqual(cat.summary().packs, [{ id: 'p', name: 'P', version: 1, fileCount: 1 }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
