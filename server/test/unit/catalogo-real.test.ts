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
