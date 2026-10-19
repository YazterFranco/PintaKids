#!/usr/bin/env node
/**
 * Genera los paquetes de dibujos para colorear del catálogo de Pintakids (v3 "detallado").
 * Todos los SVG son ORIGINALES del proyecto (licencia Pintakids-Original, costo $0).
 *
 * Estilo v3: siluetas cerradas con MÚLTIPLES regiones de color (barriga, patas, aletas),
 * texturas (rayas, escamas, manchas, pelaje), caras expresivas (cejas, bocas abiertas),
 * escenas con contexto (suelo, hierba, agua, nubes, estrellas) y trazo grueso 6.5.
 *
 * Uso: node tools/generar-catalogo.mjs   (desde la raíz del repo)
 * Los dibujos viven en tools/catalog-*.mjs; este runner solo empaqueta y escribe.
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { LICENSE } from './catalog-lib.mjs';

import { animales } from './catalog-animales.mjs';
import { naturaleza } from './catalog-naturaleza.mjs';
import { comida } from './catalog-comida.mjs';
import { vehiculos } from './catalog-vehiculos.mjs';
import { fantasia } from './catalog-fantasia.mjs';
import { espacio } from './catalog-espacio.mjs';
import { granja } from './catalog-granja.mjs';
import { oceano } from './catalog-oceano.mjs';
import { flores, deportes, instrumentos } from './catalog-varios.mjs';

const OUT = join(import.meta.dirname, '..', 'server', 'catalog');

/** Mapa pack-id → { name, items }. El id debe cumplir /^[a-z0-9][a-z0-9-]{0,38}$/ */
const packs = {
  animales: { name: 'Animales', items: animales },
  naturaleza: { name: 'Naturaleza', items: naturaleza },
  comida: { name: 'Comida', items: comida },
  vehiculos: { name: 'Vehículos', items: vehiculos },
  fantasia: { name: 'Fantasía', items: fantasia },
  espacio: { name: 'Espacio', items: espacio },
  granja: { name: 'Granja', items: granja },
  oceano: { name: 'Océano', items: oceano },
  flores: { name: 'Flores', items: flores },
  deportes: { name: 'Deportes', items: deportes },
  instrumentos: { name: 'Instrumentos', items: instrumentos },
};

const VERSION = 3;
const packTotals = {};
let grand = 0;

for (const [pack, { name, items }] of Object.entries(packs)) {
  const dir = join(OUT, pack);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const files = items.map(([file, title, body]) => {
    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
      `<g fill="none" stroke="#2b2d42" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;
    writeFileSync(join(dir, file + '.svg'), svg);
    return { file: file + '.svg', title, license: LICENSE };
  });
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({ name, version: VERSION, license: LICENSE, files }, null, 2) + '\n',
  );
  packTotals[pack] = files.length;
  grand += files.length;
}

console.log(
  `Catálogo v${VERSION} generado: ${Object.keys(packTotals).length} paquetes, ${grand} dibujos (todos ${LICENSE}, costo $0).`,
);
for (const [pack, n] of Object.entries(packTotals)) console.log(`  ${pack}: ${n}`);
