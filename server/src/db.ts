import { DatabaseSync } from 'node:sqlite';
import type { QuakeEvent, Settings } from './types.ts';
import type { DeviceState } from './policy.ts';

export interface DeviceRow {
  id: string;
  secretHash: string;
  /** 'app' = teléfono con la app nativa; 'web' = navegador suscrito con Web Push. */
  kind: 'app' | 'web';
  pushEndpoint: string | null;
  settings: Settings;
  state: DeviceState;
  lat: number | null;
  lon: number | null;
  locationAt: number | null;
  createdAt: number;
  lastSeenAt: number;
}

export interface Location {
  lat: number;
  lon: number;
  at: number;
}

/** Campos que se pueden cambiar; los omitidos no se tocan. `location: null` borra la ubicación. */
export interface DevicePatch {
  settings?: Settings;
  state?: DeviceState;
  location?: Location | null;
}

export interface OutboxRow {
  id: number;
  json: string;
}

interface RawDevice {
  id: string;
  secret_hash: string;
  kind: string;
  push_endpoint: string | null;
  settings_json: string;
  state_json: string;
  lat: number | null;
  lon: number | null;
  location_at: number | null;
  created_at: number;
  last_seen_at: number;
}

const toDevice = (r: RawDevice): DeviceRow => ({
  id: r.id,
  secretHash: r.secret_hash,
  kind: r.kind === 'web' ? 'web' : 'app',
  pushEndpoint: r.push_endpoint,
  settings: JSON.parse(r.settings_json) as Settings,
  state: JSON.parse(r.state_json) as DeviceState,
  lat: r.lat,
  lon: r.lon,
  locationAt: r.location_at,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
});

/** Persistencia en SQLite (node:sqlite, integrado en Node 22). */
export class Db {
  private readonly sql: DatabaseSync;

  constructor(path: string) {
    this.sql = new DatabaseSync(path);
    this.sql.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        secret_hash TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'app',
        push_endpoint TEXT,
        settings_json TEXT NOT NULL,
        state_json TEXT NOT NULL,
        lat REAL,
        lon REAL,
        location_at INTEGER,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        origin_time INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_origin ON events(origin_time);
      CREATE TABLE IF NOT EXISTS deliveries (
        device_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        action TEXT NOT NULL,
        sent_at INTEGER NOT NULL,
        received_at INTEGER,
        acked_at INTEGER,
        PRIMARY KEY (device_id, event_id, action)
      );
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        action TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outbox_device ON outbox(device_id, id);
      CREATE TABLE IF NOT EXISTS drills (
        device_id TEXT PRIMARY KEY,
        at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feels (
        event_id TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        intensity INTEGER NOT NULL,
        at INTEGER NOT NULL,
        PRIMARY KEY (event_id, lat, lon)
      );
    `);
  }

  close(): void {
    this.sql.close();
  }

  insertDevice(d: {
    id: string;
    secretHash: string;
    settings: Settings;
    state: DeviceState;
    now: number;
    kind?: 'app' | 'web';
    pushEndpoint?: string | null;
  }): void {
    this.sql
      .prepare(
        'INSERT INTO devices (id, secret_hash, kind, push_endpoint, settings_json, state_json, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        d.id,
        d.secretHash,
        d.kind ?? 'app',
        d.pushEndpoint ?? null,
        JSON.stringify(d.settings),
        JSON.stringify(d.state),
        d.now,
        d.now,
      );
  }

  /** Id del dispositivo web que tiene esa suscripción, si existe. */
  findByEndpoint(endpoint: string): string | null {
    const r = this.sql.prepare('SELECT id FROM devices WHERE push_endpoint = ?').get(endpoint) as unknown as { id: string } | undefined;
    return r ? r.id : null;
  }

  getDevice(id: string): DeviceRow | null {
    const r = this.sql.prepare('SELECT * FROM devices WHERE id = ?').get(id) as unknown as RawDevice | undefined;
    return r ? toDevice(r) : null;
  }

  listDevices(): DeviceRow[] {
    return (this.sql.prepare('SELECT * FROM devices').all() as unknown as RawDevice[]).map(toDevice);
  }

  patchDevice(id: string, p: DevicePatch, now: number): void {
    const cur = this.getDevice(id);
    if (!cur) return;
    let lat: number | null = cur.lat;
    let lon: number | null = cur.lon;
    let at: number | null = cur.locationAt;
    if (p.location === null) {
      lat = null;
      lon = null;
      at = null;
    } else if (p.location) {
      lat = p.location.lat;
      lon = p.location.lon;
      at = p.location.at;
    }
    this.sql
      .prepare('UPDATE devices SET settings_json = ?, state_json = ?, lat = ?, lon = ?, location_at = ?, last_seen_at = ? WHERE id = ?')
      .run(JSON.stringify(p.settings ?? cur.settings), JSON.stringify(p.state ?? cur.state), lat, lon, at, now, id);
  }

  deleteDevice(id: string): void {
    this.sql.prepare('DELETE FROM deliveries WHERE device_id = ?').run(id);
    this.sql.prepare('DELETE FROM outbox WHERE device_id = ?').run(id);
    this.sql.prepare('DELETE FROM drills WHERE device_id = ?').run(id);
    this.sql.prepare('DELETE FROM devices WHERE id = ?').run(id);
  }

  /** true si es la primera vez: impide reenviar el mismo aviso aunque el servidor reinicie. */
  recordDelivery(deviceId: string, eventId: string, action: string, sentAt: number): boolean {
    const r = this.sql
      .prepare('INSERT OR IGNORE INTO deliveries (device_id, event_id, action, sent_at) VALUES (?, ?, ?, ?)')
      .run(deviceId, eventId, action, sentAt);
    return Number(r.changes) === 1;
  }

  /** Guarda el aviso hasta que el teléfono lo confirme. Devuelve su id de cola. */
  enqueue(deviceId: string, eventId: string, action: string, json: string, now: number): number {
    const r = this.sql
      .prepare('INSERT INTO outbox (device_id, event_id, action, json, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(deviceId, eventId, action, json, now);
    return Number(r.lastInsertRowid);
  }

  pendingFor(deviceId: string, notBefore: number): OutboxRow[] {
    return this.sql
      .prepare('SELECT id, json FROM outbox WHERE device_id = ? AND created_at >= ? ORDER BY id')
      .all(deviceId, notBefore) as unknown as OutboxRow[];
  }

  removeOutbox(deviceId: string, eventId: string, action: string): number {
    const r = this.sql
      .prepare('DELETE FROM outbox WHERE device_id = ? AND event_id = ? AND action = ?')
      .run(deviceId, eventId, action);
    return Number(r.changes);
  }

  pruneOutbox(before: number): number {
    return Number(this.sql.prepare('DELETE FROM outbox WHERE created_at < ?').run(before).changes);
  }

  recordAck(deviceId: string, eventId: string, action: string, receivedAt: number, ackAt: number): boolean {
    const r = this.sql
      .prepare('UPDATE deliveries SET received_at = ?, acked_at = ? WHERE device_id = ? AND event_id = ? AND action = ?')
      .run(receivedAt, ackAt, deviceId, eventId, action);
    return Number(r.changes) === 1;
  }

  /** Latencias (ms) entre envío del servidor y recepción reportada por el teléfono. */
  latencies(since: number): number[] {
    const rows = this.sql
      .prepare('SELECT received_at - sent_at AS ms FROM deliveries WHERE received_at IS NOT NULL AND sent_at >= ?')
      .all(since) as unknown as Array<{ ms: number }>;
    return rows.map((r) => Number(r.ms));
  }

  lastDrillAt(deviceId: string): number | null {
    const r = this.sql.prepare('SELECT at FROM drills WHERE device_id = ?').get(deviceId) as unknown as { at: number } | undefined;
    return r ? r.at : null;
  }

  setDrillAt(deviceId: string, at: number): void {
    this.sql
      .prepare('INSERT INTO drills (device_id, at) VALUES (?, ?) ON CONFLICT(device_id) DO UPDATE SET at = excluded.at')
      .run(deviceId, at);
  }

  upsertEvent(e: QuakeEvent): void {
    this.sql
      .prepare(
        'INSERT INTO events (id, origin_time, updated_at, json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET origin_time = excluded.origin_time, updated_at = excluded.updated_at, json = excluded.json',
      )
      .run(e.id, e.originTime, e.updatedAt, JSON.stringify(e));
  }

  loadEvents(minOriginTime: number): QuakeEvent[] {
    const rows = this.sql
      .prepare('SELECT json FROM events WHERE origin_time >= ?')
      .all(minOriginTime) as unknown as Array<{ json: string }>;
    return rows.map((r) => JSON.parse(r.json) as QuakeEvent);
  }

  pruneEvents(beforeOriginTime: number): number {
    return Number(this.sql.prepare('DELETE FROM events WHERE origin_time < ?').run(beforeOriginTime).changes);
  }

  /** Registra "lo sentí". Uno por evento y por celda de ubicación (redondeada); repeticiones se ignoran. */
  insertFeel(f: { eventId: string; lat: number; lon: number; intensity: number; at: number }): boolean {
    return Number(
      this.sql
        .prepare('INSERT OR IGNORE INTO feels (event_id, lat, lon, intensity, at) VALUES (?, ?, ?, ?, ?)')
        .run(f.eventId, f.lat, f.lon, f.intensity, f.at).changes,
    ) > 0;
  }

  /** Total y conteo por intensidad (1 leve, 2 fuerte, 3 fuertísimo) de los reportes de un evento. */
  feelsFor(eventId: string): { total: number; counts: number[] } {
    const rows = this.sql
      .prepare('SELECT intensity, COUNT(*) AS n FROM feels WHERE event_id = ? GROUP BY intensity')
      .all(eventId) as unknown as Array<{ intensity: number; n: number }>;
    const counts = [0, 0, 0];
    let total = 0;
    for (const r of rows) {
      if (r.intensity >= 1 && r.intensity <= 3) counts[r.intensity - 1] = r.n;
      total += r.n;
    }
    return { total, counts };
  }

  pruneFeels(before: number): number {
    return Number(this.sql.prepare('DELETE FROM feels WHERE at < ?').run(before).changes);
  }
}
