import { equal, ok } from 'node:assert';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadCatalog } from '../../src/catalog.ts';

/**
 * GUARDIÁN DE LA REGLA DEL DUEÑO: todo dibujo servido debe ser GRATIS SIN CONDICIONES.
 * Este prueba falla en CI si cualquier SVG real del catálogo:
 *   - usa una licencia distinta de Pintakids-Original / CC0-1.0,
 *   - o contiene scripts/recursos externos.
 */
const CAT = join(import.meta.dirname, '..', '..', 'catalog');

test('catálogo real: todos los dibujos son gratuitos sin condiciones y seguros', () => {
  const { packs, rejected } = loadCatalog(CAT);
  equal(rejected.length, 0, `manifiestos defectuosos: ${JSON.stringify(rejected)}`);
  ok(packs.length >= 5, 'el catálogo debe traer varios paquetes');
  let total = 0;
  for (const pack of packs) {
    ok(pack.files.length > 0);
    for (const f of pack.files) {
      ok(['Pintakids-Original', 'CC0-1.0'].includes(f.license), `${pack.id}/${f.file}: licencia ${f.license} NO es gratis sin condiciones`);
      total++;
    }
  }
  ok(total >= 40, `esperados ≥40 dibujos, hay ${total}`);
  console.log(`  catálogo real: ${packs.length} paquetes, ${total} dibujos ✓`);
});

import { readFileSync } from 'node:fs';
import { parseSteps } from '../../web/core/svgsteps.js';

const PACKS_V4 = ['animales', 'granja', 'oceano', 'dinosaurios', 'vehiculos', 'fantasia', 'espacio', 'comida'];
const LEVEL_STEPS: Record<number, [number, number]> = { 1: [4, 5], 2: [6, 8], 3: [9, 12] };

test('catálogo v4: 8 paquetes, ≥56 dibujos por pasos con niveles coherentes', () => {
  const { packs } = loadCatalog(CAT);
  const ids = packs.map((p) => p.id).sort();
  equal(JSON.stringify(ids), JSON.stringify([...PACKS_V4].sort()), 'paquetes del catálogo v4');
  let total = 0;
  for (const pack of packs) {
    ok(pack.files.length >= 7, `${pack.id}: al menos 7 dibujos`);
    const levels = new Set<number>();
    for (const f of pack.files as any[]) {
      const svg = readFileSync(join(CAT, pack.id, f.file), 'utf8');
      const parsed = parseSteps(svg);
      equal(parsed.viewBox, '0 0 400 400', `${f.file}: viewBox`);
      ok(f.title_en, `${f.file}: falta title_en`);
      ok(Array.isArray(f.steps), `${f.file}: falta steps`);
      equal(JSON.stringify(parsed.steps.map((s) => s.key)), JSON.stringify(f.steps.map((s: any) => s.key)), `${f.file}: pasos ≠ manifiesto`);
      for (const s of f.steps) ok(s.es && s.en, `${f.file}/${s.key}: nombre ES/EN del paso`);
      const [lo, hi] = LEVEL_STEPS[f.level];
      ok(f.steps.length >= lo && f.steps.length <= hi, `${f.file}: nivel ${f.level} con ${f.steps.length} pasos`);
      levels.add(f.level);
      total++;
    }
    ok(levels.size >= 2, `${pack.id}: mezcla de niveles`);
  }
  ok(total >= 56, `esperados ≥56 dibujos, hay ${total}`);
});
