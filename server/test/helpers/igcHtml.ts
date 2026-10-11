/*
 * HTML de IGC-UP RECONSTRUIDO para pruebas (no es una captura en vivo).
 * Reemplazar por una captura real (fixtures/igc-live-*.html) en la fase 0 de validación.
 */
export const IGC_SAMPLE_HTML = `
<table>
  <tr><th>Fecha</th><th>Hora</th><th>Latitud</th><th>Longitud</th><th>Profundidad</th><th>Magnitud</th><th>Ubicación</th><th>Estado</th><th></th></tr>
  <tr><td>2026-10-09</td><td>12:56:05PM</td><td>7.4616°N</td><td>80.2786°W</td><td>18 km</td><td>Mw 5.4</td><td>Localizado en Panamá a 18km al este de Tonosí</td><td>REVISADO</td><td><a href="detalle.php?z=18&amp;lt=7.4616&amp;ln=-80.2786">Ver</a></td></tr>
  <tr><td>2026-10-09</td><td>7:51:44PM</td><td>8.1000</td><td>-79.5000</td><td>10 km</td><td>3.2</td><td>Región de prueba</td><td>PRELIMINAR</td><td></td></tr>
  <tr><td>2026-10-09</td><td>7:51:44PM</td><td>8.1000</td><td>-79.5000</td><td>10 km</td><td>3.2</td><td>Región de prueba</td><td>PRELIMINAR</td><td></td></tr>
  <tr><td>2026-10-09</td><td>6:00:00AM</td><td>8</td><td>-80</td><td>x</td><td>ND</td><td>Fila inválida</td><td>PRELIMINAR</td><td></td></tr>
</table>`;

export const NO_TABLE_HTML = '<html><body><p>Mantenimiento</p></body></html>';
