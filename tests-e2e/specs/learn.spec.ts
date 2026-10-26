import { expect, test, type Page } from '@playwright/test';

/** Dibuja conmigo: pasos guiados con demostración, estrellas por paso, final y letras. */

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  (page as any).__errors = errors;
  await page.goto('/#/learn');
  await expect(page.locator('#view-learn [data-testid="learn-card"]').first()).toBeVisible({ timeout: 8_000 });
});

async function openBunny(page: Page) {
  // el primer dibujo es el conejo (nivel 1, 5 pasos)
  await page.locator('#view-learn [data-testid="learn-card"]').first().click();
  await expect(page.locator('#view-learn .guide-svg svg')).toBeVisible();
  await expect(page.locator('#view-learn [data-testid="learn-step"]')).toContainText('1');
}

test('sin dibujar nada se puede llegar al final: nunca bloquea', async ({ page }) => {
  await openBunny(page);
  for (let i = 0; i < 5; i++) {
    await page.click('#view-learn [data-testid="learn-next"]');
    await page.waitForTimeout(150);
  }
  await expect(page.locator('[data-testid="learn-end"]')).toBeVisible();
  await expect(page.locator('#starScore')).toContainText('1');
  expect((page as any).__errors).toEqual([]);
});

test('repasar la guía del paso da estrellas', async ({ page }) => {
  await openBunny(page);
  const box = (await page.locator('#view-learn .lesson-stage canvas').boundingBox())!;
  // cabeza del conejo: elipse centro (200,170), radios (70,62) en el lienzo de 400
  const pt = (a: number) => [box.x + (box.width * (200 + 70 * Math.cos(a))) / 400, box.y + (box.height * (170 + 62 * Math.sin(a))) / 400];
  const [x0, y0] = pt(0);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let k = 1; k <= 60; k++) {
    const [x, y] = pt((k / 60) * Math.PI * 2);
    await page.mouse.move(x, y);
  }
  await page.mouse.up();
  await page.click('#view-learn [data-testid="learn-next"]');
  const stars = await page.locator('#view-learn [data-testid="step-stars"]').getAttribute('data-stars');
  expect(Number(stars)).toBeGreaterThanOrEqual(2);
});

test('al final, "colorea tu dibujo" abre Colorear con tus líneas', async ({ page }) => {
  await openBunny(page);
  const box = (await page.locator('#view-learn .lesson-stage canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.7, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3, { steps: 8 });
  await page.mouse.up();
  for (let i = 0; i < 5; i++) await page.click('#view-learn [data-testid="learn-next"]');
  await page.click('[data-testid="learn-color-mine"]');
  await expect(page.locator('#view-color canvas')).toBeVisible();
  await expect(page.locator('#view-color .color-paint')).toBeVisible();
});

test('letras: la A tiene 3 trazos guiados', async ({ page }) => {
  await page.click('#view-learn [data-tab="letters"]');
  await page.click('#view-learn [data-letter="A"]');
  await expect(page.locator('#view-learn .guide-svg svg')).toBeVisible();
  await expect(page.locator('#view-learn [data-testid="learn-step"]')).toContainText('3');
});
