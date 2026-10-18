import { equal, ok } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import { staticFile } from '../../src/static.ts';

const web = mkdtempSync(join(tmpdir(), 'pintakids-web-'));
writeFileSync(join(web, 'index.html'), '<html>ok</html>');
writeFileSync(join(web, 'sw.js'), 'self.addEventListener("install",()=>{})');
writeFileSync(join(web, 'app.js'), 'console.log(1)');
mkdirSync(join(web, 'core'), { recursive: true });
writeFileSync(join(web, 'core', 'x.js'), 'x');
mkdirSync(join(web, 'assets'), { recursive: true });
writeFileSync(join(web, 'assets', 'sol.svg'), '<svg/>');
writeFileSync(join(web, 'notas.txt'), 'creditos de licencias: CC0 y Pintakids-Original');
writeFileSync(join(web, 'claves.env'), 'SECRET=1');
writeFileSync(join(web, 'base.sqlite'), 'x');
writeFileSync(join(web, 'assets', 'datos.json'), '{}');

test('sirve la app con cache correcto', () => {
  const index = staticFile('/', web);
  ok(index);
  ok(index.body.toString().includes('ok'));
  equal(index.type, 'text/html; charset=utf-8');
  equal(index.cache, 'no-cache');

  equal(staticFile('/index.html', web).cache, 'no-cache');
  equal(staticFile('/sw.js', web).cache, 'no-cache');
  equal(staticFile('/app.js', web).cache, 'public, max-age=300');
  equal(staticFile('/assets/sol.svg', web).type, 'image/svg+xml');
  equal(staticFile('/assets/datos.json', web).type, 'application/json; charset=utf-8');
});

test('sin recorrido de carpetas ni lectura fuera de la raíz', () => {
  // "/.." colapsa en la raíz del servidor de archivos: "/../notas.txt" queda DENTRO de web/ y eso es seguro.
  ok(staticFile('/../notas.txt', web), 'resuelve dentro de la raíz: permitido');
  // Intentos reales de escapar: quedan ".." tras normalizar → null.
  equal(staticFile('/a/../../claves.env', web), null);
  equal(staticFile('/assets/../../claves.env', web), null);
  // Nada de estas rutas lee un archivo del sistema: o es null, o cae al index (SPA) — nunca lee /etc/passwd.
  const p1 = staticFile('/%2e%2e/%2e%2e/etc/passwd', web);
  ok(p1 === null || p1.body.toString().includes('<html>ok</html>'));
  const p2 = staticFile('/..%2f..%2fetc/passwd', web);
  ok(p2 === null || p2.body.toString().includes('<html>ok</html>'));
  equal(staticFile('/%00index.html', web), null);
});

test('solo extensiones permitidas: txt sí (créditos), env/sqlite/ts no', () => {
  equal(staticFile('/notas.txt', web).type, 'text/plain; charset=utf-8');
  equal(staticFile('/claves.env', web), null);
  equal(staticFile('/base.sqlite', web), null);
});

test('rutas de SPA sin archivo caen al index; rutas raras son 404', () => {
  equal(staticFile('/no-existe.html', web), null);
  equal(staticFile('/x/y/z', web).type, 'text/html; charset=utf-8');
});

after(() => rmSync(web, { recursive: true, force: true }));
