/** Panamá es UTC-5 todo el año (sin horario de verano). */
export const PANAMA_OFFSET_MS = -5 * 3600_000;

/**
 * Convierte fecha y hora locales de Panamá a epoch ms UTC.
 * @param ymd "2026-10-09"
 * @param hms12 "12:56:05PM" | "7:51:44 AM" | "07:51:44" (24 h también aceptado)
 */
export function panamaLocalToEpoch(ymd: string, hms12: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?$/.exec(hms12.trim());
  if (!d || !t) return null;
  let h = Number(t[1]);
  const m = Number(t[2]);
  const s = t[3] ? Number(t[3]) : 0;
  const ampm = t[4]?.[0]?.toLowerCase();
  if (m > 59 || s > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'a') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) {
    return null;
  }
  const utc = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, m, s);
  if (Number.isNaN(utc)) return null;
  return utc - PANAMA_OFFSET_MS;
}

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "hh:mm a. m." en hora de Panamá. */
export function formatPanamaTime(epochMs: number): string {
  const d = new Date(epochMs + PANAMA_OFFSET_MS);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h12}:${mm} ${h24 < 12 ? 'a. m.' : 'p. m.'}`;
}

export function formatPanamaDateTime(epochMs: number): string {
  const d = new Date(epochMs + PANAMA_OFFSET_MS);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}, ${formatPanamaTime(epochMs)}`;
}

/** yyyy-mm-dd de hoy en Panamá. */
export function panamaToday(nowMs: number): string {
  return new Date(nowMs + PANAMA_OFFSET_MS).toISOString().slice(0, 10);
}
