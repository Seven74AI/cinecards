import { expect, test, type Page } from '@playwright/test';

/**
 * Story 13.2: on a portrait phone the whole table fits in the screen height and every touch target is at least
 * 44 px. Dev scene `?scene=mort`: Topper Harley can attack the Knights who say "Ni!".
 * Story 13.6: the hand cards are fully in view and readable, no empty band is left, and attacker and target are
 * staged at the demo's size (100 px wide).
 * Story 14.1: no zoom any more; each side shows a "Terrains" row and a "Sorts" row of 5 slots (plates with the card's
 * name), above the characters for the foe and below for me. Dev scene `?scene=pleine`: a full table.
 * Story 14.2: no hand row any more. My hand is folded behind the fan button of my banner (badge: the number of cards)
 * and opens in a panel laid over the bottom of my side; the board does not move.
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
    // the parts that must be in view: both heroes, both sides, the banner
    bottoms: [...document.querySelectorAll('.table .hero, .table .side, .table .banner, .table .topbar')].map((e) => e.getBoundingClientRect().bottom),
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
  // no empty band: rows touch (a few px of gap), and my banner sits at the bottom (story 14.2: no hand row below it)
  for (const g of m.gaps) expect(g).toBeLessThanOrEqual(24);
  expect(m.inner - m.heroBottom).toBeLessThanOrEqual(24);
}

/**
 * Story 14.2: the open hand: whole cards in one row (no vertical scroll inside, readable), the row scrolls sideways
 * when the cards do not fit, the panel lies over the bottom of my side only and leaves its top row in view.
 */
async function openHandPanel(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.table .hand-panel')!.getBoundingClientRect();
    const row = document.querySelector('.table .hand-row')!;
    const side = document.querySelector('.side.mine')!.getBoundingClientRect();
    const firstSlot = document.querySelector('.side.mine .slot')!.getBoundingClientRect();
    return {
      panel: { top: panel.top, bottom: panel.bottom },
      side: { top: side.top, bottom: side.bottom },
      firstSlotBottom: firstSlot.bottom,
      scrollsX: row.scrollWidth > row.clientWidth + 1,
      scrollsY: row.scrollHeight > row.clientHeight + 1,
      cards: [...row.querySelectorAll('.card')].map((e) => {
        const r = e.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, w: r.width, name: parseFloat(getComputedStyle(e.querySelector('.card-name')!).fontSize) };
      }),
    };
  });
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
    // story 14.2: the cards of the open hand, and the fan button (40 px, touchable over 46 px through its ::after)
    for (const e of document.querySelectorAll('.table .hand-row .card')) {
      const r = e.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) out.push(`hand card ${e.getAttribute('aria-label')} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    const btn = document.querySelector('.table .hand-btn');
    if (!btn) out.push('no hand button');
    else {
      const r = btn.getBoundingClientRect();
      const a = getComputedStyle(btn, '::after');
      const w = r.width - 2 * parseFloat(a.left);
      const h = r.height - 2 * parseFloat(a.top);
      if (w < 44 || h < 44) out.push(`hand button ${Math.round(w)}×${Math.round(h)}`);
      const edges: [number, number][] = [
        [r.left - 2, r.top + r.height / 2],
        [r.left + r.width / 2, r.bottom + 2],
        [r.left + r.width / 2, r.top - 2],
      ];
      for (const [x, y] of edges) if (y < innerHeight && document.elementFromPoint(x, y)?.closest('.hand-btn') !== btn) out.push(`hand button edge ${x},${y}`);
    }
    // story 14.1: a terrain or spell plate is at least 44 px wide, and its touch area also covers the gaps around it
    // (a tap between two rows, or between a plate and the characters, still reaches a plate)
    for (const e of document.querySelectorAll('.table .zplate')) {
      const r = e.getBoundingClientRect();
      // a plate under the open hand (story 14.2) cannot be touched until the hand folds
      if (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.zplate') !== e) continue;
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
        for (const t of ['Pioche', 'Cimetière']) await expect(hero.locator(`[title="${t}"]`)).toBeVisible();
      }
      await expect(page.locator('.table .hero.active')).toHaveCount(1);
      await expect(page.locator('.table .hero').last()).toHaveClass(/active/);
      await expect(page.locator('.table .hero').first().locator('[title="Main"]')).toContainText('4');
      // story 14.2: my hand count is the badge of the fan button at the right end of my banner (not twice)
      const mine = page.locator('.table .hero').last();
      await expect(mine.locator('[title="Main"]')).toHaveCount(0);
      await expect(mine.locator('.hand-btn .hand-badge')).toHaveText('10');
      expect(await mine.evaluate((h) => h.lastElementChild!.classList.contains('hand-btn'))).toBe(true);
      await expect(page.locator('.table .hand')).toHaveCount(0);
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
      await page.locator('.table .hand-btn').click();
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

    test('the fan button opens my hand over my side, without moving the board, and closes it', async ({ page }) => {
      await page.goto('/?scene=pleine');
      const btn = page.locator('.table .hand-btn');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.table .hand')).toHaveCount(0);
      const rects = () =>
        page.evaluate(() => [...document.querySelectorAll('.table .side, .table .board, .table .hero, .table .banner')].map((e) => JSON.stringify(e.getBoundingClientRect())));
      const before = await rects();

      await btn.click();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await expect(btn).toHaveClass(/\bon\b/);
      const panel = page.getByRole('region', { name: 'Ta main' });
      await expect(panel).toBeVisible();
      await expect(panel.locator('.card')).toHaveCount(10);
      // no header, no close button: the same button closes it
      await expect(panel.locator('button:not(.card), h2, h3')).toHaveCount(0);
      expect(await rects()).toEqual(before);
      const m = await openHandPanel(page);
      // laid over the bottom of my side, inside it, leaving the top row of my characters in view
      expect(Math.abs(m.panel.bottom - m.side.bottom)).toBeLessThan(1);
      expect(m.panel.top).toBeGreaterThan(m.side.top);
      expect(m.firstSlotBottom).toBeLessThanOrEqual(m.panel.top + 1);
      // whole cards on one line, sideways scroll (10 cards), none vertically
      expect(m.scrollsX).toBe(true);
      expect(m.scrollsY).toBe(false);
      for (const c of m.cards) {
        expect(c.top).toBeGreaterThanOrEqual(m.panel.top);
        expect(c.bottom).toBeLessThanOrEqual(m.panel.bottom);
        expect(c.w).toBeGreaterThanOrEqual(size.width < 380 ? 72 : 110);
        expect(c.name).toBeGreaterThanOrEqual(8);
      }
      expect(new Set(m.cards.map((c) => Math.round(c.top))).size).toBe(1);
      // a swipe shows the last cards
      await page.locator('.hand-row').evaluate((e) => e.scrollTo({ left: e.scrollWidth }));
      await expect(panel.locator('.card').last()).toBeInViewport({ ratio: 0.9 });
      await noVerticalScroll(page);
      await touchTargets(page);

      await btn.click();
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.table .hand')).toHaveCount(0);
      expect(await rects()).toEqual(before);
    });

    test('a card of the open hand opens its sheet; "Jouer" folds the hand while the card is placed', async ({ page }) => {
      await page.goto('/?scene=mort');
      const btn = page.locator('.table .hand-btn');
      const count = Number(await btn.locator('.hand-badge').textContent());
      await btn.click();
      const card = page.locator('.hand-panel .card').first();
      const name = (await card.getAttribute('aria-label'))!;
      await card.click();
      await expect(page.locator('aside.sheet[role="dialog"]')).toBeVisible();
      await page.getByRole('button', { name: /^Jouer/ }).first().click();
      await expect(page.locator('.table .hand')).toHaveCount(0);
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.board.mine').getByRole('button', { name })).toBeVisible();
      await expect(btn.locator('.hand-badge')).toHaveText(String(count - 1));
    });
  });
}

test('the hand stays folded when I draw: the card flies to the fan button and its badge pops', async ({ page }) => {
  test.setTimeout(120_000);
  // where each flying card back ends its flight (its last keyframe), and whether the badge popped; read from the
  // animations themselves, so a slow frame rate under load cannot miss them
  await page.addInitScript(() => {
    const w = window as unknown as { __ccDraw: { ends: { x: number; y: number }[]; pop: boolean } };
    w.__ccDraw = { ends: [], pop: false };
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, frames: Keyframe[] | PropertyIndexedKeyframes | null, opts?: number | KeyframeAnimationOptions) {
      if (this.classList.contains('hand-badge')) w.__ccDraw.pop = true;
      if (this.classList.contains('fx-back') && Array.isArray(frames)) {
        const m = String(frames.at(-1)?.transform ?? '').match(/calc\(-50% \+ (-?[\d.e-]+)px\), calc\(-50% \+ (-?[\d.e-]+)px\)/);
        const el = this as HTMLElement;
        if (m) w.__ccDraw.ends.push({ x: parseFloat(el.style.left) + Number(m[1]), y: parseFloat(el.style.top) + Number(m[2]) });
      }
      return orig.call(this, frames, opts);
    };
  });
  await page.goto('/?scene=mort');
  const btn = page.locator('.table .hand-btn');
  const before = Number(await btn.locator('.hand-badge').textContent());
  const endTurn = page.getByRole('button', { name: 'Fin du tour' });
  await expect(async () => {
    if (await endTurn.isEnabled()) await endTurn.click();
    await expect(endTurn).toBeDisabled({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(endTurn).toBeEnabled({ timeout: 90_000 });
  await expect.poll(async () => Number(await btn.locator('.hand-badge').textContent()), { timeout: 15_000 }).toBeGreaterThan(before);
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.table .hand')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ccDraw: { pop: boolean } }).__ccDraw.pop), { timeout: 15_000 }).toBe(true);
  // my drawn card's back ends its flight on the fan button (Le Grimoire may also send a card back to my hand first)
  const box = (await btn.boundingBox())!;
  const onButton = () =>
    page.evaluate(
      (c) => (window as unknown as { __ccDraw: { ends: { x: number; y: number }[] } }).__ccDraw.ends.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 4),
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
  await expect.poll(onButton, { timeout: 20_000 }).toBe(true);
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
});

test('hot seat: the fan button belongs to the player at the bottom, the hand folds when the device changes hands', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Duel à deux sur ce téléphone' }).click();
  const ready = page.getByRole('button', { name: 'Je suis prêt·e' });
  if (await ready.isVisible()) await ready.click();
  const btn = page.locator('.table .hand-btn');
  await expect(btn).toHaveCount(1);
  await expect(page.locator('.table .hero').last().locator('.hand-btn')).toHaveCount(1);
  await btn.click();
  await expect(page.locator('.hand-panel .card').first()).toBeVisible();
  const ids = () => page.locator('.hand-panel .card').evaluateAll((els) => els.map((e) => e.getAttribute('data-iid')).join());
  const first = await ids();
  await page.getByRole('button', { name: 'Fin du tour' }).click();
  await expect(ready).toBeVisible();
  await ready.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.table .hand')).toHaveCount(0);
  await btn.click();
  await expect(page.locator('.hand-panel .card').first()).toBeVisible();
  expect(await ids()).not.toEqual(first);
});

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
