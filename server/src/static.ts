import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.worker.js': 'text/javascript; charset=utf-8',
};

export interface StaticFile {
  body: Buffer;
  type: string;
  cache: string;
}

/** El index de cada carpeta se sirve en su ruta base. */
function resolvePath(urlPath: string, dir: string): string | null {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  if (clean.includes('..') || clean.includes('\0')) return null;
  let full = join(dir, clean);
  if (clean.endsWith(sep) || clean === '') full = join(full, 'index.html');
  // Normalizar y exigir que siga dentro de la raíz: sin recorrido de carpetas.
  const root = normalize(dir);
  const resolved = normalize(full);
  if (resolved !== root && !resolved.startsWith(root + sep)) return null;
  return resolved;
}

/**
 * Sirve solo archivos existentes con extensión permitida, dentro de `dir`.
 * Cache: HTML y service worker no se cachean (las actualizaciones llegan de inmediato);
 * el resto 5 min (los módulos JS no llevan hash en el nombre; 5 min es buen balance).
 */
export function staticFile(urlPath: string, dir: string): StaticFile | null {
  const full = resolvePath(urlPath, dir);
  if (!full || !existsSync(full)) {
    // SPA de una página: rutas internas caen al index.
    if (full && !extname(full) && existsSync(join(dir, 'index.html'))) {
      return { body: readFileSync(join(dir, 'index.html')), type: TYPES['.html'], cache: 'no-cache' };
    }
    return null;
  }
  if (!statSync(full).isFile()) return null;
  const type = TYPES[extname(full)];
  if (!type) return null;
  const name = full.slice(dir.length);
  const cache = name.endsWith('sw.js') || extname(full) === '.html' ? 'no-cache' : 'public, max-age=300';
  return { body: readFileSync(full), type, cache };
}
