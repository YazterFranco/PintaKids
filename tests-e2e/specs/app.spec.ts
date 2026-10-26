import { expect, test } from '@playwright/test';

/** Humo: la app arranca sin errores de consola y los 7 modos responden. */

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.locator('#view-home [data-testid^="home-card-"]')).toHaveCount(6);
  (page as any).__errors = errors;
});

test('carga inicial sin errores JS', async ({ page }) => {
  await expect(page.locator('#view-home')).toBeVisible();
  await page.click('[data-testid="home-card-draw"]');
  await expect(page.locator('#view-draw .canvas-wrap canvas')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('#view-draw .toolbtn')).not.toHaveCount(0);
  expect((page as any).__errors).toEqual([]);
});

test('desde inicio se abre cada modo y se vuelve sin errores', async ({ page }) => {
  for (const v of ['draw', 'learn', 'color', 'photo', 'story', 'gallery']) {
    await page.click(`[data-testid="home-card-${v}"]`);
    await expect(page.locator(`#view-${v}`)).toBeVisible();
    await page.waitForTimeout(300);
    await page.click(`#appbar [data-testid="home"]`);
    await expect(page.locator('#view-home')).toBeVisible();
  }
  // el aviso de "Reparar" nunca debe salir por avisos inofensivos del navegador
  await expect(page.locator('#pk-repair')).toHaveCount(0);
  expect((page as any).__errors).toEqual([]);
});

test('dibujar deja trazo en el lienzo y deshacer lo quita', async ({ page }) => {
  await page.click('[data-testid="home-card-draw"]');
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
  await page.click('[data-testid="home-card-draw"]');
  const canvas = page.locator('#view-draw canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 120, { steps: 10 });
  await page.mouse.up();
  await page.click('#view-draw [data-testid="save"]');
  await expect(page.locator('#starScore')).toContainText('1', { timeout: 5_000 });
  await page.evaluate(() => (location.hash = '#/gallery'));
  await expect(page.locator('#view-gallery .card img')).toHaveCount(1, { timeout: 5_000 });
});

test('zona de padres pide la puerta matemática', async ({ page }) => {
  await page.evaluate(() => (location.hash = '#/parents'));
  await expect(page.locator('#view-parents .gate-q')).toBeVisible({ timeout: 5_000 });
  const text = await page.locator('#view-parents .gate-q').textContent();
  const m = /(\d+)\s*×\s*(\d+)/.exec(text!);
  await page.fill('#view-parents .gate-input', String(Number(m![1]) * Number(m![2])));
  await page.click('#view-parents .toolbtn.big');
  await expect(page.locator('#view-parents .panel')).toHaveCount(4, { timeout: 5_000 });
});

test('i18n: cambiar a inglés traduce la barra', async ({ page }) => {
  await page.evaluate(() => (location.hash = '#/parents'));
  await expect(page.locator('#view-parents .gate-q')).toBeVisible();
  const t = await page.locator('#view-parents .gate-q').textContent();
  const m = /(\d+)\s*×\s*(\d+)/.exec(t!);
  await page.fill('#view-parents .gate-input', String(Number(m![1]) * Number(m![2])));
  await page.click('#view-parents .toolbtn.big');
  const sel = page.locator('#view-parents select').first();
  await Promise.all([page.waitForEvent('load'), sel.selectOption('en')]);
  await page.goto('/#/home');
  await expect(page.locator('[data-testid="home-card-draw"] b')).toHaveText('Free drawing');
});

test('el aviso inofensivo "ResizeObserver loop" no abre la caja de Reparar', async ({ page }) => {
  await page.waitForTimeout(1200); // la app ya arrancó: el autodiagnóstico ya no limpia la caja
  await page.evaluate(() =>
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' })),
  );
  await page.waitForTimeout(200);
  await expect(page.locator('#pk-repair')).toHaveCount(0);
});
