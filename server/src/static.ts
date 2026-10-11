import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** Solo estos archivos se sirven: una lista blanca evita cualquier recorrido de carpetas. */
const PUBLIC_FILES = new Set(['/index.html', '/app.js', '/sw.js', '/creds.js', '/style.css', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png']);

export interface StaticFile {
  body: Buffer;
  type: string;
  cache: string;
}

export function staticFile(urlPath: string, dir: string): StaticFile | null {
  const name = urlPath === '/' ? '/index.html' : urlPath;
  if (!PUBLIC_FILES.has(name)) return null;
  const type = TYPES[extname(name)];
  if (!type) return null;
  // El service worker nunca se cachea en el navegador: así las actualizaciones llegan de inmediato.
  const cache = name === '/sw.js' ? 'no-cache' : 'public, max-age=300';
  return { body: readFileSync(join(dir, name)), type, cache };
}
