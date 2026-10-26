import { expect, test, type Page } from '@playwright/test';

/** Cuentos y Galería v2: borrar cuento, modo lectura con paso de página, abrir un dibujo para seguir. */

async function newStory(page: Page, title: string) {
  await page.goto('/#/story');
  page.once('dialog', (d) => d.accept(title));
  await page.click('[data-testid="story-new"]');
  await expect(page.locator('#view-story .page-card')).toHaveCount(1);
}

async function scribble(page: Page, sel: string) {
  const box = (await page.locator(sel).boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 10 });
  await page.mouse.up();
}

test('borrar un cuento desde la lista', async ({ page }) => {
  await newStory(page, 'Para borrar');
  await page.click('[data-testid="story-list"]');
  await expect(page.locator('#view-story [data-testid="story-card"]')).toHaveCount(1);
  page.once('dialog', (d) => d.accept());
  await page.click('#view-story [data-testid="story-delete"]');
  await expect(page.locator('#view-story [data-testid="story-card"]')).toHaveCount(0);
});

test('modo lectura: muestra la página, la lee y pasa a la siguiente', async ({ page }) => {
  await newStory(page, 'El dragón');
  await page.fill('#view-story input.caption', 'Había una vez un dragón');
  await page.locator('#view-story input.caption').blur();
  await page.click('[data-testid="story-addpage"]');
  await expect(page.locator('#view-story .page-card')).toHaveCount(2);
  await page.click('[data-testid="story-read"]');
  await expect(page.locator('.story-reader')).toBeVisible();
  await expect(page.locator('.story-reader .reader-text')).toContainText('Había una vez un dragón');
  await page.click('.story-reader [data-testid="reader-next"]');
  await expect(page.locator('.story-reader [data-testid="reader-page"]')).toContainText('2');
});

test('galería: abrir un dibujo lo carga en Dibujar para seguirlo', async ({ page }) => {
  await page.goto('/#/draw');
  await expect(page.locator('#view-draw canvas')).toBeVisible();
  await scribble(page, '#view-draw canvas');
  await page.click('#view-draw [data-testid="save"]');
  await expect(page.locator('#starScore')).toContainText('1');
  page.once('dialog', (d) => d.accept());
  await page.click('#view-draw [data-testid="clear"]');
  await page.evaluate(() => (location.hash = '#/gallery'));
  await page.click('#view-gallery [data-testid="gallery-open"]');
  await expect(page.locator('#view-draw')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector('#view-draw canvas') as HTMLCanvasElement;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n;
      }),
    )
    .toBeGreaterThan(50);
});
