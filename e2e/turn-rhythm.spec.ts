import { expect, test, type Page } from '@playwright/test';

/** Story 12.7: turn banners, playable cards lighting up, victory and defeat moments. */

async function watchFx(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __ccFx: { cls: string; text: string; t: number }[] };
    w.__ccFx = [];
    new MutationObserver((list) => {
      for (const m of list)
        for (const n of m.addedNodes)
          if (n instanceof HTMLElement && n.classList.contains('fx-layer')) w.__ccFx.push({ cls: n.className, text: n.textContent ?? '', t: performance.now() });
    }).observe(document.body, { childList: true });
  });
}
const fx = (page: Page) => page.evaluate(() => (window as unknown as { __ccFx: { cls: string; text: string; t: number }[] }).__ccFx);

test('"Tour adverse", then "À toi de jouer" and my playable cards light up', async ({ page }) => {
  await page.goto('/?scene=mort');
  await watchFx(page);
  await page.getByRole('button', { name: 'Fin du tour' }).click();
  await expect.poll(async () => (await fx(page)).some((f) => f.cls.includes('playable')), { timeout: 30000 }).toBe(true);
  const seen = await fx(page);
  const foe = seen.find((f) => f.cls.includes('fx-turn') && f.text === 'Tour adverse');
  const mine = seen.find((f) => f.cls.includes('fx-turn') && f.cls.includes('mine'));
  expect(foe).toBeTruthy();
  expect(mine?.text).toBe('À toi de jouer');
  const glow = seen.find((f) => f.cls.includes('playable'))!;
  expect(foe!.t).toBeLessThan(mine!.t);
  expect(mine!.t).toBeLessThan(glow.t);
});

test('victory: the foe portrait breaks and gold rains before the end screen', async ({ page }) => {
  await page.goto('/?scene=victoire');
  await watchFx(page);
  await page.locator('.board.mine').getByRole('button', { name: 'Topper Harley' }).click();
  await page.getByRole('button', { name: 'Choisir une cible' }).click();
  await page.locator('[data-hero="1"]').click();
  await expect.poll(async () => (await fx(page)).some((f) => f.cls.includes('fx-gold')), { timeout: 5000 }).toBe(true);
  // the moment plays first: no end screen yet
  await expect(page.locator('.end')).toHaveCount(0);
  const seen = await fx(page);
  expect(seen.some((f) => f.cls.includes('fx-crack') && f.cls.includes('portrait'))).toBe(true);
  await expect(page.locator('.end')).toContainText('Victoire', { timeout: 5000 });
});

test('defeat: the table darkens, then the end screen', async ({ page }) => {
  await page.goto('/?scene=mort');
  await watchFx(page);
  await page.getByRole('button', { name: 'Quitter' }).click();
  await page.locator('.overlay').getByRole('button', { name: 'Abandonner' }).click();
  await page.locator('.overlay').getByRole('button', { name: 'Abandonner' }).click();
  await expect.poll(async () => (await fx(page)).some((f) => f.cls.includes('fx-veil')), { timeout: 5000 }).toBe(true);
  await expect(page.locator('.end')).toContainText('Défaite', { timeout: 5000 });
});
