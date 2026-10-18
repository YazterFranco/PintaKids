import { expect, test } from '@playwright/test';

/** Flujos completos: cuentos con PDF, aprender con estrellas, foto→colorear, offline y axe. */

async function unlockParents(page) {
  await page.click('.tab[data-view="parents"]');
  const q = await page.locator('#view-parents .gate-q').textContent();
  const m = /(\d+)\s*[×x]\s*(\d+)/.exec(q!);
  await page.fill('#view-parents .gate-input', String(Number(m![1]) * Number(m![2])));
  await page.click('#view-parents .toolbtn.big');
  await expect(page.locator('#view-parents .panel').first()).toBeVisible();
}

test('cuento completo: crear, dibujar, caption, página nueva y exportar PDF', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#view-draw canvas');

  await page.click('.tab[data-view="story"]');
  page.once('dialog', (d) => d.accept('El robot pintor')); // ANTES del clic
  await page.click('[data-testid="story-new"]');
  await expect(page.locator('#view-story .page-card')).toHaveCount(1, { timeout: 5_000 });

  await page.locator('[data-testid="story-draw"]').first().click();
  await page.waitForSelector('#view-story .canvas-wrap canvas');
  const box = await page.locator('#view-story canvas').boundingBox();
  await page.mouse.move(box.x + 60, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 160, { steps: 8 });
  await page.mouse.up();
  await page.click('[data-testid="story-back"]');
  await expect(page.locator('#view-story .page-card img')).toHaveCount(1, { timeout: 5_000 });

  await page.fill('#view-story input.caption', 'Vivia en un bosque de plastilina');
  await page.click('[data-testid="story-addpage"]');
  await expect(page.locator('#view-story .page-card')).toHaveCount(2, { timeout: 5_000 });

  const dl = page.waitForEvent('download', { timeout: 8_000 });
  await page.click('[data-testid="story-pdf"]');
  const file = await dl;
  const stream = await file.createReadStream();
  const head = await new Promise((res) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => res(Buffer.concat(chunks).subarray(0, 8).toString()));
  });
  expect(head.startsWith('%PDF-1.4')).toBeTruthy();
});

test('aprender: pasar los pasos de una lección da una estrella', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#view-draw canvas');
  await page.click('.tab[data-view="learn"]');
  await page.locator('[data-testid="learn-card"]').first().click();
  await page.waitForSelector('#view-learn .canvas-wrap canvas');
  await expect(page.locator('#view-learn .dot-step')).not.toHaveCount(0);
  for (let i = 0; i < 8; i++) {
    const next = page.locator('[data-testid="learn-next"]');
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(220);
  }
  await expect(page.locator('#starScore')).toContainText('1', { timeout: 4_000 });
});

test('foto → colorear: subir imagen, ver máscara y entrar al colorear', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#view-draw canvas');
  await page.click('.tab[data-view="photo"]');
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 200;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 200, 200);
    x.strokeStyle = '#000';
    x.lineWidth = 8;
    x.beginPath();
    x.arc(100, 100, 60, 0, Math.PI * 2);
    x.stroke();
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.setInputFiles('#view-photo input[type=file]', { name: 'circulo.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForTimeout(1_200);
  const painted = await page.evaluate(() => {
    const c = document.querySelector('#view-photo canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++;
    return n;
  });
  expect(painted).toBeGreaterThan(400);
  await page.click('[data-testid="photo-use"]');
  await expect(page.locator('#view-color canvas')).toBeVisible({ timeout: 8_000 });
  // rellenar el interior del círculo no debe pintarlo todo
  const box = await page.locator('#view-color canvas').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  const frac = await page.evaluate(() => {
    const c = document.querySelector('#view-color canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) n++;
    return n / (d.length / 4);
  });
  expect(frac).toBeLessThan(0.85);
});

test('offline: la app y el catálogo siguen funcionando sin red', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForSelector('#view-draw canvas');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.click('.tab[data-view="color"]');
  await expect(page.locator('#view-color .card').first()).toBeVisible({ timeout: 8_000 });

  await context.setOffline(true);
  await page.goto('/');
  await page.waitForSelector('#view-draw canvas', { timeout: 10_000 });
  await expect(page.locator('.tabbar')).toBeVisible();
  await page.click('.tab[data-view="color"]');
  await expect(page.locator('#view-color .card').first()).toBeVisible({ timeout: 8_000 });
  // dibujar offline y comprobar persistencia IndexedDB
  await page.click('.tab[data-view="draw"]');
  const box2 = await page.locator('#view-draw canvas').boundingBox();
  await page.mouse.move(box2.x + 30, box2.y + 30);
  await page.mouse.down();
  await page.mouse.move(box2.x + 120, box2.y + 90, { steps: 6 });
  await page.mouse.up();
  await page.click('#view-draw .toolbtn.big'); // guardar
  await expect(page.locator('#starScore')).toContainText('1', { timeout: 5_000 });
  await context.setOffline(false);
});

test('accesibilidad: sin violaciones críticas en la vista principal', async ({ page }) => {
  const AxeBuilder = (await import('@axe-core/playwright')).default;
  await page.goto('/');
  await page.waitForSelector('#view-draw canvas');
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  expect(critical.map((v) => `${v.id} x${v.nodes.length}`)).toEqual([]);
});

test('zona de padres se abre con la multiplicación correcta', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#view-draw canvas');
  await unlockParents(page);
});
