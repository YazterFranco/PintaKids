import { Db } from '../../src/db.ts';
import { Hub, type Conn } from '../../src/hub.ts';
import { Runtime } from '../../src/runtime.ts';
import { LiveFeed } from '../../src/live.ts';
import { createApi } from '../../src/api.ts';
import type { PushData } from '../../src/types.ts';

export const T0 = Date.UTC(2026, 9, 10, 15, 0, 0);
export const MIN = 60_000;

export interface Sent {
  deviceId: string;
  data: PushData;
}

/** Conexión falsa que guarda lo que el servidor escribe al teléfono. */
export function fakeConn(): Conn & { frames: string[] } {
  const frames: string[] = [];
  return {
    frames,
    write: (chunk: string) => {
      frames.push(chunk);
    },
    close: () => {},
  };
}

/** Mundo de prueba: reloj controlable, base en memoria y registro de cada aviso publicado. */
export function makeWorld(opts: { web?: { tickle(endpoint: string): Promise<'ok' | 'gone' | 'error'> } } = {}) {
  const state = { now: T0 };
  const clock = () => state.now;
  const db = new Db(':memory:');
  const hub = new Hub(db);
  const live = new LiveFeed();
  const sent: Sent[] = [];
  const publish = hub.publish.bind(hub);
  hub.publish = (deviceId: string, data: PushData, now: number) => {
    sent.push({ deviceId, data });
    publish(deviceId, data, now);
  };
  const runtime = new Runtime(db, hub, clock, { web: opts.web, live });
  const guide = { version: 1, sections: [] };
  const api = createApi({ db, runtime, hub, guide, adminToken: 'admin-secret', vapidPublicKey: 'vapid-pub-test', live });
  return {
    db,
    hub,
    live,
    runtime,
    api,
    sent,
    advance: (ms: number) => {
      state.now += ms;
    },
    now: clock,
  };
}

export type World = ReturnType<typeof makeWorld>;
