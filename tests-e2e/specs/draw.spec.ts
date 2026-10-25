import { expect, test, type Page } from '@playwright/test';

/** Dibujar v2: barra lateral de pinceles, selector de color y autoguardado. */

async function scribble(page: Page) {
  const box = (await page.locator('#view-draw canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 14 });
  await page.mouse.up();
}

const inked = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('#view-draw canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  (page as any).__errors = errors;
  await page.goto('/#/draw');
  await expect(page.locator('#view-draw canvas')).toBeVisible();
});

test('la barra lateral cambia de pincel y el trazo se pinta', async ({ page }) => {
  await page.click('[data-testid="tool-chalk"]');
  await expect(page.locator('[data-testid="tool-chalk"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#view-draw [data-testid="undo"]')).toBeDisabled();
  await scribble(page);
  expect(await inked(page)).toBeGreaterThan(50);
  await expect(page.locator('#view-draw [data-testid="undo"]')).toBeEnabled();
  expect((page as any).__errors).toEqual([]);
});

test('selector de color: elegir un color lo aplica y queda en recientes', async ({ page }) => {
  await page.click('[data-testid="color-btn"]');
  await expect(page.locator('.cp-sheet')).toBeVisible();
  await page.click('.cp-sheet [data-color="#0984e3"]');
  await expect(page.locator('.cp-sheet')).toBeHidden();
  await expect(page.locator('[data-testid="color-btn"]')).toHaveAttribute('data-color', '#0984e3');
  await expect(page.locator('#view-draw .recent-colors [data-color="#0984e3"]')).toHaveCount(1);
});

test('autoguardado: el dibujo vuelve tras recargar', async ({ page }) => {
  await scribble(page);
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator('#view-draw canvas')).toBeVisible();
  await expect.poll(() => inked(page), { timeout: 5_000 }).toBeGreaterThan(50);
  await expect(page.locator('#view-draw [data-testid="undo"]')).toBeDisabled();
});

test('espejo cuádruple pinta en las cuatro esquinas', async ({ page }) => {
  await page.click('[data-testid="mirror-btn"]');
  await page.click('[data-mirror="quad"]');
  const box = (await page.locator('#view-draw canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.2, { steps: 6 });
  await page.mouse.up();
  const corners = await page.evaluate(() => {
    const c = document.querySelector('#view-draw canvas') as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    const q = (x0: number, y0: number) => {
      const d = g.getImageData(x0 * c.width, y0 * c.height, c.width / 2, c.height / 2).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    };
    return [q(0, 0), q(0.5, 0), q(0, 0.5), q(0.5, 0.5)];
  });
  for (const n of corners) expect(n).toBeGreaterThan(20);
});
