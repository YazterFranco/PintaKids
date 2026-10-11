import type { Observation, PushData, QuakeEvent, LatLon } from './types.ts';
import type { Db, DeviceRow } from './db.ts';
import type { Hub } from './hub.ts';
import type { LiveFeed } from './live.ts';
import type { TickleResult } from './webpush.ts';
import { ingest, prune } from './fusion.ts';
import { decideForEvent, takeDigest } from './policy.ts';
import { quakeMessage, digestMessage, systemMessage } from './messages.ts';
import { publicEvent } from './public.ts';
import { OUTBOX_TTL_MS, RETENTION_MS, WATCHDOG_MS } from './config.ts';

export type SourceName = 'igc' | 'usgs' | 'emsc';

export interface SourceHealth {
  ok: boolean;
  lastOkAt: number | null;
  lastError: string | null;
  lastCount: number;
}

/** Envía el "toque" de Web Push a un navegador suscrito. */
export interface Tickler {
  tickle(endpoint: string): Promise<TickleResult>;
}

export interface RuntimeOptions {
  web?: Tickler;
  live?: LiveFeed;
}

const freshHealth = (): SourceHealth => ({ ok: false, lastOkAt: null, lastError: null, lastCount: 0 });

/** Concurrencia del toque de Web Push: con cientos de navegadores, uno por uno tardaría minutos. */
const TICKLE_CONCURRENCE = 8;

/** Corre tareas asíncronas con un tope de ejecuciones simultáneas; un fallo no detiene a las demás. */
export async function enParalelo<T>(items: T[], limite: number, fn: (x: T) => Promise<unknown>): Promise<void> {
  let i = 0;
  const obreros = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try {
        await fn(items[k]);
      } catch { /* el siguiente toque no depende de este */ }
    }
  });
  await Promise.all(obreros);
}

/** Ubicación de un dispositivo (ya redondeada al guardarse). */
export function deviceLoc(d: DeviceRow): LatLon | undefined {
  return d.lat !== null && d.lon !== null ? { lat: d.lat, lon: d.lon } : undefined;
}

/**
 * Orquesta: observaciones → evento canónico → decisión por dispositivo → cola de entrega.
 * Mantiene la salud de las fuentes, el watchdog de "sin datos" y la página en vivo.
 */
export class Runtime {
  readonly events = new Map<string, QuakeEvent>();
  readonly health: Record<SourceName, SourceHealth>;
  readonly now: () => number;
  private readonly db: Db;
  private readonly hub: Hub;
  private readonly web: Tickler | null;
  private readonly live: LiveFeed | null;
  private readonly startedAt: number;
  private outage = false;

  constructor(db: Db, hub: Hub, now: () => number, opts: RuntimeOptions = {}) {
    this.db = db;
    this.hub = hub;
    this.now = now;
    this.web = opts.web ?? null;
    this.live = opts.live ?? null;
    this.startedAt = now();
    this.health = { igc: freshHealth(), usgs: freshHealth(), emsc: freshHealth() };
    for (const e of db.loadEvents(this.startedAt - RETENTION_MS)) this.events.set(e.id, e);
  }

  markOk(source: SourceName, count: number): void {
    const h = this.health[source];
    h.ok = true;
    h.lastOkAt = this.now();
    h.lastError = null;
    h.lastCount = count;
  }

  markError(source: SourceName, message: string): void {
    const h = this.health[source];
    h.ok = false;
    h.lastError = message.slice(0, 200);
  }

  snapshot(): { ok: boolean; sources: Record<SourceName, SourceHealth> } {
    return { ok: !this.outage, sources: this.health };
  }

  /** Incorpora observaciones, avisa a los dispositivos y a la página en vivo. Devuelve cuántos cambiaron. */
  async ingestObservations(list: Observation[]): Promise<number> {
    const now = this.now();
    let changed = 0;
    for (const o of list) {
      const r = ingest(this.events, o, now);
      if (!r.changed) continue;
      changed++;
      this.db.upsertEvent(r.event);
      this.live?.broadcast('quake', publicEvent(r.event));
      await this.notifyDevices(r.event, now);
    }
    return changed;
  }

  private async notifyDevices(e: QuakeEvent, now: number): Promise<void> {
    const aTocar: DeviceRow[] = [];
    for (const d of this.db.listDevices()) {
      const loc = deviceLoc(d);
      const decision = decideForEvent(e, d.settings, loc, d.state, now);
      this.db.patchDevice(d.id, { state: d.state }, now);
      if (!decision) continue;
      const data = quakeMessage(e, {
        action: decision.action,
        level: decision.level,
        now,
        correction: decision.correction,
        loc,
      });
      if (this.enqueue(d, data, now)) aTocar.push(d);
    }
    // El toque de Web Push es lo único lento (una ida y vuelta por navegador): se hace en paralelo.
    await enParalelo(aTocar, TICKLE_CONCURRENCE, (d) => this.tickleWeb(d));
  }

  /** Registra la entrega (una sola vez por dispositivo/evento/acción) y la publica en el canal vivo. */
  private enqueue(d: DeviceRow, data: PushData, now: number): boolean {
    if (!this.db.recordDelivery(d.id, data.eventId, data.action, now)) return false;
    this.hub.publish(d.id, data, now);
    return true;
  }

  /** Despierta al navegador suscritoy lo borra si la suscripción fue revocada. */
  private async tickleWeb(d: DeviceRow): Promise<void> {
    if (d.kind !== 'web' || !d.pushEndpoint || !this.web) return;
    const r = await this.web.tickle(d.pushEndpoint);
    if (r === 'gone') this.db.deleteDevice(d.id);
  }

  /**
   * Encola un aviso para un dispositivo. Se registra una sola vez por (dispositivo, evento, acción),
   * así nunca se repite aunque el servidor reinicie. Los navegadores además reciben el "toque" de Web Push.
   */
  async dispatchTo(d: DeviceRow, data: PushData): Promise<boolean> {
    const now = this.now();
    if (!this.enqueue(d, data, now)) return false;
    await this.tickleWeb(d);
    return true;
  }

  /** Tareas periódicas: resúmenes, limpieza y watchdog. Llamar cada minuto. */
  async tick(): Promise<void> {
    const now = this.now();
    prune(this.events, now);
    this.db.pruneEvents(now - RETENTION_MS);
    this.db.pruneOutbox(now - OUTBOX_TTL_MS);
    for (const d of this.db.listDevices()) {
      const ids = takeDigest(d.state, d.settings, now);
      this.db.patchDevice(d.id, { state: d.state }, now);
      if (!ids) continue;
      const evs = ids
        .map((id) => this.events.get(id))
        .filter((e): e is QuakeEvent => e !== undefined);
      if (evs.length > 0) await this.dispatchTo(d, digestMessage(evs, now));
    }
    await this.watchdog(now);
  }

  /** Avisa una sola vez al entrar en "sin datos" y otra al recuperarse. */
  private async watchdog(now: number): Promise<void> {
    const lastOk = Math.max(this.startedAt, ...Object.values(this.health).map((h) => h.lastOkAt ?? 0));
    const silent = now - lastOk > WATCHDOG_MS;
    if (silent === this.outage) return;
    this.outage = silent;
    const msg = silent
      ? systemMessage(
          'sin-datos',
          'Sin datos de sismos',
          'Ninguna fuente ha respondido en 10 minutos. La app seguirá intentando; revise su conexión.',
          now,
        )
      : systemMessage('restablecido', 'Datos de sismos restablecidos', 'Las fuentes volvieron a responder.', now);
    for (const d of this.db.listDevices()) await this.dispatchTo(d, msg);
  }
}
