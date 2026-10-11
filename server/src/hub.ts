import type { Db } from './db.ts';
import type { PushData } from './types.ts';
import { OUTBOX_TTL_MS } from './config.ts';

/** Conexión abierta de un teléfono (en producción, una respuesta HTTP en modo SSE). */
export interface Conn {
  write(chunk: string): void;
  close(): void;
}

/** Trama SSE: id = id de cola (la app lo confirma con ack), event = push, data = JSON. */
export function frame(outboxId: number, json: string): string {
  return `id: ${outboxId}\nevent: push\ndata: ${json}\n\n`;
}

/**
 * Canal de entrega propio (sustituye a FCM). Cada aviso se guarda en una cola por
 * dispositivo; si el teléfono está conectado llega al instante, si no, se entrega al
 * reconectarse. Un aviso sale de la cola solo cuando el teléfono lo confirma (ack).
 */
export class Hub {
  private readonly db: Db;
  private readonly conns = new Map<string, Set<Conn>>();

  constructor(db: Db) {
    this.db = db;
  }

  isOnline(deviceId: string): boolean {
    return (this.conns.get(deviceId)?.size ?? 0) > 0;
  }

  onlineCount(): number {
    return this.conns.size;
  }

  /** Registra la conexión y reenvía lo pendiente que no caducó. */
  attach(deviceId: string, conn: Conn, now: number): void {
    let set = this.conns.get(deviceId);
    if (!set) {
      set = new Set();
      this.conns.set(deviceId, set);
    }
    set.add(conn);
    for (const row of this.db.pendingFor(deviceId, now - OUTBOX_TTL_MS)) {
      conn.write(frame(row.id, row.json));
    }
  }

  detach(deviceId: string, conn: Conn): void {
    const set = this.conns.get(deviceId);
    if (!set) return;
    set.delete(conn);
    if (set.size === 0) this.conns.delete(deviceId);
  }

  /** Encola el aviso y, si hay conexión, lo envía ahora. */
  publish(deviceId: string, data: PushData, now: number): void {
    const json = JSON.stringify(data);
    const outboxId = this.db.enqueue(deviceId, data.eventId, data.action, json, now);
    for (const c of this.conns.get(deviceId) ?? []) c.write(frame(outboxId, json));
  }

  heartbeat(): void {
    for (const set of this.conns.values()) {
      for (const c of set) c.write(': latido\n\n');
    }
  }

  closeAll(): void {
    for (const set of this.conns.values()) for (const c of set) c.close();
    this.conns.clear();
  }
}
