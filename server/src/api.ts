import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db, DeviceRow, DevicePatch } from './db.ts';
import type { Runtime } from './runtime.ts';
import { deviceLoc } from './runtime.ts';
import type { Hub } from './hub.ts';
import type { LiveFeed } from './live.ts';
import type { QuakeEvent, PushData } from './types.ts';
import { publicEvent } from './public.ts';
import { isAllowedEndpoint } from './webpush.ts';
import { emptyState, validateSettings } from './policy.ts';
import { roundLocation, validCoords } from './geo.ts';
import { quakeMessage } from './messages.ts';
import { DRILL_COOLDOWN_MS, OUTBOX_TTL_MS } from './config.ts';
import { obj, num, str } from './json.ts';

export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  authorization?: string;
  body?: string;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

export interface ApiDeps {
  db: Db;
  runtime: Runtime;
  hub: Hub;
  guide: unknown;
  adminToken?: string;
  /** Llave pública VAPID (base64url) para suscribir navegadores. */
  vapidPublicKey?: string;
  live?: LiveFeed;
}

const MAX_LIMIT = 200;
const DAY_MS = 86_400_000;

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Compara el secreto recibido contra el hash guardado del dispositivo. */
function secretMatches(storedHash: string, secret: string): boolean {
  return timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(sha256Hex(secret), 'hex'));
}

function bearer(header: string | undefined): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return m ? m[1].trim() : null;
}

/** Devuelve el dispositivo si el encabezado Authorization trae su secreto. */
export function authenticateDevice(db: Db, id: string, authorization: string | undefined): DeviceRow | null {
  const device = db.getDevice(id);
  const secret = bearer(authorization);
  if (!device || !secret || !secretMatches(device.secretHash, secret)) return null;
  return device;
}

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(sha256Hex(a), 'hex'), Buffer.from(sha256Hex(b), 'hex'));
}

const err = (status: number, code: string, message: string): ApiResponse => ({
  status,
  body: { error: { code, message } },
});

const ok = (body: unknown): ApiResponse => ({ status: 200, body });

function parseBody(raw: string | undefined): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (raw === undefined || raw.trim() === '') return { ok: true, value: {} };
  try {
    const o = obj(JSON.parse(raw));
    return o ? { ok: true, value: o } : { ok: false };
  } catch {
    return { ok: false };
  }
}

type LocResult = { ok: true; value: { lat: number; lon: number } | null } | { ok: false };

/** location: null (borrar) o {lat, lon}. Se redondea a 0.05° antes de guardar. */
function parseLocation(v: unknown): LocResult {
  if (v === null) return { ok: true, value: null };
  const o = obj(v);
  const lat = num(o?.lat);
  const lon = num(o?.lon);
  if (lat === null || lon === null || !validCoords(lat, lon)) return { ok: false };
  return { ok: true, value: roundLocation({ lat, lon }) };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** Manejador HTTP independiente del transporte (testeable sin sockets). */
export function createApi(deps: ApiDeps): (req: ApiRequest) => Promise<ApiResponse> {
  const { db, runtime, hub } = deps;

  function register(body: string | undefined): ApiResponse {
    const b = parseBody(body);
    if (!b.ok) return err(400, 'JSON_INVALIDO', 'El cuerpo debe ser un objeto JSON.');
    const s = validateSettings(b.value.settings);
    if (!s.ok) return err(400, 'VALIDACION', s.errors.join('; '));
    const loc = b.value.location === undefined ? { ok: true as const, value: null } : parseLocation(b.value.location);
    if (!loc.ok) return err(400, 'VALIDACION', 'location debe ser {lat, lon} válidos o null.');

    const now = runtime.now();
    const id = `d_${randomBytes(9).toString('base64url')}`;
    const secret = randomBytes(32).toString('base64url');
    db.insertDevice({ id, secretHash: sha256Hex(secret), settings: s.value, state: emptyState(now), now });
    if (loc.value) db.patchDevice(id, { location: { ...loc.value, at: now } }, now);
    return { status: 201, body: { deviceId: id, secret, settings: s.value } };
  }

  function update(device: DeviceRow, body: string | undefined): ApiResponse {
    const b = parseBody(body);
    if (!b.ok) return err(400, 'JSON_INVALIDO', 'El cuerpo debe ser un objeto JSON.');
    const patch: DevicePatch = {};
    const now = runtime.now();

    if ('settings' in b.value) {
      const s = validateSettings(b.value.settings, device.settings);
      if (!s.ok) return err(400, 'VALIDACION', s.errors.join('; '));
      patch.settings = s.value;
    }
    if ('location' in b.value) {
      const loc = parseLocation(b.value.location);
      if (!loc.ok) return err(400, 'VALIDACION', 'location debe ser {lat, lon} válidos o null.');
      patch.location = loc.value ? { ...loc.value, at: now } : null;
    }
    db.patchDevice(device.id, patch, now);
    return ok({ settings: patch.settings ?? device.settings });
  }

  async function drill(device: DeviceRow): Promise<ApiResponse> {
    const now = runtime.now();
    const last = db.lastDrillAt(device.id);
    if (last !== null && now - last < DRILL_COOLDOWN_MS) {
      const wait = Math.ceil((DRILL_COOLDOWN_MS - (now - last)) / 1000);
      return err(429, 'DEMASIADOS_SIMULACROS', `Espere ${wait} s antes de otro simulacro.`);
    }
    db.setDrillAt(device.id, now);
    const loc = deviceLoc(device);
    const e: QuakeEvent = {
      id: `drill-${now}-${device.id}`,
      originTime: now,
      lat: loc?.lat ?? 8.98,
      lon: loc?.lon ?? -79.52,
      depthKm: 10,
      magnitude: 6.5,
      magMin: 6.5,
      magMax: 6.5,
      status: 'revisado',
      region: 'Simulacro: sismo de prueba (no es real)',
      source: 'igc',
      updatedAt: now,
      firstSeenAt: now,
      sources: {},
    };
    const data = quakeMessage(e, { action: 'alarm', level: 'critical', now, loc, drill: true });
    await runtime.dispatchTo(device, data);
    // Se encola aunque no haya conexión: llega en cuanto la app se reconecte.
    return { status: 202, body: { sent: true, online: hub.isOnline(device.id) } };
  }

  /** Suscripción de un navegador: la página envía su endpoint de Web Push y recibe credenciales propias. */
  function subscribe(body: string | undefined): ApiResponse {
    const b = parseBody(body);
    if (!b.ok) return err(400, 'JSON_INVALIDO', 'El cuerpo debe ser un objeto JSON.');
    const endpoint = str(b.value.endpoint);
    if (!endpoint || !isAllowedEndpoint(endpoint)) {
      let host = 'endpoint-invalido';
      try {
        host = new URL(endpoint ?? '').host;
      } catch { /* no era una URL */ }
      console.warn(`suscripción rechazada: servicio de push no permitido (${host})`);
      return err(400, 'VALIDACION', 'endpoint debe ser una suscripción HTTPS de un servicio de push conocido.');
    }
    const s = validateSettings(b.value.settings);
    if (!s.ok) return err(400, 'VALIDACION', s.errors.join('; '));
    const loc = b.value.location === undefined ? { ok: true as const, value: null } : parseLocation(b.value.location);
    if (!loc.ok) return err(400, 'VALIDACION', 'location debe ser {lat, lon} válidos o null.');

    // Una suscripción por navegador: si el mismo endpoint se vuelve a suscribir, reemplaza la anterior.
    const previous = db.findByEndpoint(endpoint);
    if (previous) db.deleteDevice(previous);
    const now = runtime.now();
    const id = `w_${randomBytes(9).toString('base64url')}`;
    const secret = randomBytes(32).toString('base64url');
    db.insertDevice({
      id,
      secretHash: sha256Hex(secret),
      settings: s.value,
      state: emptyState(now),
      now,
      kind: 'web',
      pushEndpoint: endpoint,
    });
    if (loc.value) db.patchDevice(id, { location: { ...loc.value, at: now } }, now);
    return { status: 201, body: { deviceId: id, secret, settings: s.value } };
  }

  /** Avisos que el teléfono aún no confirmó. El navegador los pide al despertar con Web Push. */
  function pending(device: DeviceRow): ApiResponse {
    const now = runtime.now();
    const items = db
      .pendingFor(device.id, now - OUTBOX_TTL_MS)
      .map((row) => JSON.parse(row.json) as PushData);
    return ok({ items });
  }

  function ack(device: DeviceRow, body: string | undefined): ApiResponse {
    const b = parseBody(body);
    const eventId = str(b.ok ? b.value.eventId : null);
    const action = str(b.ok ? b.value.action : null);
    const receivedAt = num(b.ok ? b.value.receivedAt : null);
    if (!eventId || !action || receivedAt === null) {
      return err(400, 'VALIDACION', 'Se requieren eventId, action y receivedAt.');
    }
    db.recordAck(device.id, eventId, action, receivedAt, runtime.now());
    db.removeOutbox(device.id, eventId, action);
    return { status: 204 };
  }

  function events(query: URLSearchParams): ApiResponse {
    const raw = Number(query.get('limit') ?? 50);
    const limit = Number.isFinite(raw) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(raw))) : 50;
    const list = [...runtime.events.values()]
      .sort((a, b) => b.originTime - a.originTime)
      .slice(0, limit)
      .map(publicEvent);
    return ok({ events: list, generatedAt: runtime.now() });
  }

  /** "Lo sentí": cualquiera reporta si sintió un evento reciente. La ubicación se redondea antes de guardar. */
  function reportFeel(body: string | undefined): ApiResponse {
    const b = parseBody(body);
    if (!b.ok) return err(400, 'JSON_INVALIDO', 'El cuerpo debe ser un objeto JSON.');
    const eventId = str(b.value.eventId);
    const intensity = num(b.value.intensity);
    const loc = parseLocation(b.value.location);
    if (!eventId || !loc.ok) return err(400, 'VALIDACION', 'Se requieren eventId y location {lat, lon}.');
    if (intensity === null || intensity < 1 || intensity > 3) {
      return err(400, 'VALIDACION', 'intensity debe ser 1 (leve), 2 (fuerte) o 3 (fuertísimo).');
    }
    if (!loc.value) return err(400, 'VALIDACION', 'Hace falta la ubicación para registrar el reporte.');
    const event = runtime.events.get(eventId);
    const now = runtime.now();
    if (!event || now - event.originTime > DAY_MS) {
      return err(404, 'EVENTO_NO_ENCONTRADO', 'El evento no está disponible para reportar.');
    }
    const inserted = db.insertFeel({ eventId, lat: loc.value.lat, lon: loc.value.lon, intensity, at: now });
    return ok({ ok: true, nuevo: inserted, total: db.feelsFor(eventId).total });
  }

  function getFeels(query: URLSearchParams): ApiResponse {
    const eventId = query.get('event');
    if (!eventId) return err(400, 'VALIDACION', 'Falta el parámetro event.');
    return ok(db.feelsFor(eventId));
  }

  /** Totales por día (hora de Panamá) de todos los eventos en memoria, para la gráfica de 7 días. */
  function statsDaily(): ApiResponse {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' });
    const porDia = new Map<string, { total: number; maxMag: number }>();
    for (const e of runtime.events.values()) {
      const dia = fmt.format(new Date(e.originTime));
      const cur = porDia.get(dia) ?? { total: 0, maxMag: 0 };
      cur.total++;
      cur.maxMag = Math.max(cur.maxMag, e.magnitude);
      porDia.set(dia, cur);
    }
    const dias = [...porDia.entries()]
      .map(([dia, v]) => ({ dia, total: v.total, maxMag: Number(v.maxMag.toFixed(1)) }))
      .sort((a, b) => (a.dia < b.dia ? -1 : 1));
    const bins = [
      { banda: 'M2.5-3.9', lo: 2.5, hi: 4, total: 0 },
      { banda: 'M4-4.9', lo: 4, hi: 5, total: 0 },
      { banda: 'M5-5.9', lo: 5, hi: 6, total: 0 },
      { banda: 'M6+', lo: 6, hi: 99, total: 0 },
    ];
    for (const e of runtime.events.values()) {
      const b = bins.find((x) => e.magnitude >= x.lo && e.magnitude < x.hi);
      if (b) b.total++;
    }
    return ok({ dias, bins, generatedAt: runtime.now() });
  }

  function latency(auth: string | undefined): ApiResponse {
    const token = bearer(auth);
    if (!deps.adminToken || !token || !safeEqual(token, deps.adminToken)) {
      return err(401, 'NO_AUTORIZADO', 'Se requiere el token de administración.');
    }
    const now = runtime.now();
    const xs = db.latencies(now - DAY_MS).sort((a, b) => a - b);
    return ok({
      windowHours: 24,
      count: xs.length,
      p50Ms: percentile(xs, 0.5),
      p95Ms: percentile(xs, 0.95),
      maxMs: xs.length ? xs[xs.length - 1] : null,
    });
  }

  return async function handle(req: ApiRequest): Promise<ApiResponse> {
    const path = req.path.replace(/\/+$/, '') || '/';
    try {
      if (req.method === 'GET' && path === '/v1/health') {
        const snap = runtime.snapshot();
        return ok({
          ok: snap.ok,
          now: runtime.now(),
          devicesOnline: hub.onlineCount(),
          viewers: deps.live?.size() ?? 0,
          sources: snap.sources,
        });
      }
      if (req.method === 'GET' && path === '/v1/web/vapid-key') {
        if (!deps.vapidPublicKey) return err(503, 'NO_CONFIGURADO', 'Avisos web no configurados en el servidor.');
        return ok({ publicKey: deps.vapidPublicKey });
      }
      if (req.method === 'POST' && path === '/v1/web/subscriptions') return subscribe(req.body);
      if (req.method === 'GET' && path === '/v1/guide') return ok(deps.guide);
      if (req.method === 'GET' && path === '/v1/events') return events(req.query);
      if (req.method === 'GET' && path === '/v1/stats/daily') return statsDaily();
      if (req.method === 'POST' && path === '/v1/feels') return reportFeel(req.body);
      if (req.method === 'GET' && path === '/v1/feels') return getFeels(req.query);
      if (req.method === 'POST' && path === '/v1/devices') return register(req.body);
      if (req.method === 'GET' && path === '/v1/admin/latency') return latency(req.authorization);

      const m = /^\/v1\/devices\/([A-Za-z0-9_-]+)(\/drill|\/ack|\/pending)?$/.exec(path);
      if (m) {
        const id = m[1];
        const sub = m[2];
        const device = authenticateDevice(db, id, req.authorization);
        if (!device) return err(401, 'NO_AUTORIZADO', 'Dispositivo o secreto inválido.');
        if (!sub && req.method === 'PUT') return update(device, req.body);
        if (!sub && req.method === 'DELETE') {
          db.deleteDevice(id);
          return { status: 204 };
        }
        if (sub === '/drill' && req.method === 'POST') return await drill(device);
        if (sub === '/ack' && req.method === 'POST') return ack(device, req.body);
        if (sub === '/pending' && req.method === 'GET') return pending(device);
      }
      return err(404, 'NO_ENCONTRADO', 'Ruta no encontrada.');
    } catch (e) {
      console.error('api error:', e instanceof Error ? e.message : e);
      return err(500, 'ERROR_INTERNO', 'Error interno del servidor.');
    }
  };
}
