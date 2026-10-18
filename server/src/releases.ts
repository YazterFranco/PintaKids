import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Canal de distribución de la app (heredado de SismoPA, adaptado): el servidor guarda la última APK
 * y su metadatos en /data/releases (volumen persistente). CI sube versiones con ADMIN_TOKEN.
 *
 * La marca `app` (p. ej. "pintakids") AÍSLA el canal: si el volumen conserva una versión de otra app
 * (Alerta Sísmica), current() la ignora y jamás se sirve a clientes equivocados.
 */

export interface ReleaseInfo {
  app: string;
  versionCode: number;
  versionName: string;
  notes: string;
  mandatory: boolean;
  publishedAt: number;
}

export const MAX_APK_BYTES = 40 * 1024 * 1024;

export class Releases {
  readonly dir: string;
  readonly channel: string;

  constructor(dir: string, channel: string) {
    this.dir = dir;
    this.channel = channel;
  }

  private get infoPath(): string { return join(this.dir, 'version.json'); }
  private get apkPath(): string { return join(this.dir, 'app.apk'); }

  current(): ReleaseInfo | null {
    try {
      if (!existsSync(this.infoPath)) return null;
      const o = JSON.parse(readFileSync(this.infoPath, 'utf8')) as ReleaseInfo;
      // Canal incorrecto (p. ej. restos de la app de sismos) → tratar como "sin versión".
      if (o.app !== this.channel) return null;
      return typeof o.versionCode === 'number' ? o : null;
    } catch {
      return null;
    }
  }

  /** Publica una APK. Valida que sea un ZIP real (los APK lo son) y auto-incrementa si no se indica código. */
  publish(body: Buffer, meta: { versionCode?: number; versionName?: string; notes?: string; mandatory?: boolean }): ReleaseInfo {
    if (body.length < 1024 || body[0] !== 0x50 || body[1] !== 0x4b) throw new Error('no-es-apk');
    if (body.length > MAX_APK_BYTES) throw new Error('demasiado-grande');
    mkdirSync(this.dir, { recursive: true });
    const prev = this.current();
    const versionCode = meta.versionCode ?? (prev ? prev.versionCode + 1 : 1);
    if (prev && versionCode <= prev.versionCode) throw new Error('version-no-mayor');
    const info: ReleaseInfo = {
      app: this.channel,
      versionCode,
      versionName: meta.versionName ?? String(versionCode),
      notes: meta.notes ?? '',
      mandatory: Boolean(meta.mandatory),
      publishedAt: Date.now(),
    };
    // Escrita atómica: si se cae el proceso a mitad, la versión anterior sigue intacta.
    writeFileSync(this.apkPath + '.part', body);
    renameSync(this.apkPath + '.part', this.apkPath);
    writeFileSync(this.infoPath, JSON.stringify(info));
    return info;
  }

  apk(): Buffer | null {
    try {
      return existsSync(this.apkPath) ? readFileSync(this.apkPath) : null;
    } catch {
      return null;
    }
  }
}
