import { expect, test } from '@playwright/test';

/**
 * Story 12.5: cards travel. Dev scene `?scene=mort` (my turn, four characters in hand, Le Grimoire plays next).
 */

test('a played card flies from the hand and lands in its slot with a ring of runes', async ({ page }) => {
  await page.goto('/?scene=mort');
  const card = page.locator('.hand .card').first();
  const name = (await card.getAttribute('aria-label'))!;
  await card.press('Enter');
  // follow the card in its slot, frame by frame, from the moment it appears on the board. Sampling is bounded by
  // time, not by a frame count: under CPU load (parallel e2e) frames get rarer and a fixed count overran the timeout.
  await page.evaluate((n) => {
    const w = window as unknown as { __ccFly: { t: number; y: number }[]; __ccRune: boolean; __ccDone: boolean };
    w.__ccFly = [];
    w.__ccRune = false;
    w.__ccDone = false;
    let start = 0;
    const tick = (now: number) => {
      const el = document.querySelector(`.board.mine [aria-label="${n}"]`);
      const slot = el?.closest('.slot');
      if (el && slot) {
        if (!start) start = now;
        w.__ccFly.push({ t: now - start, y: el.getBoundingClientRect().top - slot.getBoundingClientRect().top });
      }
      if (document.querySelector('.fx-rune')) w.__ccRune = true;
      // the flight lasts ~1.1 s on the portrait phone (story 13.11); keep watching well past the landing
      if (start && now - start > 2200 && w.__ccFly.length >= 10) w.__ccDone = true;
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, name);
  await page.getByRole('button', { name: /^Jouer/ }).first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ccDone: boolean }).__ccDone), { timeout: 20_000 }).toBe(true);
  const { fly, rune } = await page.evaluate(() => {
    const w = window as unknown as { __ccFly: { t: number; y: number }[]; __ccRune: boolean };
    return { fly: w.__ccFly, rune: w.__ccRune };
  });
  const ys = fly.map((f) => f.y);
  // it started far below its slot (in the hand), went through the air, and ended in place (overshooting landing)
  expect(Math.max(...fly.filter((f) => f.t < 250).map((f) => f.y))).toBeGreaterThan(60);
  expect(Math.min(...ys)).toBeLessThan(-5);
  expect(Math.abs(ys.at(-1)!)).toBeLessThan(2);
  expect(rune).toBe(true);
  const beats = await page.evaluate(() => (window.__ccBeats ?? []).map((b) => b.type));
  expect(beats).toContain('cardPlayed');
});

test('draws: the foe gets a card back, my drawn card stays hidden until it turns over in my hand', async ({ page }) => {
  // story 13.10: the foe's spells and "À l'arrivée" cards are shown in the spotlight first, its turn takes longer
  test.setTimeout(120_000);
  await page.goto('/?scene=mort');
  await page.evaluate(() => {
    const w = window as unknown as { __ccBack: number; __ccHidden: string[] };
    w.__ccBack = 0;
    w.__ccHidden = [];
    new MutationObserver((list) => {
      for (const m of list) {
        for (const n of m.addedNodes) if (n instanceof HTMLElement && n.classList.contains('fx-back')) w.__ccBack++;
        const t = m.target as HTMLElement;
        if (m.type === 'attributes' && t.closest?.('.hand') && t.style.opacity === '0' && t.dataset.iid && !w.__ccHidden.includes(t.dataset.iid)) w.__ccHidden.push(t.dataset.iid);
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  });
  const before = await page.locator('.hand .card').count();
  const endTurn = page.getByRole('button', { name: 'Fin du tour' });
  // under load the first press can land before the table takes input: press until the turn has really passed
  await expect(async () => {
    if (await endTurn.isEnabled()) await endTurn.click();
    await expect(endTurn).toBeDisabled({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  // Le Grimoire's turn, then mine again: more cards in my hand
  await expect(page.getByRole('button', { name: 'Fin du tour' })).toBeEnabled({ timeout: 90000 });
  await expect.poll(() => page.locator('.hand .card').count(), { timeout: 15_000 }).toBeGreaterThan(before);
  // (the buttons follow the real state: the replay of the draws may still be running)
  const seen = () =>
    page.evaluate(() => {
      const w = window as unknown as { __ccBack: number; __ccHidden: string[] };
      return { back: w.__ccBack, hidden: w.__ccHidden.length };
    });
  await expect.poll(async () => (await seen()).back, { timeout: 15_000 }).toBeGreaterThanOrEqual(2); // the foe's draw and mine start as a card back
  expect((await seen()).hidden).toBeGreaterThanOrEqual(1);
  // in the end every card of my hand is shown
  await expect(page.locator('.hand .card[style*="opacity: 0"]')).toHaveCount(0, { timeout: 15_000 });
  const beats = await page.evaluate(() => (window.__ccBeats ?? []).filter((b) => b.type === 'cardDrawn').length);
  expect(beats).toBeGreaterThanOrEqual(2);
});
