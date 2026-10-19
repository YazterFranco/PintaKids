import { expect, test } from '@playwright/test';

/** Humo: la app arranca sin errores de consola y los 7 modos responden. */

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.locator('.tabbar .tab')).toHaveCount(7);
  (page as any).__errors = errors;
});

test('carga inicial sin errores JS', async ({ page }) => {
  await expect(page.locator('#view-draw .canvas-wrap canvas')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('#view-draw .toolbtn')).not.toHaveCount(0);
  expect((page as any).__errors).toEqual([]);
});

test('cambiar de pestaña monta cada modo sin errores', async ({ page }) => {
  for (const v of ['color', 'learn', 'photo', 'story', 'gallery', 'parents']) {
    await page.click(`.tab[data-view="${v}"]`);
    await expect(page.locator(`#view-${v}`)).toBeVisible();
    await page.waitForTimeout(400);
  }
  expect((page as any).__errors).toEqual([]);
});

test('dibujar deja trazo en el lienzo y deshacer lo quita', async ({ page }) => {
  const canvas = page.locator('#view-draw canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 12 });
  await page.mouse.up();

  const painted = () =>
    page.evaluate(() => {
      const c = document.querySelector('#view-draw canvas') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });

  expect(await painted()).toBeGreaterThan(50);
  await page.click('#view-draw [data-testid="undo"]');
  expect(await painted()).toBe(0);
});

test('guardar dibujo sube estrellas y aparece en galería', async ({ page }) => {
  const canvas = page.locator('#view-draw canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 120, { steps: 10 });
  await page.mouse.up();
  await page.click('#view-draw .toolbtn.big');
  await expect(page.locator('#starScore')).toContainText('1', { timeout: 5_000 });
  await page.click('.tab[data-view="gallery"]');
  await expect(page.locator('#view-gallery .card img')).toHaveCount(1, { timeout: 5_000 });
});

test('colorear: catálogo carga y tocar rellena sin salirse', async ({ page }) => {
  await page.click('.tab[data-view="color"]');
  await expect(page.locator('#view-color .card')).toHaveCount(21, { timeout: 8_000 });
  await page.locator('#view-color .card').first().click();
  const canvas = page.locator('#view-color canvas');
  await expect(canvas).toBeVisible({ timeout: 8_000 });
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const filled = await page.evaluate(() => {
    const c = document.querySelector('#view-color canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) n++;
    return n;
  });
  // el centro de "gato" es la cara: debe pintarse una zona razonable, no media tela
  expect(filled).toBeGreaterThan(2_000);
  expect(filled).toBeLessThan(900 * 900 * 0.6);
});

test('zona de padres pide la puerta matemática', async ({ page }) => {
  await page.click('.tab[data-view="parents"]');
  await expect(page.locator('#view-parents .gate-q')).toBeVisible({ timeout: 5_000 });
  const text = await page.locator('#view-parents .gate-q').textContent();
  const m = /(\d+)\s*×\s*(\d+)/.exec(text!);
  await page.fill('#view-parents .gate-input', String(Number(m![1]) * Number(m![2])));
  await page.click('#view-parents .toolbtn.big');
  await expect(page.locator('#view-parents .panel')).toHaveCount(4, { timeout: 5_000 });
});

test('i18n: cambiar a inglés traduce la barra', async ({ page }) => {
  await page.click('.tab[data-view="parents"]');
  await expect(page.locator('#view-parents .gate-q')).toBeVisible();
  const t = await page.locator('#view-parents .gate-q').textContent();
  const m = /(\d+)\s*×\s*(\d+)/.exec(t!);
  await page.fill('#view-parents .gate-input', String(Number(m![1]) * Number(m![2])));
  await page.click('#view-parents .toolbtn.big');
  const sel = page.locator('#view-parents select').first();
  await sel.selectOption('en');
  await page.waitForLoadState();
  await expect(page.locator('.tab[data-view="draw"] b')).toHaveText('Draw');
});
