import type { QuakeEvent } from './types.ts';

/** Forma pública de un sismo (sin observaciones por fuente ni datos internos). */
export function publicEvent(e: QuakeEvent) {
  return {
    id: e.id,
    originTime: e.originTime,
    lat: e.lat,
    lon: e.lon,
    depthKm: e.depthKm,
    magnitude: e.magnitude,
    magMin: e.magMin,
    magMax: e.magMax,
    status: e.status,
    region: e.region,
    source: e.source,
    updatedAt: e.updatedAt,
  };
}
