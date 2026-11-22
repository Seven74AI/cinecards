import { expect, test, type Page } from '@playwright/test';

/**
 * Story 13.2: on a portrait phone the whole table fits in the screen height, in overview and in zoom, and every
 * touch target is at least 44 px. Dev scene `?scene=mort`: Topper Harley can attack the Knights who say "Ni!".
 * Story 13.6: the hand cards are fully in view and readable, no empty band is left, my side does not fold during
 * my attack, and attacker and target are staged at the demo's size (100 px wide).
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
    hand: [...document.querySelectorAll('.table .hand .card')].map((e) => {
      const r = e.getBoundingClientRect();
      const name = e.querySelector('.card-name')!;
      return { top: r.top, bottom: r.bottom, w: r.width, name: parseFloat(getComputedStyle(name).fontSize), hp: e.querySelector('.badge.hp')!.getBoundingClientRect().bottom };
    }),
    heroBottom: [...document.querySelectorAll('.table .hero')].at(-1)!.getBoundingClientRect().bottom,
    // vertical gaps between the stacked rows of the table (empty bands)
    gaps: (() => {
      const rows = [...document.querySelectorAll('.table > *')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0);
      const out: number[] = [];
      for (let i = 1; i < rows.length; i++) out.push(rows[i]!.top - rows[i - 1]!.bottom);
      return out;
    })(),
  }));
  expect(m.scrollY).toBe(0);
  expect(m.doc).toBeLessThanOrEqual(m.inner);
  expect(m.body).toBeLessThanOrEqual(m.inner);
  for (const b of m.bottoms) expect(b).toBeLessThanOrEqual(m.inner);
  // story 13.6: every hand card is whole (cost, name, ATK/HP), below my hero and above the bottom edge, and readable
  for (const c of m.hand) {
    expect(c.top).toBeGreaterThanOrEqual(m.heroBottom);
    expect(c.bottom).toBeLessThanOrEqual(m.inner);
    expect(c.hp).toBeLessThanOrEqual(m.inner);
    expect(c.w).toBeGreaterThanOrEqual(70);
    expect(c.name).toBeGreaterThanOrEqual(8);
  }
  // no empty band: rows touch (a few px of gap), and the hand cards fill the room left at the bottom
  for (const g of m.gaps) expect(g).toBeLessThanOrEqual(24);
  const handBottom = Math.max(...m.hand.map((c) => c.bottom));
  const handTop = Math.min(...m.hand.map((c) => c.top));
  expect(m.inner - handBottom).toBeLessThanOrEqual(24);
  expect(handTop - m.heroBottom).toBeLessThanOrEqual(24);
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
      // story 13.6: the other side folds only on short screens (on taller ones it would leave an empty band)
      await expect(page.locator('.side.mine')).toHaveClass(size.height < 760 ? /is-folded/ : /is-overview/);
      await noVerticalScroll(page);
      await touchTargets(page);
      // the zoomed side's cards are large
      const w = await page.locator('.side.theirs .card').first().evaluate((e) => e.getBoundingClientRect().width);
      expect(w).toBeGreaterThan(55);

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
      // story 13.6: my side stays a side of real cards, never a strip of thumbnails
      await expect(page.locator('.side.mine')).toHaveClass(/is-overview/);
      await expect(page.locator('.banner.consigne')).toContainText('Topper Harley attaque');
      await noVerticalScroll(page);
      await touchTargets(page);

      // follow the on-screen width of the attacker and its target while the attack plays
      await page.evaluate((name) => {
        const w = window as unknown as { __ccW: { att: number; tgt: number; folded: boolean } };
        w.__ccW = { att: 0, tgt: 0, folded: false };
        const att = document.querySelector('.board.mine [aria-label="Topper Harley"]')!;
        const tgt = document.querySelector(`.board.theirs [aria-label="${name}"]`)!;
        const t0 = performance.now();
        const tick = () => {
          w.__ccW.att = Math.max(w.__ccW.att, att.getBoundingClientRect().width);
          if (tgt.isConnected) w.__ccW.tgt = Math.max(w.__ccW.tgt, tgt.getBoundingClientRect().width);
          if (document.querySelector('.side.mine.is-folded')) w.__ccW.folded = true;
          if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, NI);
      await page.locator('.board.theirs').getByRole('button', { name: NI }).click();
      // the zoom stays while the attack plays, then the overview comes back
      await expect(page.locator('.side.theirs')).toHaveClass(/is-zoomed/);
      await expect(page.locator('.board.theirs').getByRole('button', { name: NI })).toHaveCount(0, { timeout: 5000 });
      await expect(page.locator('.side.theirs')).toHaveClass(/is-overview/, { timeout: 5000 });
      await noVerticalScroll(page);
      const seen = await page.evaluate(() => (window as unknown as { __ccW: { att: number; tgt: number; folded: boolean } }).__ccW);
      expect(seen.folded).toBe(false);
      expect(seen.att).toBeGreaterThanOrEqual(100);
      expect(seen.tgt).toBeGreaterThanOrEqual(100);
      // then back to its slot size (after its own "when it destroys a card" bonus has shown)
      const topper = page.locator('.board.mine').getByRole('button', { name: 'Topper Harley' });
      await expect.poll(() => topper.evaluate((e) => e.getBoundingClientRect().width), { timeout: 3000 }).toBeLessThan(80);
    });

    test('a card played from the hand lands at the demo size, then settles in its slot', async ({ page }) => {
      await page.goto('/?scene=mort');
      const card = page.locator('.hand .card').first();
      const name = (await card.getAttribute('aria-label'))!;
      await card.press('Enter');
      await page.evaluate((n) => {
        const w = window as unknown as { __ccLand: number };
        w.__ccLand = 0;
        const t0 = performance.now();
        const tick = () => {
          const el = document.querySelector(`.board.mine [aria-label="${n}"]`);
          if (el) w.__ccLand = Math.max(w.__ccLand, el.getBoundingClientRect().width);
          if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, name);
      await page.getByRole('button', { name: /^Jouer/ }).first().click();
      await page.waitForTimeout(2600);
      expect(await page.evaluate(() => (window as unknown as { __ccLand: number }).__ccLand)).toBeGreaterThanOrEqual(90);
      const w = await page.locator('.board.mine').getByRole('button', { name }).evaluate((e) => e.getBoundingClientRect().width);
      expect(w).toBeLessThan(80);
    });
  });
}

/** Story 13.6: the staging is for the phone table only; desktop cards keep their size during an attack. */
test('desktop: no staging, the cards keep their size', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=mort');
  await expect(page.locator('.table-root.wide')).toBeVisible();
  const topper = page.locator('.board.mine').getByRole('button', { name: 'Topper Harley' });
  const before = await topper.evaluate((e) => e.getBoundingClientRect().width);
  await topper.click();
  await page.getByRole('button', { name: 'Choisir une cible' }).click();
  await page.evaluate(() => {
    const w = window as unknown as { __ccScale: string[] };
    w.__ccScale = [];
    const att = document.querySelector<HTMLElement>('.board.mine [aria-label="Topper Harley"]')!;
    const t0 = performance.now();
    const tick = () => {
      if (att.style.scale) w.__ccScale.push(att.style.scale);
      if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.locator('.board.theirs').getByRole('button', { name: NI }).click();
  await page.waitForTimeout(1600);
  expect(await page.evaluate(() => (window as unknown as { __ccScale: string[] }).__ccScale)).toEqual([]);
  const after = await topper.evaluate((e) => e.getBoundingClientRect().width);
  expect(Math.abs(after - before)).toBeLessThan(1);
});

test('landscape and desktop keep their layout', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?scene=mort');
  await expect(page.locator('.board.mine')).toBeVisible();
  await expect(page.locator('.table.compact')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.table-root.wide')).toBeVisible();
  await expect(page.locator('.table.compact')).toHaveCount(0);
});
