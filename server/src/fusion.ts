import type { Observation, QuakeEvent, Source } from './types.ts';
import { haversineKm } from './geo.ts';
import { RETENTION_MS } from './config.ts';

/** Dos observaciones son el mismo sismo si ocurren en ≤30 s y ≤50 km. */
export const MATCH_WINDOW_MS = 30_000;
export const MATCH_DISTANCE_KM = 50;

/** Fuente principal para los datos canónicos (la local de IGC-UP primero). */
const PRIORITY: Source[] = ['igc', 'usgs', 'emsc'];

export interface IngestResult {
  event: QuakeEvent;
  isNew: boolean;
  changed: boolean;
}

function findMatch(events: Map<string, QuakeEvent>, obs: Observation): QuakeEvent | undefined {
  let best: QuakeEvent | undefined;
  let bestDt = Infinity;
  for (const e of events.values()) {
    const dt = Math.abs(e.originTime - obs.originTime);
    if (dt > MATCH_WINDOW_MS) continue;
    if (haversineKm(e, obs) > MATCH_DISTANCE_KM) continue;
    if (dt < bestDt) {
      best = e;
      bestDt = dt;
    }
  }
  return best;
}

const slug = (s: string): string => s.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);

interface Snapshot {
  magnitude: number;
  magMin: number;
  magMax: number;
  status: string;
  region: string;
  lat: number;
  lon: number;
  depthKm: number | null;
}

function snapshot(e: QuakeEvent): Snapshot {
  return {
    magnitude: e.magnitude,
    magMin: e.magMin,
    magMax: e.magMax,
    status: e.status,
    region: e.region,
    lat: e.lat,
    lon: e.lon,
    depthKm: e.depthKm,
  };
}

function recompute(e: QuakeEvent): void {
  const list = Object.values(e.sources).filter((o): o is Observation => o !== undefined);
  const primary = PRIORITY.map((s) => e.sources[s]).find((o): o is Observation => o !== undefined);
  if (!primary) return;
  e.source = primary.source;
  e.originTime = primary.originTime;
  e.lat = primary.lat;
  e.lon = primary.lon;
  e.depthKm = primary.depthKm;
  e.magnitude = primary.magnitude;
  e.region = primary.region;
  e.magMin = Math.min(...list.map((o) => o.magnitude));
  e.magMax = Math.max(...list.map((o) => o.magnitude));
  // Basta que una fuente lo marque como revisado para que el estado sea revisado.
  e.status = list.some((o) => o.status === 'revisado') ? 'revisado' : 'preliminar';
}

/** Incorpora una observación: crea un evento nuevo o la fusiona con uno existente. */
export function ingest(events: Map<string, QuakeEvent>, obs: Observation, now: number): IngestResult {
  const match = findMatch(events, obs);
  if (!match) {
    const sources: QuakeEvent['sources'] = {};
    sources[obs.source] = obs;
    const event: QuakeEvent = {
      id: `q-${Math.floor(obs.originTime / 1000)}-${obs.source}-${slug(obs.sourceId)}`,
      originTime: obs.originTime,
      lat: obs.lat,
      lon: obs.lon,
      depthKm: obs.depthKm,
      magnitude: obs.magnitude,
      magMin: obs.magnitude,
      magMax: obs.magnitude,
      status: obs.status,
      region: obs.region,
      source: obs.source,
      updatedAt: now,
      firstSeenAt: now,
      sources,
    };
    events.set(event.id, event);
    return { event, isNew: true, changed: true };
  }

  const before = JSON.stringify(snapshot(match));
  match.sources[obs.source] = obs;
  recompute(match);
  const changed = JSON.stringify(snapshot(match)) !== before;
  if (changed) match.updatedAt = now;
  return { event: match, isNew: false, changed };
}

/** Elimina eventos más antiguos que la retención. */
export function prune(events: Map<string, QuakeEvent>, now: number): number {
  let removed = 0;
  for (const [id, e] of events) {
    if (now - e.originTime > RETENTION_MS) {
      events.delete(id);
      removed++;
    }
  }
  return removed;
}
