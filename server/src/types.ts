export type Source = 'igc' | 'usgs' | 'emsc';
export type Status = 'preliminar' | 'revisado';
export type Level = 'critical' | 'important' | 'informative';
export type Action = 'alarm' | 'notify' | 'update' | 'info' | 'silent';

/** Observación cruda tal como la reporta una fuente (antes de fusionar). */
export interface Observation {
  source: Source;
  /** id de la fuente (ej. id USGS, unid EMSC, o clave sintética IGC) */
  sourceId: string;
  originTime: number; // epoch ms UTC
  lat: number;
  lon: number;
  depthKm: number | null;
  magnitude: number;
  magMin?: number;
  magMax?: number;
  status: Status;
  region: string;
  observedAt: number; // cuándo la vio nuestro servidor
}

/** Evento canónico (fusionado). */
export interface QuakeEvent {
  id: string;
  originTime: number;
  lat: number;
  lon: number;
  depthKm: number | null;
  magnitude: number;
  magMin: number;
  magMax: number;
  status: Status;
  region: string;
  source: Source;
  updatedAt: number;
  firstSeenAt: number;
  /** Si este sismo es una réplica, id del sismo principal dentro de la misma secuencia. */
  aftershockOf?: string;
  /** observaciones por fuente, para auditoría */
  sources: Partial<Record<Source, Observation>>;
}

export interface Settings {
  criticalRegionalMag: number;
  criticalNearMag: number;
  criticalNearKm: number;
  importantMag: number;
  importantKm: number;
  informativeMag: number | null;
  digestMinutes: number;
  maxImportantPerHour: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface PushData {
  [k: string]: string;
}
