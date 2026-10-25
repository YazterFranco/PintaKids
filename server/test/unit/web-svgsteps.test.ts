import { deepEqual, equal, ok, throws } from 'node:assert';
import { test } from 'node:test';
import { parseSteps, svgUpTo, stepOnly } from '../../web/core/svgsteps.js';

// Orden en el archivo = orden de pintado (atrás → adelante); data-step = orden de dibujo.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="#fff" stroke="#2b2d42" stroke-width="5">
  <g data-step="4" data-name="pupila"><circle cx="1" cy="1" r="1" fill="#2b2d42"/></g>
  <!-- fondo -->
  <g data-step="3" data-name="suelo"><path d="M0 350H400"/></g>
  <g data-step="2" data-name="cuerpo"><g transform="translate(1 1)"><rect x="100" y="200" width="200" height="120"/></g></g>
  <g data-step="1" data-name="cabeza"><circle cx="200" cy="150" r="80"/></g>
</svg>`;

test('svgsteps: lee viewBox y pasos ordenados por número de dibujo', () => {
  const p = parseSteps(SVG);
  equal(p.viewBox, '0 0 400 400');
  deepEqual(p.steps.map((s) => [s.n, s.key]), [[1, 'cabeza'], [2, 'cuerpo'], [3, 'suelo'], [4, 'pupila']]);
  ok(p.steps[1].markup.includes('<rect'), 'conserva grupos anidados');
  ok(p.steps[1].markup.trim().endsWith('</g>'));
});

test('svgsteps: hasta el paso n incluye solo esos pasos y respeta el orden de pintado', () => {
  const p = parseSteps(SVG);
  const s2 = svgUpTo(p, 2);
  ok(s2.includes('cabeza') && s2.includes('cuerpo') && !s2.includes('suelo'));
  ok(s2.indexOf('cuerpo') < s2.indexOf('cabeza'), 'el cuerpo se pinta antes (detrás) que la cabeza');
  ok(s2.startsWith('<svg') && s2.trim().endsWith('</svg>'));
});

test('svgsteps: opciones de estilo para la guía', () => {
  const p = parseSteps(SVG);
  const dim = svgUpTo(p, 2, { earlier: 'dim', current: { stroke: '#6c5ce7', dash: '12 10' } });
  ok(/<g stroke="#c9c6d4">[^]*cabeza/.test(dim), 'pasos anteriores en gris claro (relleno opaco: siguen tapando)');
  ok(!dim.includes('opacity='), 'sin transparencia: lo de atrás no se trasluce');
  ok(dim.includes('stroke="#6c5ce7"') && dim.includes('stroke-dasharray="12 10"'));
  const mask = svgUpTo(p, 2, { earlier: 'hide', current: { stroke: '#ff00ff' } });
  ok(/<g stroke="#ffffff"[^>]*>[^]*cabeza/.test(mask), 'anteriores en blanco: tapan pero no se ven');
  const dim4 = svgUpTo(p, 5, { earlier: 'dim' });
  ok(!dim4.includes('fill="#2b2d42"'), 'rellenos oscuros también se atenúan');
  const only = stepOnly(p, 3);
  ok(only.includes('suelo') && !only.includes('cabeza'));
});

test('svgsteps: rechaza archivos mal formados', () => {
  throws(() => parseSteps('<svg viewBox="0 0 400 400"><g data-step="1"><path d="M0 0"/></g></svg>'), /data-name/);
  throws(() => parseSteps('<svg viewBox="0 0 400 400"><g data-step="1" data-name="a"></g><g data-step="3" data-name="b"></g></svg>'), /consecutiv/);
  throws(() => parseSteps('<svg viewBox="0 0 400 400"><g data-step="1" data-name="a"></g><path d="M1 1"/></svg>'), /fuera de un paso/);
  throws(() => parseSteps('<svg><g data-step="1" data-name="a"></g></svg>'), /viewBox/);
});
