import { expect, test } from '@playwright/test';

/** Foto v2: recorte cuadrado, deslizadores de detalle y grosor, foto vertical sin errores. */

async function upload(page: any, w: number, h: number) {
  const b64 = await page.evaluate(([w, h]: number[]) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#111';
    x.lineWidth = 10;
    x.strokeRect(w * 0.2, h * 0.3, w * 0.6, h * 0.4);
    x.beginPath();
    x.arc(w / 2, h / 2, Math.min(w, h) * 0.15, 0, Math.PI * 2);
    x.stroke();
    return c.toDataURL('image/png').split(',')[1];
  }, [w, h]);
  await page.setInputFiles('#view-photo input[type=file]', { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
}

const darkPixels = (page: any) =>
  page.evaluate(() => {
    const c = document.querySelector('#view-photo canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 120) n++;
    return n;
  });

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  (page as any).__errors = errors;
  await page.goto('/#/photo');
  await expect(page.locator('[data-testid="photo-take"]')).toBeVisible();
});

test('foto vertical (600×1200): se recorta en cuadrado y muestra líneas', async ({ page }) => {
  await upload(page, 600, 1200);
  await expect.poll(() => darkPixels(page), { timeout: 5_000 }).toBeGreaterThan(300);
  const box = (await page.locator('#view-photo canvas').boundingBox())!;
  expect(Math.abs(box.width - box.height)).toBeLessThan(2);
  expect((page as any).__errors).toEqual([]);
});

test('el deslizador de grosor engrosa las líneas', async ({ page }) => {
  await upload(page, 500, 500);
  await expect.poll(() => darkPixels(page)).toBeGreaterThan(300);
  await page.locator('[data-testid="photo-thickness"]').fill('1');
  await page.waitForTimeout(300);
  const thin = await darkPixels(page);
  await page.locator('[data-testid="photo-thickness"]').fill('4');
  await page.waitForTimeout(300);
  expect(await darkPixels(page)).toBeGreaterThan(thin);
  await expect(page.locator('[data-testid="photo-detail"]')).toBeVisible();
});
