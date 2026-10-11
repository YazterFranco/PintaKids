import { createPrivateKey, createPublicKey, createSign, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/*
 * Web Push sin librerías (RFC 8292 VAPID). El aviso va VACÍO: solo despierta al navegador,
 * que luego pide los avisos pendientes a nuestro servidor (así no hace falta cifrar el contenido).
 */

export interface Vapid {
  publicKey: string; // punto P-256 sin comprimir, base64url (lo usa el navegador)
  privateKey: string; // escalar d, base64url
  x: string;
  y: string;
}

export function createVapid(): Vapid {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' }) as { x: string; y: string; d: string };
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
  return { publicKey: raw.toString('base64url'), privateKey: jwk.d, x: jwk.x, y: jwk.y };
}

/** Carga las llaves del archivo; si no existe, las crea (permisos 600). */
export function loadOrCreateVapid(path: string): Vapid {
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as Vapid;
  const v = createVapid();
  writeFileSync(path, JSON.stringify(v), { mode: 0o600 });
  return v;
}

/** JWT ES256 que identifica al servidor ante el servicio de push del navegador. */
export function vapidJwt(v: Vapid, audience: string, nowSec: number, subject: string): string {
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ aud: audience, exp: nowSec + 12 * 3600, sub: subject })).toString('base64url');
  const input = `${header}.${claims}`;
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: v.x, y: v.y, d: v.privateKey }, format: 'jwk' });
  const sig = createSign('SHA256').update(input).sign({ key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${sig.toString('base64url')}`;
}

export function publicKeyOf(v: Vapid) {
  return createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: v.x, y: v.y }, format: 'jwk' });
}

export function audienceOf(endpoint: string): string {
  const u = new URL(endpoint);
  return `${u.protocol}//${u.host}`;
}

/** Solo se aceptan servicios de push conocidos: evita que el servidor llame a URLs arbitrarias (SSRF). */
const ALLOWED_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
  /^update\.googleapis\.com$/, // Chrome/Chromium de escritorio (Mac, Windows, Linux)
];

export function isAllowedEndpoint(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && ALLOWED_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

export type TickleResult = 'ok' | 'gone' | 'error';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export class WebPushSender {
  private readonly v: Vapid;
  private readonly subject: string;
  private readonly fetchFn: FetchFn;
  private readonly clock: () => number;

  constructor(v: Vapid, subject: string, fetchFn: FetchFn = (u, i) => fetch(u, i), clock: () => number = () => Date.now()) {
    this.v = v;
    this.subject = subject;
    this.fetchFn = fetchFn;
    this.clock = clock;
  }

  /** Envía el aviso vacío. 404/410 = la suscripción ya no existe. */
  async tickle(endpoint: string): Promise<TickleResult> {
    try {
      const jwt = vapidJwt(this.v, audienceOf(endpoint), Math.floor(this.clock() / 1000), this.subject);
      const res = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          TTL: '600',
          Urgency: 'high',
          Authorization: `vapid t=${jwt}, k=${this.v.publicKey}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 404 || res.status === 410) return 'gone';
      return res.ok ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
