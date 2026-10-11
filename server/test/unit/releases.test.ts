import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Releases } from '../../src/releases.ts';

/** Cabecera ZIP (los APK empiezan con PK\x03\x04) rellenada hasta el mínimo de 1024 bytes. */
const fakeApk = (filler = 1200): Buffer => {
  const b = Buffer.alloc(filler);
  b[0] = 0x50; b[1] = 0x4b; b[2] = 3; b[3] = 4;
  return b;
};

test('releases: vacío al inicio, publica y auto-incrementa', () => {
  const dir = mkdtempSync(join(tmpdir(), 'releases-'));
  try {
    const r = new Releases(dir);
    assert.equal(r.current(), null);
    assert.equal(r.apk(), null);
    const a = r.publish(fakeApk(), { versionCode: 5, versionName: '1.2.0', notes: 'prueba' });
    assert.equal(a.versionCode, 5);
    assert.equal(a.versionName, '1.2.0');
    const b = r.publish(fakeApk(), {});
    assert.equal(b.versionCode, 6, 'auto-incremento');
    assert.ok(r.apk()!.length >= 1024);
    assert.equal(r.current()!.versionCode, 6);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('releases: rechaza lo que no es APK, cuerpos gigantes y versiones que no suben', () => {
  const dir = mkdtempSync(join(tmpdir(), 'releases-'));
  try {
    const r = new Releases(dir);
    assert.throws(() => r.publish(Buffer.alloc(2000), {}), /no-es-apk/);
    r.publish(fakeApk(), { versionCode: 9 });
    assert.throws(() => r.publish(fakeApk(), { versionCode: 9 }), /version-no-mayor/);
    assert.throws(() => r.publish(fakeApk(31 * 1024 * 1024), {}), /demasiado-grande/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
