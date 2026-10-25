// Utilidad local (no es prueba): captura pantallas para revisión visual.
// Uso: node shot.mjs <ruta-hash> <archivo.png> [ancho] [alto] [dark]
import { chromium } from 'playwright';
const [, , hash = 'home', out = 'shot.png', w = '390', h = '844', dark] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light' });
p.on('pageerror', (e) => console.log('pageerror', String(e)));
await p.goto('http://127.0.0.1:8091/#/' + hash);
await p.waitForTimeout(1500);
if (process.env.STEPS) { for (const s of process.env.STEPS.split(';')) { await eval('(async()=>{' + s + '})()'); await p.waitForTimeout(400); } }
await p.screenshot({ path: out });
await b.close();
