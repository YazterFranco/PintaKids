import type { Observation } from './types.ts';
import type { Runtime, SourceName } from './runtime.ts';
import { parseEmscMessage } from './sources/emsc.ts';

/** Identificación honesta ante las fuentes: quién consulta y con qué frecuencia. */
export const USER_AGENT = 'AlertaSismicaPA/1.0 (uso no comercial; consultas cada 20-60 s)';

export interface ParsedFeed {
  observations: Observation[];
  warnings?: string[];
}

export interface PollOptions {
  name: SourceName;
  url: string;
  runtime: Runtime;
  parse: (text: string, now: number) => ParsedFeed;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}

/** Una consulta: si la fuente falla o su formato cambió, queda marcada en error (nunca inventa datos). */
export async function pollOnce(o: PollOptions): Promise<void> {
  const fetchFn = o.fetchFn ?? ((u: string, i?: RequestInit) => fetch(u, i));
  try {
    const res = await fetchFn(o.url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/json;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = o.parse(await res.text(), o.runtime.now());
    if (parsed.warnings && parsed.warnings.length > 0) throw new Error(parsed.warnings[0]);
    await o.runtime.ingestObservations(parsed.observations);
    o.runtime.markOk(o.name, parsed.observations.length);
  } catch (e) {
    o.runtime.markError(o.name, e instanceof Error ? e.message : 'error desconocido');
  }
}

/** Sondeo periódico con reintento en el siguiente intervalo. */
export function startHttpPoller(o: PollOptions & { intervalMs: number }): { stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const loop = async (): Promise<void> => {
    await pollOnce(o);
    if (!stopped) timer = setTimeout(() => void loop(), o.intervalMs);
  };
  void loop();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

export interface SocketOptions {
  url: string;
  runtime: Runtime;
  WebSocketImpl?: typeof WebSocket;
}

/** EMSC en tiempo casi real por WebSocket, con reconexión exponencial (máx. 60 s). */
export function startEmscSocket(o: SocketOptions): { stop: () => void } {
  const Impl = o.WebSocketImpl ?? WebSocket;
  let stopped = false;
  let backoff = 1000;
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const handle = async (text: string): Promise<void> => {
    try {
      const r = parseEmscMessage(text, o.runtime.now());
      if (r.observation && (r.action === 'create' || r.action === 'update')) {
        await o.runtime.ingestObservations([r.observation]);
      }
      o.runtime.markOk('emsc', r.observation ? 1 : 0);
    } catch {
      o.runtime.markError('emsc', 'mensaje inválido del WebSocket');
    }
  };

  const connect = (): void => {
    socket = new Impl(o.url);
    socket.onmessage = (ev: MessageEvent) => void handle(String(ev.data));
    socket.onerror = () => o.runtime.markError('emsc', 'error de conexión WebSocket');
    socket.onclose = () => {
      if (stopped) return;
      o.runtime.markError('emsc', 'conexión cerrada; reintentando');
      timer = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 60_000);
    };
    socket.onopen = () => {
      backoff = 1000;
    };
  };

  connect();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    },
  };
}
