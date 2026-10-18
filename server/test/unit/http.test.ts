import { equal, ok } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

// El servidor lee variables de entorno AL importar: fijar todo antes del dynamic import.
const web = mkdtempSync(join(tmpdir(), 'pk-http-web-'));
const catalog = mkdtempSync(join(tmpdir(), 'pk-http-cat-'));
const releases = mkdtempSync(join(tmpdir(), 'pk-http-rel-'));
writeFileSync(join(web, 'index.html'), '<html>pintakids</html>');
mkdirSync(join(catalog, 'dinos'), { recursive: true });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1h8"/></svg>';
writeFileSync(join(catalog, 'dinos', 'rex.svg'), svg);
writeFileSync(join(catalog, 'dinos', 'manifest.json'), JSON.stringify({
  name: 'Dinosaurios', version: 1,
  files: [{ file: 'rex.svg', title: 'Rex', license: 'Pintakids-Original' }],
}));

process.env.WEB_DIR = web;
process.env.CATALOG_DIR = catalog;
process.env.RELEASES_DIR = releases;
process.env.ADMIN_TOKEN = 'token-de-prueba';

const { server } = await import('../../src/server.ts');
let base = '';

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (typeof address === 'object' && address) base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  for (const d of [web, catalog, releases]) rmSync(d, { recursive: true, force: true });
});

const get = async (path: string, headers?: Record<string, string>) => {
  const r = await fetch(base + path, { headers });
  return { status: r.status, body: await r.text().catch(() => ''), ct: r.headers.get('content-type') ?? '', csp: r.headers.get('content-security-policy') ?? '', cc: r.headers.get('cache-control') ?? '' };
};

test('GET /v1/health responde ok con app pintakids', async () => {
  const r = await get('/v1/health');
  equal(r.status, 200);
  const j = JSON.parse(r.body);
  equal(j.ok, true);
  equal(j.app, 'pintakids');
});

test('catálogo: índice, paquete y SVG con licencia validada', async () => {
  const idx = JSON.parse((await get('/v1/catalog')).body);
  equal(idx.total, 1);
  equal(idx.packs[0].id, 'dinos');

  const pack = JSON.parse((await get('/v1/catalog/dinos')).body);
  equal(pack.files[0].license, 'Pintakids-Original');

  const file = await get('/v1/catalog/dinos/files/rex.svg');
  equal(file.status, 200);
  ok(file.ct.includes('image/svg'));
  ok(file.cc.includes('immutable'));

  equal((await get('/v1/catalog/noexiste')).status, 404);
  equal((await get('/v1/catalog/dinos/files/../../secreto.svg')).status, 404);
  // Archivo declarado con licencia no gratuita jamás existió en el índice: 404 garantizado.
  equal((await get('/v1/catalog/dinos/files/pagado.svg')).status, 404);
});

test('app y recursos: CSP en HTML, sin path traversal, API rota responde JSON', async () => {
  const home = await get('/');
  equal(home.status, 200);
  ok(home.csp.includes("default-src 'self'"));
  ok(home.body.includes('pintakids'));
  equal((await get('/../server/src/server.ts')).status, 404);
  equal((await get('/no-existe.js')).status, 404);
  // Rutas de API ajenas a este servidor (p. ej. clientes de la app de sismos): JSON 404, jamás HTML.
  const viejo = await get('/v1/events');
  equal(viejo.status, 404);
  ok(viejo.body.includes('NO_ENCONTRADO'));
});

test('canal de versiones: vacío, publicación con token y protección', async () => {
  equal((await get('/v1/app-version')).status, 404);

  const apk = Buffer.concat([Buffer.from([0x50, 0x4b]), Buffer.alloc(2048, 7)]);
  const sinToken = await fetch(`${base}/v1/admin/apk`, { method: 'POST', body: apk });
  equal(sinToken.status, 401);

  const malo = await fetch(`${base}/v1/admin/apk`, { method: 'POST', body: Buffer.alloc(2048), headers: { authorization: 'Bearer incorrecto' } });
  equal(malo.status, 401);

  const subido = await fetch(`${base}/v1/admin/apk`, {
    method: 'POST', body: apk,
    headers: { authorization: 'Bearer token-de-prueba', 'x-version-name': '1.0.0' },
  });
  equal(subido.status, 200);
  equal((await subido.json()).app, 'pintakids');

  const ver = JSON.parse((await get('/v1/app-version')).body);
  equal(ver.versionCode, 1);
  equal(ver.apkUrl, '/descargas/app.apk');

  const dl = await get('/descargas/app.apk');
  equal(dl.status, 200);
  ok(dl.ct.includes('package-archive'));
});
