import { expect, test, type Page } from '@playwright/test';

/**
 * Story 14.3: the detailed view of the open hand on the portrait phone table. Full cards (picture, then a text box
 * with each ability's energy icon, type tag and effect text, no movie quote) 70 % of the screen wide, 280 px at most,
 * in one row that scrolls sideways; the panel is as tall as the tallest card of the hand and grows upward, never over
 * the foe's banner nor mine. Forced with `?handView=detailed` (dev server) or the saved choice `cinecards.handView`.
 * Dev scene `?scene=pleine`: 10 cards in hand, Néo (the longest texts of the game) first.
 */
const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];

async function measure(page: Page) {
  return page.evaluate(() => {
    const panelEl = document.querySelector<HTMLElement>('.table .hand-panel')!;
    const row = panelEl.querySelector<HTMLElement>('.hand-row')!;
    const panel = panelEl.getBoundingClientRect();
    const cs = getComputedStyle(row);
    const heroes = [...document.querySelectorAll('.table .hero')].map((e) => e.getBoundingClientRect());
    return {
      panel: { top: panel.top, bottom: panel.bottom, height: panel.height },
      pad: parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom),
      foeBannerBottom: heroes[0]!.bottom,
      myBannerTop: heroes[1]!.top,
      scrollsX: row.scrollWidth > row.clientWidth + 1,
      scrollsY: row.scrollHeight > row.clientHeight + 1,
      cards: [...row.querySelectorAll<HTMLElement>('.card')].map((e) => {
        const r = e.getBoundingClientRect();
        const texts = [...e.querySelectorAll('.card-text .ability > span:not(.tg):not(.power)')].map((s) => parseFloat(getComputedStyle(s).fontSize));
        return {
          name: e.getAttribute('aria-label'),
          top: r.top,
          bottom: r.bottom,
          w: r.width,
          h: r.height,
          overflowY: e.scrollHeight > e.clientHeight + 1,
          full: e.classList.contains('card-full'),
          abilities: e.querySelectorAll('.card-text .ability').length,
          quotes: e.querySelectorAll('.card-text strong').length,
          minText: texts.length ? Math.min(...texts) : 99,
        };
      }),
    };
  });
}

for (const size of SIZES) {
  test.describe(`${size.width} × ${size.height}`, () => {
    test.use({ viewport: size });

    test('detailed view: full cards, the panel as tall as the tallest one, between the two banners', async ({ page }) => {
      await page.goto('/?scene=pleine&handView=detailed');
      const btn = page.locator('.table .hand-btn');
      const rects = () =>
        page.evaluate(() => [...document.querySelectorAll('.table .side, .table .board, .table .hero, .table .banner')].map((e) => JSON.stringify(e.getBoundingClientRect())));
      const before = await rects();
      await btn.click();
      const panel = page.getByRole('region', { name: 'Ta main' });
      await expect(panel).toHaveClass(/\bdetailed\b/);
      await expect(panel.locator('.card')).toHaveCount(10);
      // no header, no close button, nothing to tap inside a card but the card itself
      await expect(panel.locator('button:not(.card), h2, h3')).toHaveCount(0);
      expect(await rects()).toEqual(before);

      const m = await measure(page);
      const width = Math.min(size.width * 0.7, 280);
      const tallest = Math.max(...m.cards.map((c) => c.h));
      expect(m.cards[0]!.name).toMatch(/^Néo/);
      expect(m.cards[0]!.h).toBe(tallest);
      expect(m.cards[0]!.abilities).toBe(4);
      for (const c of m.cards) {
        expect(c.full).toBe(true);
        expect(Math.abs(c.w - width)).toBeLessThanOrEqual(1);
        expect(c.overflowY).toBe(false);
        expect(c.quotes).toBe(0);
        expect(c.minText).toBeGreaterThanOrEqual(12);
        expect(c.top).toBeGreaterThanOrEqual(m.panel.top);
        expect(c.bottom).toBeLessThanOrEqual(m.panel.bottom + 0.5);
      }
      // the panel's height is the tallest card plus its padding
      expect(Math.abs(m.panel.height - m.pad - tallest)).toBeLessThanOrEqual(2);
      expect(m.scrollsY).toBe(false);
      expect(m.scrollsX).toBe(true);
      // it grows upward from my banner, never over it nor over the foe's banner
      expect(m.panel.top).toBeGreaterThanOrEqual(m.foeBannerBottom);
      expect(m.panel.bottom).toBeLessThanOrEqual(m.myBannerTop);
      // a swipe shows the last card
      await page.locator('.hand-row').evaluate((e) => e.scrollTo({ left: e.scrollWidth }));
      await expect(panel.locator('.card').last()).toBeInViewport({ ratio: 0.9 });
      // the page itself does not scroll
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);

      await btn.click();
      await expect(page.locator('.table .hand')).toHaveCount(0);
      expect(await rects()).toEqual(before);
    });
  });
}

test('detailed view: a card opens its sheet with the quotes; "Jouer" folds the hand; the panel fits the new hand', async ({ page }) => {
  await page.goto('/?scene=pleine&handView=detailed');
  const btn = page.locator('.table .hand-btn');
  await btn.click();
  const first = await measure(page);
  const neo = page.locator('.hand-panel .card').first();
  await neo.click();
  const sheet = page.locator('aside.sheet[role="dialog"]');
  await expect(sheet).toBeVisible();
  // today's sheet: the movie quotes are there
  await expect(sheet.locator('.ability-head strong').first()).not.toBeEmpty();
  await page.getByRole('button', { name: /^Jouer/ }).first().click();
  await expect(page.locator('.table .hand')).toHaveCount(0);
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn.locator('.hand-badge')).toHaveText('9');
  await page.waitForTimeout(2500);

  // without Néo, the panel is as tall as the new tallest card
  await btn.click();
  await expect(page.locator('.hand-panel .card')).toHaveCount(9);
  const after = await measure(page);
  const tallest = Math.max(...after.cards.map((c) => c.h));
  expect(after.panel.height).toBeLessThan(first.panel.height);
  expect(Math.abs(after.panel.height - after.pad - tallest)).toBeLessThanOrEqual(2);

  // and on resize: smaller cards, the panel follows
  await page.setViewportSize({ width: 360, height: 640 });
  await expect.poll(async () => (await measure(page)).cards[0]!.w).toBeCloseTo(252, 0);
  const small = await measure(page);
  const tallestSmall = Math.max(...small.cards.map((c) => c.h));
  expect(Math.abs(small.panel.height - small.pad - tallestSmall)).toBeLessThanOrEqual(2);
  expect(small.panel.top).toBeGreaterThanOrEqual(small.foeBannerBottom);
});

test('the compact view stays the default; the saved choice opens the detailed view', async ({ page }) => {
  await page.goto('/?scene=pleine');
  await page.locator('.table .hand-btn').click();
  await expect(page.locator('.hand-panel')).not.toHaveClass(/\bdetailed\b/);
  await expect(page.locator('.hand-panel .card-full')).toHaveCount(0);
  await expect(page.locator('.hand-panel .card-hand')).toHaveCount(10);

  await page.evaluate(() => localStorage.setItem('cinecards.handView', 'detailed'));
  await page.goto('/?scene=pleine');
  await page.locator('.table .hand-btn').click();
  await expect(page.locator('.hand-panel')).toHaveClass(/\bdetailed\b/);
  await expect(page.locator('.hand-panel .card-full')).toHaveCount(10);
});

test('desktop: the detailed view changes nothing while the hand is not folded', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=pleine&handView=detailed');
  await expect(page.locator('.table .hand .card').first()).toBeVisible();
  await expect(page.locator('.table .hand-btn')).toHaveCount(0);
  await expect(page.locator('.table .card-full')).toHaveCount(0);
});
