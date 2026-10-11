/*
 * Diagnóstico de fuentes (fase 0). Ejecutar en un equipo CON internet:
 *   npm run probe
 * No guarda nada, no envía notificaciones. Sirve para validar el parser de IGC-UP
 * contra la página real, que no pudo verificarse desde el entorno de generación.
 */
import { parseIgcHtml } from '../src/sources/igc.ts';
import { parseUsgsFeed } from '../src/sources/usgs.ts';
import { USER_AGENT } from '../src/pollers.ts';

interface Target {
  name: string;
  url: string;
  kind: 'igc' | 'usgs';
}

const targets: Target[] = [
  { name: 'IGC-UP', url: 'https://sismosgeociencias.up.ac.pa/', kind: 'igc' },
  { name: 'USGS (2.5 día)', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', kind: 'usgs' },
];

for (const t of targets) {
  const started = performance.now();
  try {
    const res = await fetch(t.url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/json;q=0.9' },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    const ms = Math.round(performance.now() - started);
    const now = Date.now();
    const parsed =
      t.kind === 'igc' ? parseIgcHtml(text, now) : parseUsgsFeed(JSON.parse(text), now);
    const warnings = (parsed as { warnings?: string[] }).warnings ?? [];
    console.log(`${t.name}: HTTP ${res.status}, ${text.length} bytes, ${ms} ms, ${parsed.observations.length} sismos en zona`);
    for (const w of warnings) console.log(`  AVISO: ${w}`);
    for (const o of parsed.observations.slice(0, 5)) {
      console.log(
        `  ${new Date(o.originTime).toISOString()}  M${o.magnitude.toFixed(1)}  (${o.lat}, ${o.lon})  ${o.status}  ${o.region}`,
      );
    }
  } catch (e) {
    console.log(`${t.name}: ERROR ${e instanceof Error ? e.message : String(e)}`);
  }
}
