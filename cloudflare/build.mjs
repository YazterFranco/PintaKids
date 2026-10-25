/**
 * Build estático para Cloudflare Pages.
 * Genera `dist/` con la PWA + el catálogo validado (mismas reglas de licencia que el servidor).
 * Uso: node cloudflare/build.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const WEB = join(ROOT, 'server', 'web');
const CATALOG = join(ROOT, 'server', 'catalog');
const DIST = join(ROOT, 'dist');

const ALLOWED_LICENSES = new Set(['Pintakids-Original', 'CC0-1.0']);
const PACK_ID = /^[a-z0-9][a-z0-9-]{0,38}$/;
const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,58}\.svg$/i;

function svgIsSafe(svg) {
  const s = svg.toLowerCase();
  if (/<script|javascript:|foreignobject|\bimage\b[^>]*href|xlink:href\s*=\s*["']?https?:|<!entity|<!doctype/.test(s)) return false;
  return /<svg[\s>]/.test(s);
}

function loadCatalog() {
  const packs = [];
  if (!existsSync(CATALOG)) return packs;
  for (const id of readdirSync(CATALOG).sort()) {
    if (!PACK_ID.test(id)) continue;
    const manifestPath = join(CATALOG, id, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    let m;
    try {
      m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      console.warn(`[skip] ${id}: manifest.json inválido`);
      continue;
    }
    if (!m || typeof m.name !== 'string' || !Array.isArray(m.files)) {
      console.warn(`[skip] ${id}: manifest incompleto`);
      continue;
    }
    const accepted = [];
    for (const raw of m.files) {
      const file = raw?.file;
      const title = raw?.title;
      const license = raw?.license;
      if (!file || !FILE_NAME.test(file) || !title || !ALLOWED_LICENSES.has(license)) continue;
      const filePath = join(CATALOG, id, file);
      if (!existsSync(filePath)) continue;
      const svg = readFileSync(filePath, 'utf8');
      if (!svgIsSafe(svg)) continue;
      accepted.push({ file, title, license });
    }
    if (accepted.length) packs.push({ id, name: m.name, version: Number(m.version) || 1, files: accepted });
  }
  return packs;
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// 1. Copiar la PWA
for (const entry of readdirSync(WEB)) {
  cpSync(join(WEB, entry), join(DIST, entry), { recursive: true });
}

// 2. Catálogo validado
const packs = loadCatalog();
const summary = [];
let total = 0;
for (const pack of packs) {
  const packDir = join(DIST, 'catalog', pack.id);
  mkdirSync(packDir, { recursive: true });
  for (const f of pack.files) {
    cpSync(join(CATALOG, pack.id, f.file), join(packDir, f.file));
  }
  writeFileSync(join(packDir, 'manifest.json'), JSON.stringify(pack));
  summary.push({ id: pack.id, name: pack.name, version: pack.version, fileCount: pack.files.length });
  total += pack.files.length;
}
writeFileSync(
  join(DIST, 'catalog-index.json'),
  JSON.stringify({ generatedAt: Date.now(), packs: summary, total, licenses: ['gratis-sin-condiciones'] }),
);

// 3. Assets auxiliares (el Worker vive fuera de dist; nunca se publica como asset)
writeFileSync(join(DIST, '.assetsignore'), '_worker.js\n_headers\n');

console.log(`✓ dist/ generado: ${packs.length} paquetes, ${total} dibujos`);
