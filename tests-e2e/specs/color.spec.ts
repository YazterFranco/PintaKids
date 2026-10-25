import { expect, test, type Page } from '@playwright/test';

/** Colorear v2: biblioteca por paquete y nivel, estilos de relleno, pincel que no se sale, deshacer/rehacer. */

// Las copias del lienzo se guardan DENTRO de la página: sacar 1,6 M de valores al test es lentísimo.
const snap = (page: Page, key: string) =>
  page.evaluate((k) => {
    const c = document.querySelector('#view-color canvas') as HTMLCanvasElement;
    (window as any)[k] = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  }, key);

/** Color (r,g,b) de la copia `key` en coordenadas normalizadas 0..1. */
const at = (page: Page, key: string, x: number, y: number) =>
  page.evaluate(([k, x, y]) => {
    const c = document.querySelector('#view-color canvas') as HTMLCanvasElement;
    const d = (window as any)[k as string];
    const o = (Math.round((y as number) * (c.height - 1)) * c.width + Math.round((x as number) * (c.width - 1))) * 4;
    return [d[o], d[o + 1], d[o + 2]].join(',');
  }, [key, x, y] as const);

const diff = (page: Page, a: string, b: string) =>
  page.evaluate(([a, b]) => {
    const A = (window as any)[a];
    const B = (window as any)[b];
    let n = 0;
    for (let i = 0; i < A.length; i += 4) if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) n++;
    return n;
  }, [a, b]);

async function openFirst(page: Page) {
  await page.locator('#view-color .card').first().click();
  await expect(page.locator('#view-color canvas')).toBeVisible();
  await page.waitForTimeout(200);
  return (await page.locator('#view-color canvas').boundingBox())!;
}

// (0.5, 0.4) cae dentro de la cara del primer dibujo (conejo), no sobre una línea.
const IN = [0.5, 0.4] as const;

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
  const box = await openFirst(page);
  await snap(page, 'a');
  await page.mouse.click(box.x + box.width * IN[0], box.y + box.height * IN[1]);
  await page.waitForTimeout(150);
  await snap(page, 'b');
  expect(await at(page, 'b', ...IN)).not.toBe(await at(page, 'a', ...IN));
  expect(await at(page, 'b', 0.01, 0.01)).toBe(await at(page, 'a', 0.01, 0.01)); // el fondo no se pinta
  await page.click('#view-color [data-testid="color-undo"]');
  await snap(page, 'c');
  expect(await at(page, 'c', ...IN)).toBe(await at(page, 'a', ...IN));
  await page.click('#view-color [data-testid="color-redo"]');
  await snap(page, 'd');
  expect(await at(page, 'd', ...IN)).toBe(await at(page, 'b', ...IN));
  expect((page as any).__errors).toEqual([]);
});

test('estilo de relleno a rayas pinta dos tonos en la misma zona', async ({ page }) => {
  const box = await openFirst(page);
  await page.click('#view-color [data-fill="stripes"]');
  await page.mouse.click(box.x + box.width * IN[0], box.y + box.height * IN[1]);
  await page.waitForTimeout(150);
  await snap(page, 's');
  const tones = new Set<string>();
  for (let k = -0.02; k <= 0.02; k += 0.004) tones.add(await at(page, 's', IN[0] + k, IN[1]));
  expect(tones.size).toBeGreaterThan(1);
});

test('pincel de crayón pinta dentro de la zona y no en el fondo', async ({ page }) => {
  const box = await openFirst(page);
  await page.click('#view-color [data-brush="crayon"]');
  await snap(page, 'a');
  await page.mouse.move(box.x + box.width * IN[0], box.y + box.height * IN[1]);
  await page.mouse.down();
  // arrastre largo que cruza hacia el fondo: no debe pintarlo
  await page.mouse.move(box.x + 4, box.y + box.height * IN[1], { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await snap(page, 'b');
  expect(await diff(page, 'a', 'b')).toBeGreaterThan(100);
  expect(await at(page, 'b', 0.005, IN[1])).toBe(await at(page, 'a', 0.005, IN[1]));
});

test('guardar celebra y da una estrella', async ({ page }) => {
  const box = await openFirst(page);
  await page.mouse.click(box.x + box.width * IN[0], box.y + box.height * IN[1]);
  await page.click('#view-color [data-testid="color-save"]');
  await expect(page.locator('.celebrate')).toBeVisible();
  await expect(page.locator('#starScore')).toContainText('1');
});

test('lienzo cuadrado, completo en pantalla y sin scroll', async ({ page }) => {
  const box = await openFirst(page);
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
