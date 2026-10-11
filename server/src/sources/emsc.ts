import type { Observation } from '../types.ts';
import { validCoords } from '../geo.ts';
import { inWatchArea } from '../config.ts';
import { num, obj, str } from '../json.ts';

/** Acepta fechas ISO con o sin zona; sin zona se asume UTC. */
function parseIsoUtc(t: string): number {
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(t) ? t : `${t}Z`;
  return Date.parse(withZone);
}

/**
 * Feature de EMSC (FDSN o WebSocket). Coordenadas: [lon, lat, -profundidad].
 * EMSC publica datos preliminares; siempre se marcan como 'preliminar'.
 */
export function emscFeature(raw: unknown, observedAt: number): Observation | null {
  const f = obj(raw);
  const p = obj(f?.properties);
  const g = obj(f?.geometry);
  const rawCoords = g?.coordinates;
  const c = Array.isArray(rawCoords) ? rawCoords : null;

  const lon = num(p?.lon) ?? num(c?.[0]);
  const lat = num(p?.lat) ?? num(c?.[1]);
  const cz = num(c?.[2]);
  const depth = num(p?.depth) ?? (cz === null ? null : Math.abs(cz));
  const t = str(p?.time);
  const originTime = t ? parseIsoUtc(t) : NaN;
  const magnitude = num(p?.mag);
  const sourceId = str(p?.unid) ?? str(f?.id);

  if (!sourceId || !Number.isFinite(originTime) || magnitude === null || lat === null || lon === null || !validCoords(lat, lon)) {
    return null;
  }
  return {
    source: 'emsc',
    sourceId,
    originTime,
    lat,
    lon,
    depthKm: depth,
    magnitude,
    status: 'preliminar',
    region: str(p?.flynn_region) ?? str(p?.region) ?? 'Sin descripción',
    observedAt,
  };
}

export function parseEmscFdsn(json: unknown, observedAt: number): { observations: Observation[]; skipped: number } {
  const features = obj(json)?.features;
  if (!Array.isArray(features)) throw new Error('EMSC: respuesta sin "features"');
  const observations: Observation[] = [];
  let skipped = 0;
  for (const raw of features) {
    const o = emscFeature(raw, observedAt);
    if (o && inWatchArea(o)) observations.push(o);
    else skipped++;
  }
  return { observations, skipped };
}

/** Mensaje del WebSocket: { action: 'create' | 'update' | 'delete', data: Feature }. */
export function parseEmscMessage(text: string, observedAt: number): { action: string; observation: Observation | null } {
  const msg = obj(JSON.parse(text));
  const action = str(msg?.action) ?? 'unknown';
  const o = emscFeature(msg?.data, observedAt);
  return { action, observation: o && inWatchArea(o) ? o : null };
}
