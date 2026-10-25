import { expect, test } from '@playwright/test';

/** Cada dibujo del catálogo, rasterizado como lo hace Colorear, tiene ≥5 zonas cerradas para pintar. */
test('catálogo: todos los dibujos tienen al menos 5 zonas para colorear', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/home');
  const report = await page.evaluate(async () => {
    const { dilateMask, labelRegions, lineMaskFromRGBA } = await import('/core/colorfill.js');
    const S = 640;
    const cat = await fetch('/v1/catalog').then((r) => r.json());
    const out: { file: string; regions: number }[] = [];
    for (const p of cat.packs) {
      const pack = await fetch(`/v1/catalog/${p.id}`).then((r) => r.json());
      for (const f of pack.files) {
        const img = new Image();
        img.src = `/v1/catalog/${p.id}/files/${f.file}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d')!;
        g.drawImage(img, S * 0.04, S * 0.04, S * 0.92, S * 0.92);
        const data = g.getImageData(0, 0, S, S).data;
        const { labels, regionCount } = labelRegions(dilateMask(lineMaskFromRGBA(data, S, S), S, S), S, S);
        const size = new Int32Array(regionCount);
        const border = new Uint8Array(regionCount);
        for (let i = 0; i < labels.length; i++) {
          const r = labels[i];
          if (r < 0) continue;
          size[r]++;
          const x = i % S;
          const y = (i / S) | 0;
          if (x === 0 || y === 0 || x === S - 1 || y === S - 1) border[r] = 1;
        }
        let n = 0;
        for (let r = 0; r < regionCount; r++) if (!border[r] && size[r] >= 60) n++;
        out.push({ file: `${p.id}/${f.file}`, regions: n });
      }
    }
    return out;
  });
  expect(report.length).toBeGreaterThanOrEqual(56);
  const pobres = report.filter((r) => r.regions < 5);
  expect(pobres, JSON.stringify(pobres)).toEqual([]);
});
