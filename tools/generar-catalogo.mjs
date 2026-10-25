#!/usr/bin/env node
/**
 * Genera el catálogo v4 de Pintakids desde tools/drawings/<paquete>/.
 * Cada dibujo es un SVG ORIGINAL hecho a mano (Pintakids-Original) dividido en pasos
 * <g data-step data-name>; pack.json da títulos ES/EN, nivel y nombres de los pasos.
 *
 * Uso (desde la raíz del repo): node tools/generar-catalogo.mjs
 * Falla si un dibujo no cuadra con su pack.json (pasos, nivel, licencia).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSteps } from '../server/web/core/svgsteps.js';

const SRC = join(import.meta.dirname, 'drawings');
const OUT = join(import.meta.dirname, '..', 'server', 'catalog');
const LICENSE = 'Pintakids-Original';
const LEVEL_STEPS = { 1: [4, 5], 2: [6, 8], 3: [9, 12] };
const ORDER = ['animales', 'granja', 'oceano', 'dinosaurios', 'vehiculos', 'fantasia', 'espacio', 'comida'];

const errors = [];
const packs = readdirSync(SRC).filter((d) => existsSync(join(SRC, d, 'pack.json')));
packs.sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99);

// El catálogo servido se regenera entero: lo viejo se borra.
for (const d of existsSync(OUT) ? readdirSync(OUT) : []) rmSync(join(OUT, d), { recursive: true, force: true });

let total = 0;
for (const id of packs) {
  const pack = JSON.parse(readFileSync(join(SRC, id, 'pack.json'), 'utf8'));
  const files = [];
  for (const it of pack.items) {
    const file = `${it.id}.svg`;
    const path = join(SRC, id, file);
    if (!existsSync(path)) {
      errors.push(`${id}/${file}: falta el SVG`);
      continue;
    }
    let parsed;
    try {
      parsed = parseSteps(readFileSync(path, 'utf8'));
    } catch (e) {
      errors.push(`${id}/${file}: ${e.message}`);
      continue;
    }
    const keys = parsed.steps.map((s) => s.key).join(',');
    const want = it.steps.map((s) => s.key).join(',');
    if (keys !== want) errors.push(`${id}/${file}: pasos SVG [${keys}] ≠ pack.json [${want}]`);
    const [lo, hi] = LEVEL_STEPS[it.level] ?? [0, -1];
    if (it.steps.length < lo || it.steps.length > hi) errors.push(`${id}/${file}: nivel ${it.level} con ${it.steps.length} pasos`);
    files.push({ file, title: it.title, title_en: it.title_en, level: it.level, steps: it.steps, license: LICENSE });
  }
  mkdirSync(join(OUT, id), { recursive: true });
  for (const f of files) copyFileSync(join(SRC, id, f.file), join(OUT, id, f.file));
  writeFileSync(
    join(OUT, id, 'manifest.json'),
    JSON.stringify({ name: pack.name, name_en: pack.name_en, version: 4, license: LICENSE, files }, null, 2) + '\n',
  );
  total += files.length;
  console.log(`  ${id}: ${files.length} dibujos`);
}

if (errors.length) {
  console.error('\n✗ Errores:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ catálogo v4: ${packs.length} paquetes, ${total} dibujos`);
