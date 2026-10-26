import { expect, test, type Page } from '@playwright/test';

/** Hallazgos de la revisión final: pérdidas de trabajo, gestos que pintan solos y seguridad. */

/** Gesto de dos dedos sintético (los pointer events que genera un pellizco real). */
async function pinch(page: Page, sel: string) {
  await page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement;
    const r = el.getBoundingClientRect();
    const at = (id: number, type: string, x: number, y: number) =>
      el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: r.left + r.width * x, clientY: r.top + r.height * y, bubbles: true, pressure: 0.5 }));
    at(1, 'pointerdown', 0.5, 0.4);
    at(2, 'pointerdown', 0.6, 0.5);
    for (let k = 1; k <= 6; k++) {
      at(1, 'pointermove', 0.5 - k * 0.03, 0.4 - k * 0.03);
      at(2, 'pointermove', 0.6 + k * 0.03, 0.5 + k * 0.03);
    }
    at(2, 'pointerup', 0.78, 0.68);
    at(1, 'pointerup', 0.32, 0.22);
  }, sel);
}

const inkCount = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const c = document.querySelector(s) as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n / (d.length / 4);
  }, sel);

async function scribble(page: Page, sel: string, y = 0.3) {
  const b = (await page.locator(sel).boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * y);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * (y + 0.2), { steps: 10 });
  await page.mouse.up();
}

test('abrir un dibujo de la galería no borra el dibujo sin guardar, y guardar no duplica', async ({ page }) => {
  await page.goto('/#/draw');
  await expect(page.locator('#view-draw canvas')).toBeVisible();
  await scribble(page, '#view-draw canvas');
  await page.click('#view-draw [data-testid="save"]'); // dibujo A en la galería
  page.once('dialog', (d) => d.accept());
  await page.click('#view-draw [data-testid="clear"]');
  await scribble(page, '#view-draw canvas', 0.6); // dibujo B: SIN guardar
  await page.waitForTimeout(1000); // autoguardado
  await page.evaluate(() => (location.hash = '#/gallery'));
  await expect(page.locator('#view-gallery [data-testid="gallery-open"]')).toHaveCount(1);
  await page.locator('#view-gallery [data-testid="gallery-open"]').first().click(); // abrir A
  await expect(page.locator('#view-draw')).toBeVisible();
  await page.evaluate(() => (location.hash = '#/gallery'));
  // B se guardó solo en la galería en vez de perderse
  await expect(page.locator('#view-gallery [data-testid="gallery-open"]')).toHaveCount(2);
  await page.locator('#view-gallery [data-testid="gallery-open"]').last().click(); // abrir A otra vez
  await page.click('#view-draw [data-testid="save"]'); // guardar A: actualiza, no duplica
  await page.waitForTimeout(300);
  await page.evaluate(() => (location.hash = '#/gallery'));
  await expect(page.locator('#view-gallery [data-testid="gallery-open"]')).toHaveCount(2);
});

test('colorear: pellizcar con dos dedos no rellena nada', async ({ page }) => {
  await page.goto('/#/color');
  await page.locator('#view-color .card').first().click();
  await expect(page.locator('#view-color .color-paint canvas')).toBeVisible();
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => (document.querySelector('#view-color canvas') as HTMLCanvasElement).toDataURL());
  await pinch(page, '#view-color canvas');
  await page.waitForTimeout(200);
  // nada que deshacer: el pellizco no pintó
  await expect(page.locator('#view-color [data-testid="color-undo"]')).toBeDisabled();
  // y los píxeles del dibujo son idénticos (toDataURL no incluye el zoom visual)
  const after = await page.evaluate(() => (document.querySelector('#view-color canvas') as HTMLCanvasElement).toDataURL());
  expect(after).toBe(before);
});

test('dibujar: el balde sobre un "dibujo para pintar encima" rellena solo dentro de sus líneas', async ({ page }) => {
  await page.goto('/#/draw');
  await expect(page.locator('#view-draw canvas')).toBeVisible();
  await page.click('#view-draw [title="Background"], #view-draw [title="Fondo"]');
  await page.locator('.page-card-btn').first().click();
  await page.waitForTimeout(400);
  await page.click('[data-testid="tool-fill"]');
  const b = (await page.locator('#view-draw canvas').boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.42);
  await page.waitForTimeout(300);
  const frac = await inkCount(page, '#view-draw canvas');
  expect(frac).toBeGreaterThan(0.002); // pintó algo
  expect(frac).toBeLessThan(0.4); // pero no toda la hoja
});

test('cuentos: lo dibujado en una página no se pierde al salir con el botón de inicio', async ({ page }) => {
  await page.goto('/#/story');
  page.once('dialog', (d) => d.accept('Prueba'));
  await page.click('[data-testid="story-new"]');
  await page.click('[data-testid="story-draw"]');
  await expect(page.locator('#view-story .canvas-wrap canvas')).toBeVisible();
  await scribble(page, '#view-story canvas');
  await page.waitForTimeout(900);
  await page.click('#appbar [data-testid="home"]');
  await page.click('[data-testid="home-card-story"]');
  await expect(page.locator('#view-story .page-card img')).toHaveCount(1);
});

test('dibuja conmigo: un pellizco no desalinea la guía ni la puntuación', async ({ page }) => {
  await page.goto('/#/learn');
  await page.locator('#view-learn [data-testid="learn-card"]').first().click();
  await expect(page.locator('#view-learn .guide-svg svg')).toBeVisible();
  const box = (await page.locator('#view-learn .lesson-stage canvas').boundingBox())!;
  const pt = (a: number) => [box.x + (box.width * (200 + 70 * Math.cos(a))) / 400, box.y + (box.height * (170 + 62 * Math.sin(a))) / 400];
  const [x0, y0] = pt(0);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let k = 1; k <= 60; k++) await page.mouse.move(...(pt((k / 60) * Math.PI * 2) as [number, number]));
  await page.mouse.up();
  // pellizcar DESPUÉS de repasar: lo ya dibujado no debe moverse respecto a la guía
  await pinch(page, '#view-learn .lesson-stage canvas');
  await page.click('#view-learn [data-testid="learn-next"]');
  await expect(page.locator('#view-learn')).toHaveAttribute('data-last-stars', /\d/);
  expect(Number(await page.locator('#view-learn').getAttribute('data-last-stars'))).toBeGreaterThanOrEqual(2);
});

test('seguridad: la página trae su propia CSP (también dentro del APK) y nada la viola', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => /Content Security Policy/i.test(m.text()) && violations.push(m.text()));
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("object-src 'none'");
  for (const v of ['draw', 'learn', 'color', 'photo', 'story', 'gallery']) {
    await page.click(`[data-testid="home-card-${v}"]`);
    await page.waitForTimeout(400);
    await page.click('#appbar [data-testid="home"]');
  }
  expect(violations).toEqual([]);
});
