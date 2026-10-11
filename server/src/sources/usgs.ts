import type { Observation } from '../types.ts';
import { validCoords } from '../geo.ts';
import { inWatchArea } from '../config.ts';
import { obj, num, str } from '../json.ts';

/** Feed GeoJSON de USGS (p. ej. all_hour / 2.5_day). Coordenadas: [lon, lat, profundidad]. */
export function usgsFeature(raw: unknown, observedAt: number): Observation | null {
  const f = obj(raw);
  const p = obj(f?.properties);
  const g = obj(f?.geometry);
  const rawCoords = g?.coordinates;
  const coords = Array.isArray(rawCoords) ? rawCoords : null;

  const magnitude = num(p?.mag);
  const originTime = num(p?.time);
  const lon = num(coords?.[0]);
  const lat = num(coords?.[1]);
  const depth = num(coords?.[2]);
  const sourceId = str(f?.id);
  if (magnitude === null || originTime === null || lon === null || lat === null || !sourceId || !validCoords(lat, lon)) {
    return null;
  }
  return {
    source: 'usgs',
    sourceId,
    originTime,
    lat,
    lon,
    depthKm: depth,
    magnitude,
    status: str(p?.status) === 'reviewed' ? 'revisado' : 'preliminar',
    region: str(p?.place) ?? 'Sin descripción',
    observedAt,
  };
}

export interface FeedParseResult {
  observations: Observation[];
  skipped: number;
}

export function parseUsgsFeed(json: unknown, observedAt: number): FeedParseResult {
  const features = obj(json)?.features;
  if (!Array.isArray(features)) throw new Error('USGS: respuesta sin "features"');
  const observations: Observation[] = [];
  let skipped = 0;
  for (const raw of features) {
    const o = usgsFeature(raw, observedAt);
    if (o && inWatchArea(o)) observations.push(o);
    else skipped++;
  }
  return { observations, skipped };
}
