import { expect, test, type Page } from '@playwright/test';

/**
 * Story 13.2: on a portrait phone the whole table fits in the screen height, in overview and in zoom, and every
 * touch target is at least 44 px. Dev scene `?scene=mort`: Topper Harley can attack the Knights who say "Ni!".
 */
const NI = 'Les Chevaliers qui disent « Ni ! »';
const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];

async function noVerticalScroll(page: Page) {
  await page.mouse.move(180, 300);
  await page.mouse.wheel(0, 800);
  const m = await page.evaluate(() => ({
    scrollY: scrollY,
    doc: document.documentElement.scrollHeight,
    body: document.body.scrollHeight,
    inner: innerHeight,
    // the parts that must be in view: both heroes, both sides, the banner (the hand overflows the bottom on purpose)
    bottoms: [...document.querySelectorAll('.table .hero, .table .side, .table .banner, .table .topbar')].map((e) => e.getBoundingClientRect().bottom),
    handTop: Math.max(...[...document.querySelectorAll('.table .hand .card')].map((e) => e.getBoundingClientRect().top)),
  }));
  expect(m.scrollY).toBe(0);
  expect(m.doc).toBeLessThanOrEqual(m.inner);
  expect(m.body).toBeLessThanOrEqual(m.inner);
  for (const b of m.bottoms) expect(b).toBeLessThanOrEqual(m.inner);
  expect(m.handTop).toBeLessThan(m.inner - 44);
}

/** Every visible control of the table (buttons, slots, the visible part of each hand card) is at least 44 × 44 px. */
async function touchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).pointerEvents !== 'none';
    };
    const els = document.querySelectorAll('.table .topbar button, .table .banner button, .table .side-btn, .table .board .slot, .table .side.is-zoomed .zones button');
    for (const e of els) {
      if (!vis(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) out.push(`${e.className} ${e.getAttribute('aria-label') ?? ''} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    const hand = [...document.querySelectorAll('.table .hand .card')].map((e) => e.getBoundingClientRect());
    hand.forEach((r, i) => {
      const w = i < hand.length - 1 ? hand[i + 1]!.left - r.left : r.width;
      const h = innerHeight - r.top;
      if (w < 44 || h < 44) out.push(`hand card ${i} ${Math.round(w)}×${Math.round(h)}`);
    });
    return out;
  });
  expect(small).toEqual([]);
}

for (const size of SIZES) {
  test.describe(`${size.width} × ${size.height}`, () => {
    test.use({ viewport: size });

    test('overview and manual zoom fit without vertical scroll', async ({ page }) => {
      await page.goto('/?scene=mort');
      await expect(page.locator('.table.compact')).toBeVisible();
      await expect(page.locator('.side.theirs')).toHaveClass(/is-overview/);
      await expect(page.locator('.side.theirs .slot')).toHaveCount(10);
      await expect(page.locator('.side.mine .slot')).toHaveCount(10);
      await noVerticalScroll(page);
      await touchTargets(page);

      await page.getByRole('button', { name: 'Agrandir le camp adverse' }).click();
      await expect(page.locator('.side.theirs')).toHaveClass(/is-zoomed/);
      await expect(page.locator('.side.mine')).toHaveClass(/is-folded/);
      await noVerticalScroll(page);
      await touchTargets(page);
      // the zoomed side's cards are larger than in overview
      const w = await page.locator('.side.theirs .card').first().evaluate((e) => e.getBoundingClientRect().width);
      expect(w).toBeGreaterThan(50);

      await page.getByRole('button', { name: 'Vue d’ensemble' }).click();
      await expect(page.locator('.side.theirs')).toHaveClass(/is-overview/);
      // touching my side (an empty slot) zooms it
      await page.locator('.side.mine .slot').nth(7).click();
      await expect(page.locator('.side.mine')).toHaveClass(/is-zoomed/);
      await noVerticalScroll(page);
    });

    test('picking an attacker zooms the foe side; it closes after the attack', async ({ page }) => {
      await page.goto('/?scene=mort');
      await page.locator('.board.mine').getByRole('button', { name: 'Topper Harley' }).click();
      await page.getByRole('button', { name: 'Choisir une cible' }).click();
      await expect(page.locator('.side.theirs')).toHaveClass(/is-zoomed/);
      await expect(page.locator('.side.mine')).toHaveClass(/is-folded/);
      await expect(page.locator('.banner.consigne')).toContainText('Topper Harley attaque');
      await noVerticalScroll(page);
      await touchTargets(page);

      await page.locator('.board.theirs').getByRole('button', { name: NI }).click();
      // the zoom stays while the attack plays, then the overview comes back
      await expect(page.locator('.side.theirs')).toHaveClass(/is-zoomed/);
      await expect(page.locator('.board.theirs').getByRole('button', { name: NI })).toHaveCount(0, { timeout: 5000 });
      await expect(page.locator('.side.theirs')).toHaveClass(/is-overview/, { timeout: 5000 });
      await noVerticalScroll(page);
    });
  });
}

test('landscape and desktop keep their layout', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?scene=mort');
  await expect(page.locator('.board.mine')).toBeVisible();
  await expect(page.locator('.table.compact')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.table-root.wide')).toBeVisible();
  await expect(page.locator('.table.compact')).toHaveCount(0);
});
