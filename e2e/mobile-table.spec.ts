import { expect, test, type Page } from '@playwright/test';

/**
 * Story 13.2: on a portrait phone the whole table fits in the screen height and every touch target is at least
 * 44 px. Dev scene `?scene=mort`: Topper Harley can attack the Knights who say "Ni!".
 * Story 13.6: the hand cards are fully in view and readable, no empty band is left, and attacker and target are
 * staged at the demo's size (100 px wide).
 * Story 14.1: no zoom any more; each side shows a "Terrains" row and a "Sorts" row of 5 slots (plates with the card's
 * name), above the characters for the foe and below for me. Dev scene `?scene=pleine`: a full table.
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
    const els = document.querySelectorAll('.table .topbar button, .table .banner button, .table .board .slot');
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
    // story 14.1: a terrain or spell plate is at least 44 px wide, and its touch area also covers the gaps around it
    // (a tap between two rows, or between a plate and the characters, still reaches a plate)
    for (const e of document.querySelectorAll('.table .zplate')) {
      const r = e.getBoundingClientRect();
      if (r.width < 44 || r.height < 18) out.push(`plate ${e.getAttribute('aria-label')} ${Math.round(r.width)}×${Math.round(r.height)}`);
      const row = e.closest('.zrow')!;
      const other = row.nextElementSibling ?? row.previousElementSibling;
      const gapY = other && other.classList.contains('zrow') ? (row.nextElementSibling === other ? r.bottom + 1 : r.top - 1) : null;
      if (gapY !== null && document.elementFromPoint(r.left + r.width / 2, gapY)?.closest('.zplate, .zempty') == null) out.push(`gap of ${e.getAttribute('aria-label')}`);
    }
    return out;
  });
  expect(small).toEqual([]);
}

/** Story 14.1: the terrain and spell rows of a side, in screen order, and where they sit around the characters. */
async function sideRows(page: Page, side: 'mine' | 'theirs') {
  return page.locator(`.side.${side}`).evaluate((el) => {
    const board = el.querySelector('.board')!.getBoundingClientRect();
    return [...el.querySelectorAll('.zrow')].map((row) => {
      const r = row.getBoundingClientRect();
      return {
        kind: row.classList.contains('terrains') ? 'terrains' : 'spells',
        label: row.querySelector('.zl')!.getAttribute('aria-label'),
        cells: row.querySelectorAll('.zg > *').length,
        plates: [...row.querySelectorAll('.zplate')].map((p) => p.textContent),
        above: r.bottom <= board.top + 1,
      };
    });
  });
}

for (const size of SIZES) {
  test.describe(`${size.width} × ${size.height}`, () => {
    test.use({ viewport: size });

    test('both sides whole, with their terrain and spell rows, without vertical scroll', async ({ page }) => {
      await page.goto('/?scene=mort');
      await expect(page.locator('.table.compact')).toBeVisible();
      await expect(page.locator('.side.theirs .slot')).toHaveCount(10);
      await expect(page.locator('.side.mine .slot')).toHaveCount(10);
      // no zoom, no fold, no "agrandir", no "Vue d'ensemble"
      await expect(page.getByRole('button', { name: /Agrandir/ })).toHaveCount(0);
      await expect(page.getByText('agrandir')).toHaveCount(0);
      await expect(page.getByText('Vue d’ensemble')).toHaveCount(0);
      await expect(page.locator('.side.is-zoomed, .side.is-folded')).toHaveCount(0);
      await noVerticalScroll(page);
      await touchTargets(page);

      // the full table: rows of 5, terrains outermost, the foe's above its characters and mine below
      await page.goto('/?scene=pleine');
      await expect(page.locator('.table.compact')).toBeVisible();
      expect(await sideRows(page, 'theirs')).toEqual([
        { kind: 'terrains', label: 'Terrains', cells: 5, plates: ['Camelot', 'Le porte-avions'], above: true },
        { kind: 'spells', label: 'Sorts', cells: 5, plates: ['Fuyez ! Fuyez !'], above: true },
      ]);
      expect(await sideRows(page, 'mine')).toEqual([
        { kind: 'spells', label: 'Sorts', cells: 5, plates: ['Ça pisse tu m\'étonnes', 'Unité A.P.U'], above: false },
        { kind: 'terrains', label: 'Terrains', cells: 5, plates: ['La Matrice'], above: false },
      ]);
      // both banners: initial, name, HP bar, HP, coins and cap, hand, deck, graveyard; the active one stands out
      for (const hero of await page.locator('.table .hero').all()) {
        await expect(hero.locator('.avatar')).toHaveText(/^[A-Z]$/);
        await expect(hero.locator('.hero-name')).not.toBeEmpty();
        await expect(hero.locator('.hpbar')).toBeVisible();
        await expect(hero.locator('.hero-hp')).toContainText('700');
        await expect(hero.locator('.hero-coins')).toContainText('10/10');
        for (const t of ['Main', 'Pioche', 'Cimetière']) await expect(hero.locator(`[title="${t}"]`)).toBeVisible();
      }
      await expect(page.locator('.table .hero.active')).toHaveCount(1);
      await expect(page.locator('.table .hero').last()).toHaveClass(/active/);
      await expect(page.locator('.table .hero').first().locator('[title="Main"]')).toContainText('4');
      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollHeight,
        inner: innerHeight,
        bottoms: [...document.querySelectorAll('.table .hero, .table .side, .table .banner, .table .topbar')].map((e) => e.getBoundingClientRect().bottom),
      }));
      expect(m.doc).toBeLessThanOrEqual(m.inner);
      for (const b of m.bottoms) expect(b).toBeLessThanOrEqual(m.inner);
      await touchTargets(page);

      // a plate opens its card's sheet
      await page.locator('.side.theirs .zplate', { hasText: 'Camelot' }).click();
      await expect(page.locator('aside.sheet[role="dialog"]')).toBeVisible();
    });

    test('picking an attacker does not zoom; the instruction bar is the turn banner', async ({ page }) => {
      await page.goto('/?scene=mort');
      await page.locator('.board.mine').getByRole('button', { name: 'Topper Harley' }).click();
      await page.getByRole('button', { name: 'Choisir une cible' }).click();
      await expect(page.locator('.banner.consigne')).toContainText('Topper Harley attaque');
      await expect(page.locator('.side.is-zoomed, .side.is-folded')).toHaveCount(0);
      await noVerticalScroll(page);
      await touchTargets(page);

      // follow the on-screen width of the attacker and its target while the attack plays
      await page.evaluate((name) => {
        const w = window as unknown as { __ccW: { att: number; tgt: number } };
        w.__ccW = { att: 0, tgt: 0 };
        const att = document.querySelector('.board.mine [aria-label="Topper Harley"]')!;
        const tgt = document.querySelector(`.board.theirs [aria-label="${name}"]`)!;
        const t0 = performance.now();
        const tick = () => {
          w.__ccW.att = Math.max(w.__ccW.att, att.getBoundingClientRect().width);
          if (tgt.isConnected) w.__ccW.tgt = Math.max(w.__ccW.tgt, tgt.getBoundingClientRect().width);
          if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, NI);
      await page.locator('.board.theirs').getByRole('button', { name: NI }).click();
      await expect(page.locator('.board.theirs').getByRole('button', { name: NI })).toHaveCount(0, { timeout: 5000 });
      await noVerticalScroll(page);
      const seen = await page.evaluate(() => (window as unknown as { __ccW: { att: number; tgt: number } }).__ccW);
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
