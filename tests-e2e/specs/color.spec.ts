import { expect, test, type Page } from '@playwright/test';

/** Colorear v2: biblioteca por paquete y nivel, estilos de relleno, pincel que no se sale, deshacer/rehacer. */

const pixels = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('#view-color canvas') as HTMLCanvasElement;
    return Array.from(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data);
  });

function colorAt(d: number[], w: number, x: number, y: number) {
  const o = (Math.round(y) * w + Math.round(x)) * 4;
  return [d[o], d[o + 1], d[o + 2]].join(',');
}

async function openFirst(page: Page) {
  await page.locator('#view-color .card').first().click();
  await expect(page.locator('#view-color canvas')).toBeVisible();
  await page.waitForTimeout(200);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  (page as any).__errors = errors;
  await page.goto('/#/color');
  await expect(page.locator('#view-color .card').first()).toBeVisible({ timeout: 8_000 });
});

test('biblioteca: 8 paquetes y filtro por nivel', async ({ page }) => {
  await expect(page.locator('#view-color .packrow .chip[data-pack]')).toHaveCount(8);
  await page.click('#view-color [data-level="1"]');
  const levels = await page.locator('#view-color .card').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.level));
  expect(levels.length).toBeGreaterThan(0);
  expect(new Set(levels)).toEqual(new Set(['1']));
});

test('balde: toca una zona y se rellena; deshacer y rehacer', async ({ page }) => {
  await openFirst(page);
  const canvas = page.locator('#view-color canvas');
  const box = (await canvas.boundingBox())!;
  const w = await canvas.evaluate((c: HTMLCanvasElement) => c.width);
  const before = await pixels(page);
  // (0.5, 0.4) cae dentro de la cara del primer dibujo (conejo), no sobre una línea
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.waitForTimeout(200);
  const after = await pixels(page);
  const cx = w * 0.5;
  const cy = w * 0.4;
  expect(colorAt(after, w, cx, cy)).not.toBe(colorAt(before, w, cx, cy));
  expect(colorAt(after, w, 2, 2)).toBe(colorAt(before, w, 2, 2)); // el fondo no se pinta
  await page.click('#view-color [data-testid="color-undo"]');
  expect(colorAt(await pixels(page), w, cx, cy)).toBe(colorAt(before, w, cx, cy));
  await page.click('#view-color [data-testid="color-redo"]');
  expect(colorAt(await pixels(page), w, cx, cy)).toBe(colorAt(after, w, cx, cy));
  expect((page as any).__errors).toEqual([]);
});

test('estilo de relleno a rayas pinta dos tonos en la misma zona', async ({ page }) => {
  await openFirst(page);
  await page.click('#view-color [data-fill="stripes"]');
  const canvas = page.locator('#view-color canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.waitForTimeout(200);
  const w = await canvas.evaluate((c: HTMLCanvasElement) => c.width);
  const d = await pixels(page);
  const tones = new Set<string>();
  for (let k = -12; k <= 12; k += 2) tones.add(colorAt(d, w, w * 0.5 + k, w * 0.4));
  expect(tones.size).toBeGreaterThan(1);
});

test('pincel de crayón pinta dentro de la zona y no en el fondo', async ({ page }) => {
  await openFirst(page);
  await page.click('#view-color [data-brush="crayon"]');
  const canvas = page.locator('#view-color canvas');
  const box = (await canvas.boundingBox())!;
  const w = await canvas.evaluate((c: HTMLCanvasElement) => c.width);
  const before = await pixels(page);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.mouse.down();
  // arrastre largo que cruza hacia el fondo: no debe pintarlo
  await page.mouse.move(box.x + 4, box.y + box.height * 0.5, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await pixels(page);
  let changed = 0;
  for (let i = 0; i < after.length; i += 4) if (after[i] !== before[i] || after[i + 1] !== before[i + 1]) changed++;
  expect(changed).toBeGreaterThan(100);
  expect(colorAt(after, w, 3, w * 0.5)).toBe(colorAt(before, w, 3, w * 0.5));
});

test('guardar celebra y da una estrella', async ({ page }) => {
  await openFirst(page);
  const box = (await page.locator('#view-color canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);
  await page.click('#view-color [data-testid="color-save"]');
  await expect(page.locator('.celebrate')).toBeVisible();
  await expect(page.locator('#starScore')).toContainText('1');
});

test('lienzo cuadrado, completo en pantalla y sin scroll', async ({ page }) => {
  await openFirst(page);
  const box = (await page.locator('#view-color canvas').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.abs(box.width - box.height)).toBeLessThan(2);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  const scroll = await page.evaluate(() => {
    const v = document.getElementById('view-color')!;
    return v.scrollHeight - v.clientHeight;
  });
  expect(scroll).toBeLessThanOrEqual(1);
});
