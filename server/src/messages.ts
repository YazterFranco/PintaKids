import type { Action, LatLon, Level, PushData, QuakeEvent } from './types.ts';
import { bearingDeg, bearingName, haversineKm } from './geo.ts';
import { formatPanamaTime } from './time.ts';

const LEVEL_TITLE: Record<Level, string> = {
  critical: 'Sismo fuerte',
  important: 'Sismo importante',
  informative: 'Sismo',
};

export function magText(e: Pick<QuakeEvent, 'magnitude' | 'magMin' | 'magMax'>): string {
  const f = (v: number) => v.toFixed(1);
  if (e.magMin !== e.magMax) return `M${f(e.magMin)}–${f(e.magMax)}`;
  return `M${f(e.magnitude)}`;
}

export interface QuakeMessageOpts {
  action: Action;
  level: Level;
  now: number;
  correction?: boolean;
  drill?: boolean;
  loc?: LatLon;
  previousMag?: number;
}

/** Mensaje push de sismo. El título no lleva "SIMULACRO": la app lo antepone según drill. */
export function quakeMessage(e: QuakeEvent, o: QuakeMessageOpts): PushData {
  const title = o.correction
    ? `Corrección sismo ${magText(e)}`
    : `${LEVEL_TITLE[o.level]} ${magText(e)}`;

  const parts: string[] = [];
  if (o.previousMag !== undefined) parts.push(`Antes: M${o.previousMag.toFixed(1)}`);
  parts.push(e.region);
  parts.push(`${formatPanamaTime(e.originTime)} hora de Panamá`);
  if (e.depthKm !== null) parts.push(`Profundidad ${Math.round(e.depthKm)} km`);
  if (o.loc) {
    const d = haversineKm(o.loc, e);
    parts.push(`A ${Math.round(d)} km ${bearingName(bearingDeg(o.loc, e))} de su ubicación`);
  }
  parts.push(e.status === 'preliminar' ? 'Dato preliminar, puede cambiar' : 'Dato revisado');

  const data: PushData = {
    type: o.drill ? 'drill' : 'quake',
    action: o.action,
    level: o.level,
    eventId: e.id,
    title,
    body: parts.join('. ') + '.',
    mag: e.magnitude.toFixed(1),
    magMin: e.magMin.toFixed(1),
    magMax: e.magMax.toFixed(1),
    status: e.status,
    source: e.source,
    region: e.region,
    lat: String(e.lat),
    lon: String(e.lon),
    originTime: String(e.originTime),
    sentAt: String(o.now),
  };
  if (e.depthKm !== null) data.depthKm = String(e.depthKm);
  if (o.loc) {
    data.distanceKm = String(Math.round(haversineKm(o.loc, e)));
    data.bearing = bearingName(bearingDeg(o.loc, e));
  }
  if (o.drill) data.drill = '1';
  return data;
}

/** Resumen periódico de sismos informativos. */
export function digestMessage(events: QuakeEvent[], now: number): PushData {
  const max = events.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
  return {
    type: 'digest',
    action: 'info',
    level: 'informative',
    eventId: `digest-${now}`,
    title: `Resumen: ${events.length} sismo(s) registrados`,
    body: `Mayor: ${magText(max)} en ${max.region}, ${formatPanamaTime(max.originTime)} hora de Panamá.`,
    sentAt: String(now),
  };
}

/** Aviso del sistema (p. ej. sin datos de fuentes). */
export function systemMessage(kind: string, title: string, body: string, now: number): PushData {
  return {
    type: 'system',
    action: 'info',
    level: 'informative',
    eventId: `system-${kind}-${now}`,
    title,
    body,
    sentAt: String(now),
  };
}
