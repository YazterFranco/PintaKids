import type { Observation, Status } from '../types.ts';
import { panamaLocalToEpoch } from '../time.ts';
import { validCoords } from '../geo.ts';

/*
 * Parser de la tabla pública de IGC-UP (sismosgeociencias.up.ac.pa).
 * Limitación conocida: el HTML real no se pudo descargar desde el entorno de generación.
 * El parser localiza columnas por ENCABEZADO (Fecha, Hora, Latitud, Longitud, Magnitud, ...).
 * Si no encuentra encabezados, NO inventa datos: devuelve un aviso que el poller
 * marca como fuente en error. Validar con una captura real antes de producción.
 */

export interface IgcParseResult {
  observations: Observation[];
  skipped: number;
  warnings: string[];
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', nbsp: ' ', quot: '"', lt: '<', gt: '>', deg: '°', ordm: 'º',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name] ?? m);
}

export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface TableRow {
  cells: string[];
  hrefs: string[];
}

export function parseTableRows(html: string): TableRow[] {
  const rows: TableRow[] = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const body = tr[1];
    const cells = [...body.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => htmlToText(m[1]));
    const hrefs = [...body.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1]));
    if (cells.length > 0) rows.push({ cells, hrefs });
  }
  return rows;
}

type Field = 'date' | 'time' | 'lat' | 'lon' | 'depth' | 'mag' | 'region' | 'status';

const HEADER_RULES: Array<[Field, RegExp]> = [
  ['date', /^fecha/],
  ['time', /^hora/],
  ['lat', /^latitud|^lat$/],
  ['lon', /^longitud|^lon$|^long$/],
  ['depth', /^profundidad|^prof/],
  ['mag', /^magnitud|^mag/],
  ['region', /region|ubicacion|localizacion|lugar/],
  ['status', /^estado|^status|^tipo/],
];

export interface FieldMap {
  headerIndex: number;
  columns: Partial<Record<Field, number>>;
}

export function findFieldMap(rows: TableRow[]): FieldMap | null {
  for (let r = 0; r < rows.length; r++) {
    const columns: Partial<Record<Field, number>> = {};
    rows[r].cells.forEach((cell, idx) => {
      const text = normalize(cell);
      for (const [field, re] of HEADER_RULES) {
        if (columns[field] === undefined && re.test(text)) {
          columns[field] = idx;
          break;
        }
      }
    });
    const required: Field[] = ['date', 'time', 'lat', 'lon', 'mag'];
    if (required.every((f) => columns[f] !== undefined)) return { headerIndex: r, columns };
  }
  return null;
}

/** Acepta 2026-10-09 o 09/10/2026 (día/mes/año). */
export function parseDate(text: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return null;
}

function parseNum(text: string): number {
  const m = /-?\d+(?:[.,]\d+)?/.exec(text);
  return m ? Number(m[0].replace(',', '.')) : NaN;
}

/** Coordenadas con letra de hemisferio (N/S/E/W/O) o con signo. */
export function parseCoord(text: string, field: 'lat' | 'lon'): number {
  let v = parseNum(text);
  if (!Number.isFinite(v)) return NaN;
  const hemi = /(?:^|[\s\d°])([NSEWO])\b/i.exec(text)?.[1]?.toUpperCase();
  if (hemi === 'S' || hemi === 'W' || hemi === 'O') v = -Math.abs(v);
  else if (hemi === 'N' || hemi === 'E') v = Math.abs(v);
  // Panamá está al oeste de Greenwich: una longitud positiva sin hemisferio se interpreta como oeste.
  else if (field === 'lon' && v > 0) v = -v;
  return v;
}

export function parseIgcHtml(html: string, observedAt: number): IgcParseResult {
  const rows = parseTableRows(html);
  const found = findFieldMap(rows);
  if (!found) {
    return {
      observations: [],
      skipped: 0,
      warnings: ['IGC-UP: no se encontró la tabla de sismos (encabezados esperados: Fecha, Hora, Latitud, Longitud, Magnitud).'],
    };
  }
  const { headerIndex, columns } = found;
  const cell = (cells: string[], f: Field): string => {
    const i = columns[f];
    return i === undefined ? '' : (cells[i] ?? '');
  };

  const byId = new Map<string, Observation>();
  let skipped = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const ymd = parseDate(cell(row.cells, 'date'));
    const hms = cell(row.cells, 'time');
    const originTime = ymd ? panamaLocalToEpoch(ymd, hms) : null;
    const lat = parseCoord(cell(row.cells, 'lat'), 'lat');
    const lon = parseCoord(cell(row.cells, 'lon'), 'lon');
    const magnitude = parseNum(cell(row.cells, 'mag'));
    if (originTime === null || !validCoords(lat, lon) || !Number.isFinite(magnitude) || magnitude < 0 || magnitude > 10) {
      skipped++;
      continue;
    }
    const depth = parseNum(cell(row.cells, 'depth'));
    const statusText = normalize(cell(row.cells, 'status') || row.cells.join(' '));
    const status: Status = statusText.includes('revis') ? 'revisado' : 'preliminar';
    // Clave estable: misma fecha/hora/ubicación = mismo sismo (IGC repite filas a veces).
    const sourceId = `${ymd}T${hms.replace(/\s+/g, '')}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    byId.set(sourceId, {
      source: 'igc',
      sourceId,
      originTime,
      lat,
      lon,
      depthKm: Number.isFinite(depth) ? depth : null,
      magnitude,
      status,
      region: cell(row.cells, 'region') || 'Panamá (IGC-UP)',
      observedAt,
    });
  }
  return { observations: [...byId.values()], skipped, warnings: [] };
}
