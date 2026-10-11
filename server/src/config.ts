import { inPanamaRegion } from './geo.ts';
import type { LatLon } from './types.ts';

/** Zona de interés: Panamá y mares/fronteras cercanos. Lo que cae fuera se ignora. */
export const WATCH_BOX = { minLat: 3.0, maxLat: 13.0, minLon: -88.0, maxLon: -74.0 };
export const inWatchArea = (p: LatLon): boolean => inPanamaRegion(p, WATCH_BOX);

/** Un evento visto por primera vez con más de esto de antigüedad se envía solo como info. */
export const STALE_EVENT_MS = 30 * 60_000;
/** Cambio de magnitud que justifica una corrección (update). */
export const MAJOR_MAG_DELTA = 0.3;
/** Si una fuente no responde en este tiempo, se avisa "sin datos". */
export const WATCHDOG_MS = 10 * 60_000;
/** Intervalo de consulta de las fuentes por HTTP (EMSC usa WebSocket). IGC-UP publica de 1 a 3 min después del sismo: cada 20 s es cortesía aceptable. */
export const SOURCE_POLL_MS = { igc: 20_000, usgs: 60_000 } as const;
export const DRILL_COOLDOWN_MS = 60_000;
export const LOCATION_MOVE_KM = 5;
export const LOCATION_MAX_AGE_MS = 6 * 3600_000;
/** Un aviso no entregado en este tiempo caduca (ya no tiene sentido sonar). */
export const OUTBOX_TTL_MS = STALE_EVENT_MS;
/** Latido para mantener vivas las conexiones de la app (y los proxies). */
export const HEARTBEAT_MS = 25_000;
/** Cuánto tiempo se guardan eventos en la base del servidor. */
export const RETENTION_MS = 7 * 86_400_000;
/** Detección de secuencias: una réplica es un sismo menor que sigue a uno mayor cerca y después. */
export const AFTERSHOCK_WINDOW_MS = 24 * 3_600_000;
export const AFTERSHOCK_RADIUS_KM = 200;
/** El principal debe superar a la réplica por al menos esta magnitud. */
export const AFTERSHOCK_MIN_DELTA = 0.5;
