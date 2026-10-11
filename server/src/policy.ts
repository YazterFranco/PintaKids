import type { Action, LatLon, Level, QuakeEvent, Settings, Status } from './types.ts';
import { haversineKm } from './geo.ts';
import { MAJOR_MAG_DELTA, STALE_EVENT_MS } from './config.ts';
import { obj, num } from './json.ts';

export const DEFAULT_SETTINGS: Settings = {
  criticalRegionalMag: 6.0,
  criticalNearMag: 5.0,
  criticalNearKm: 50,
  importantMag: 4.5,
  importantKm: 150,
  informativeMag: 4.0,
  digestMinutes: 30,
  maxImportantPerHour: 3,
};

type NumericKey = Exclude<keyof Settings, 'informativeMag'>;

export const SETTING_RANGES: Record<NumericKey, [number, number]> = {
  criticalRegionalMag: [4, 9],
  criticalNearMag: [3, 9],
  criticalNearKm: [5, 500],
  importantMag: [2, 9],
  importantKm: [10, 1000],
  digestMinutes: [5, 240],
  maxImportantPerHour: [1, 20],
};

export type SettingsResult = { ok: true; value: Settings } | { ok: false; errors: string[] };

/** Valida ajustes parciales contra los rangos del contrato. Campos ausentes = valor base. */
export function validateSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): SettingsResult {
  if (input === undefined) return { ok: true, value: { ...base } };
  const src = obj(input);
  if (!src) return { ok: false, errors: ['settings debe ser un objeto'] };

  const errors: string[] = [];
  const value: Settings = { ...base };
  for (const key of Object.keys(src)) {
    if (!(key in DEFAULT_SETTINGS)) errors.push(`campo desconocido: ${key}`);
  }
  for (const key of Object.keys(SETTING_RANGES) as NumericKey[]) {
    if (!(key in src)) continue;
    const v = num(src[key]);
    const [min, max] = SETTING_RANGES[key];
    if (v === null || v < min || v > max) {
      errors.push(`${key} debe estar entre ${min} y ${max}`);
    } else {
      value[key] = key === 'digestMinutes' || key === 'maxImportantPerHour' ? Math.round(v) : v;
    }
  }
  if ('informativeMag' in src) {
    const v = src.informativeMag;
    if (v === null) value.informativeMag = null;
    else if (num(v) !== null && (v as number) >= 2 && (v as number) <= 9) value.informativeMag = v as number;
    else errors.push('informativeMag debe estar entre 2 y 9, o null para apagarlo');
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export interface Notified {
  level: Level;
  magnitude: number;
  status: Status;
  action: Action;
}

/** Estado de notificaciones por dispositivo. */
export interface DeviceState {
  notified: Record<string, Notified>;
  importantSentAt: number[];
  digestQueue: string[];
  lastDigestAt: number;
}

export function emptyState(now: number): DeviceState {
  return { notified: {}, importantSentAt: [], digestQueue: [], lastDigestAt: now };
}

export interface Decision {
  eventId: string;
  action: Action;
  level: Level;
  correction: boolean;
}

const RANK: Record<Level, number> = { informative: 1, important: 2, critical: 3 };
const ACTION_FOR: Record<Level, Action> = { critical: 'alarm', important: 'notify', informative: 'info' };
const HOUR_MS = 3600_000;

/**
 * Clasifica un sismo para un dispositivo.
 * - critical: mag ≥ criticalRegionalMag en cualquier parte de la zona, o mag ≥ criticalNearMag a ≤ criticalNearKm.
 * - important: mag ≥ importantMag a ≤ importantKm (sin ubicación: solo por magnitud).
 * - informative: mag ≥ informativeMag (va al resumen periódico, no a una notificación individual).
 */
export function classify(e: QuakeEvent, s: Settings, loc?: LatLon): Level | null {
  const d = loc ? haversineKm(loc, e) : null;
  if (e.magnitude >= s.criticalRegionalMag) return 'critical';
  if (d !== null && d <= s.criticalNearKm && e.magnitude >= s.criticalNearMag) return 'critical';
  if (e.magnitude >= s.importantMag && (d === null || d <= s.importantKm)) return 'important';
  if (s.informativeMag !== null && e.magnitude >= s.informativeMag) return 'informative';
  return null;
}

function resolveAction(level: Level, stale: boolean, st: DeviceState, now: number, s: Settings): Action {
  if (stale) return 'info';
  if (level === 'important') {
    st.importantSentAt = st.importantSentAt.filter((t) => now - t < HOUR_MS);
    if (st.importantSentAt.length >= s.maxImportantPerHour) return 'info';
    st.importantSentAt.push(now);
  }
  return ACTION_FOR[level];
}

/**
 * Decide qué enviar para un evento a un dispositivo. Muta el estado.
 * Reglas: nunca se repite un aviso; una corrección solo si la magnitud cambia ≥0.3 o el
 * estado cambia (silencioso); una escalada de nivel siempre notifica; los eventos
 * "viejos" (>30 min) solo informan.
 */
export function decideForEvent(
  e: QuakeEvent,
  s: Settings,
  loc: LatLon | undefined,
  st: DeviceState,
  now: number,
): Decision | null {
  const level = classify(e, s, loc);
  const prev = st.notified[e.id];
  const stale = now - e.originTime > STALE_EVENT_MS;

  if (!prev) {
    if (!level) return null;
    if (level === 'informative' && !stale) {
      st.notified[e.id] = { level, magnitude: e.magnitude, status: e.status, action: 'info' };
      st.digestQueue.push(e.id);
      return null;
    }
    const action = resolveAction(level, stale, st, now, s);
    st.notified[e.id] = { level, magnitude: e.magnitude, status: e.status, action };
    return { eventId: e.id, action, level, correction: false };
  }

  const delta = Math.abs(e.magnitude - prev.magnitude);

  if (!level) {
    // Cayó bajo el umbral: solo se corrige si lo que se avisó difiere de forma relevante.
    if (delta < MAJOR_MAG_DELTA) return null;
    st.notified[e.id] = { ...prev, magnitude: e.magnitude, status: e.status, action: 'update' };
    return { eventId: e.id, action: 'update', level: prev.level, correction: true };
  }

  if (level === 'informative') {
    // Ya en cola de resumen: el resumen usa los datos actuales.
    st.notified[e.id] = { ...prev, magnitude: e.magnitude, status: e.status };
    return null;
  }

  if (RANK[level] > RANK[prev.level]) {
    const action = resolveAction(level, stale, st, now, s);
    st.notified[e.id] = { level, magnitude: e.magnitude, status: e.status, action };
    return { eventId: e.id, action, level, correction: false };
  }

  if (delta >= MAJOR_MAG_DELTA) {
    st.notified[e.id] = { level, magnitude: e.magnitude, status: e.status, action: 'update' };
    return { eventId: e.id, action: 'update', level, correction: true };
  }

  if (e.status !== prev.status) {
    st.notified[e.id] = { level, magnitude: e.magnitude, status: e.status, action: 'silent' };
    return { eventId: e.id, action: 'silent', level, correction: true };
  }
  return null;
}

/** Devuelve los ids pendientes de resumen si toca enviarlo; vacía la cola. */
export function takeDigest(st: DeviceState, s: Settings, now: number): string[] | null {
  if (st.digestQueue.length === 0) return null;
  if (now - st.lastDigestAt < s.digestMinutes * 60_000) return null;
  const ids = st.digestQueue.splice(0);
  st.lastDigestAt = now;
  return ids;
}
