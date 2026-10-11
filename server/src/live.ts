import type { Conn } from './hub.ts';

/** Clientes de la página pública: reciben cada sismo nuevo y el estado de salud en vivo. Sin datos personales. */
export class LiveFeed {
  private readonly conns = new Set<Conn>();

  attach(conn: Conn): void {
    this.conns.add(conn);
  }

  detach(conn: Conn): void {
    this.conns.delete(conn);
  }

  size(): number {
    return this.conns.size;
  }

  broadcast(event: string, data: unknown): void {
    if (this.conns.size === 0) return;
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of [...this.conns]) {
      try {
        c.write(chunk);
      } catch {
        this.conns.delete(c);
      }
    }
  }

  heartbeat(): void {
    for (const c of [...this.conns]) {
      try {
        c.write(': latido\n\n');
      } catch {
        this.conns.delete(c);
      }
    }
  }

  closeAll(): void {
    for (const c of this.conns) c.close();
    this.conns.clear();
  }
}
