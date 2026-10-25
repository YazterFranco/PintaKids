import { ok } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const WEB = join(import.meta.dirname, '..', '..', 'web');

test('sw: cada módulo JS de la app está en la lista offline', () => {
  const sw = readFileSync(join(WEB, 'sw.js'), 'utf8');
  for (const dir of ['core', 'ui', 'modes']) {
    for (const f of readdirSync(join(WEB, dir)).filter((n) => n.endsWith('.js'))) {
      ok(sw.includes(`'/${dir}/${f}'`), `falta /${dir}/${f} en SHELL_LIST de sw.js`);
    }
  }
});
