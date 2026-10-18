import { deepEqual, equal, ok, throws } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Releases } from '../../src/releases.ts';

function fakeApk(marker = 'a'): Buffer {
  // "PK" + relleno hasta superar el mínimo de 1 KB: suficientemente APK para el validador.
  return Buffer.concat([Buffer.from([0x50, 0x4b]), Buffer.alloc(2048, marker.charCodeAt(0))]);
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'pintakids-rel-'));
}

test('publica, lee y auto-incrementa dentro del canal', () => {
  const dir = tempDir();
  try {
    const rel = new Releases(dir, 'pintakids');
    equal(rel.current(), null);
    const v1 = rel.publish(fakeApk('a'), { versionName: '1.0.0', notes: 'primera' });
    equal(v1.versionCode, 1);
    equal(v1.app, 'pintakids');
    const v2 = rel.publish(fakeApk('b'), { versionCode: 5, versionName: '1.1.0' });
    equal(v2.versionCode, 5);
    throws(() => rel.publish(fakeApk('c'), { versionCode: 4 }), /version-no-mayor/);
    ok(rel.apk());
    equal(readFileSync(join(dir, 'app.apk'))[2], 'b'.charCodeAt(0));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rechaza cuerpos que no son APK', () => {
  const dir = tempDir();
  try {
    const rel = new Releases(dir, 'pintakids');
    throws(() => rel.publish(Buffer.alloc(2048, 1), {}), /no-es-apk/);
    throws(() => rel.publish(Buffer.from([0x50, 0x4b]), {}), /no-es-apk/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('aisla el canal: una versión de otra app (p. ej. sismos) nunca se sirve ni suma', () => {
  const dir = tempDir();
  try {
    mkdirSync(dir, { recursive: true });
    // Restos del proyecto anterior en el volumen de Railway.
    writeFileSync(join(dir, 'version.json'), JSON.stringify({ app: 'alerta-sismica-pa', versionCode: 6, versionName: '1.3.0', notes: '', mandatory: false, publishedAt: 1 }));
    const rel = new Releases(dir, 'pintakids');
    equal(rel.current(), null);
    equal(rel.apk(), null);
    // Publicar en el canal nuevo empieza en 1, sin heredar códigos ajenos.
    const v1 = rel.publish(fakeApk('a'), { versionName: '1.0.0' });
    equal(v1.versionCode, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('escritura atómica: sin .part colgando tras publicar', () => {
  const dir = tempDir();
  try {
    const rel = new Releases(dir, 'pintakids');
    rel.publish(fakeApk('a'), { versionName: '1.0.0' });
    const info = rel.current();
    deepEqual(Object.keys(info!).sort(), ['app', 'mandatory', 'notes', 'publishedAt', 'versionCode', 'versionName']);
    ok(!mkExists(join(dir, 'app.apk.part')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function mkExists(p: string): boolean {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}
