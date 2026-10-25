import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { obj, num, str } from './json.ts';

/**
 * Catálogo de dibujos para colorear, servido por el propio proyecto (costo $0 para siempre).
 *
 * REGLA DE LICENCIA (aprobada por el dueño): solo se sirven dibujos GRATUITOS SIN CONDICIONES:
 *   - "Pintakids-Original" → dibujos creados por este proyecto (propios).
 *   - "CC0-1.0"            → dominio público.
 * Nada de CC-BY/CC-BY-SA/comercial/no-comercial/pagos. Un manifiesto con licencia fuera de la
 * lista se rechaza al cargar y en las pruebas.
 */

export const ALLOWED_LICENSES = new Set(['Pintakids-Original', 'CC0-1.0']);

const PACK_ID = /^[a-z0-9][a-z0-9-]{0,38}$/;
const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,58}\.svg$/i;

export interface CatalogStep {
  key: string;
  es: string;
  en: string;
}

export interface CatalogFile {
  file: string;
  title: string;
  license: string;
  title_en?: string;
  level?: 1 | 2 | 3;
  steps?: CatalogStep[];
}

/** Pasos del dibujo guiado: lista de {key, es, en} con textos cortos; cualquier otra cosa se ignora. */
function stepsOf(raw: unknown): CatalogStep[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CatalogStep[] = [];
  for (const r of raw) {
    const o = obj(r);
    const key = str(o?.key);
    const es = str(o?.es);
    const en = str(o?.en);
    if (!key || !es || !en || key.length > 40 || es.length > 80 || en.length > 80) return undefined;
    out.push({ key, es, en });
  }
  return out;
}

export interface CatalogPack {
  id: string;
  name: string;
  name_en?: string;
  version: number;
  files: CatalogFile[];
}

export interface LoadReport {
  packs: CatalogPack[];
  rejected: { pack: string; reason: string }[];
}

/** Un SVG infantil nunca necesita scripts ni recursos externos: se rechazan (seguridad + costo). */
export function svgIsSafe(svg: string): boolean {
  const s = svg.toLowerCase();
  if (/<script|javascript:|foreignobject|\bimage\b[^>]*href|xlink:href\s*=\s*["']?https?:|<!entity|<!doctype/.test(s)) return false;
  return /<svg[\s>]/.test(s);
}

export function loadCatalog(root: string): LoadReport {
  const packs: CatalogPack[] = [];
  const rejected: { pack: string; reason: string }[] = [];
  if (!existsSync(root)) return { packs, rejected };

  for (const id of readdirSync(root).sort()) {
    const manifestPath = join(root, id, 'manifest.json');
    if (!PACK_ID.test(id) || !existsSync(manifestPath)) continue;

    let m: Record<string, unknown> | null = null;
    try {
      m = obj(JSON.parse(readFileSync(manifestPath, 'utf8')));
    } catch {
      rejected.push({ pack: id, reason: 'manifest-json-invalido' });
      continue;
    }
    const name = str(m?.name);
    const version = num(m?.version);
    const files = Array.isArray(m?.files) ? (m.files as unknown[]) : null;
    if (!name || version === null || version < 1 || !files) {
      rejected.push({ pack: id, reason: 'manifest-campos-faltantes' });
      continue;
    }

    const accepted: CatalogFile[] = [];
    for (const raw of files) {
      const f = obj(raw);
      const file = str(f?.file);
      const title = str(f?.title);
      const license = str(f?.license);
      if (!file || !FILE_NAME.test(file) || !title) {
        rejected.push({ pack: id, reason: `archivo-invalido:${file ?? '?'}` });
        continue;
      }
      // Licencia fuera de la lista gratuita → se rechaza el archivo, no se sirve jamás.
      if (!license || !ALLOWED_LICENSES.has(license)) {
        rejected.push({ pack: id, reason: `licencia-no-gratuita:${license ?? 'sin-licencia'}:${file}` });
        continue;
      }
      const filePath = join(root, id, file);
      if (!existsSync(filePath)) {
        rejected.push({ pack: id, reason: `archivo-faltante:${file}` });
        continue;
      }
      const svg = readFileSync(filePath, 'utf8');
      if (!svgIsSafe(svg)) {
        rejected.push({ pack: id, reason: `svg-inseguro:${file}` });
        continue;
      }
      const entry: CatalogFile = { file, title, license };
      const titleEn = str(f?.title_en);
      if (titleEn) entry.title_en = titleEn;
      const level = num(f?.level);
      if (level === 1 || level === 2 || level === 3) entry.level = level;
      const steps = stepsOf(f?.steps);
      if (steps) entry.steps = steps;
      accepted.push(entry);
    }
    const nameEn = str(m?.name_en);
    if (accepted.length) packs.push({ id, name, ...(nameEn ? { name_en: nameEn } : {}), version, files: accepted });
  }
  return { packs, rejected };
}

export class Catalog {
  readonly root: string;
  private index: CatalogPack[] = [];
  private count = 0;

  constructor(root: string) {
    this.root = root;
    this.reload();
  }

  reload(): void {
    const { packs } = loadCatalog(this.root);
    this.index = packs;
    this.count = packs.reduce((n, p) => n + p.files.length, 0);
  }

  summary(): { packs: { id: string; name: string; name_en?: string; version: number; fileCount: number }[]; total: number } {
    return { packs: this.index.map((p) => ({ id: p.id, name: p.name, ...(p.name_en ? { name_en: p.name_en } : {}), version: p.version, fileCount: p.files.length })), total: this.count };
  }

  pack(packId: string): CatalogPack | null {
    if (!PACK_ID.test(packId)) return null;
    return this.index.find((p) => p.id === packId) ?? null;
  }

  /** Devuelve el SVG solo si está en el índice validado (nunca lee rutas arbitrarias). */
  file(packId: string, file: string): Buffer | null {
    const pack = this.pack(packId);
    if (!pack || !FILE_NAME.test(file)) return null;
    if (!pack.files.some((f) => f.file === file)) return null;
    try {
      return readFileSync(join(this.root, packId, file));
    } catch {
      return null;
    }
  }
}
