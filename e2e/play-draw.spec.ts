import { expect, test } from '@playwright/test';

/**
 * Story 12.5: cards travel. Dev scene `?scene=mort` (my turn, four characters in hand, Le Grimoire plays next).
 */

test('a played card flies from the hand and lands in its slot with a ring of runes', async ({ page }) => {
  await page.goto('/?scene=mort');
  const card = page.locator('.hand .card').first();
  const name = (await card.getAttribute('aria-label'))!;
  await card.press('Enter');
  // follow the card in its slot, frame by frame, from the moment it appears on the board
  await page.evaluate((n) => {
    const w = window as unknown as { __ccFly: number[]; __ccRune: boolean };
    w.__ccFly = [];
    w.__ccRune = false;
    const tick = () => {
      const el = document.querySelector(`.board.mine [aria-label="${n}"]`);
      const slot = el?.closest('.slot');
      if (el && slot) w.__ccFly.push(el.getBoundingClientRect().top - slot.getBoundingClientRect().top);
      if (document.querySelector('.fx-rune')) w.__ccRune = true;
      if (w.__ccFly.length < 150) requestAnimationFrame(tick);
    };
    tick();
  }, name);
  await page.getByRole('button', { name: /^Jouer/ }).first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ccFly: number[] }).__ccFly.length), { timeout: 5000 }).toBeGreaterThanOrEqual(150);
  const { fly, rune } = await page.evaluate(() => {
    const w = window as unknown as { __ccFly: number[]; __ccRune: boolean };
    return { fly: w.__ccFly, rune: w.__ccRune };
  });
  // it started far below its slot (in the hand), went through the air, and ended in place (story 13.11: ~1.1 s on
  // the portrait phone, with an overshooting landing, so it is followed for 150 frames)
  expect(Math.max(...fly.slice(0, 5))).toBeGreaterThan(60);
  expect(Math.min(...fly)).toBeLessThan(-5);
  expect(Math.abs(fly.at(-1)!)).toBeLessThan(2);
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
  await page.getByRole('button', { name: 'Fin du tour' }).click();
  // Le Grimoire's turn, then mine again: more cards in my hand
  await expect(page.getByRole('button', { name: 'Fin du tour' })).toBeEnabled({ timeout: 90000 });
  await expect.poll(() => page.locator('.hand .card').count(), { timeout: 5000 }).toBeGreaterThan(before);
  // (the buttons follow the real state: the replay of the draws may still be running)
  const seen = () =>
    page.evaluate(() => {
      const w = window as unknown as { __ccBack: number; __ccHidden: string[] };
      return { back: w.__ccBack, hidden: w.__ccHidden.length };
    });
  await expect.poll(async () => (await seen()).back, { timeout: 5000 }).toBeGreaterThanOrEqual(2); // the foe's draw and mine start as a card back
  expect((await seen()).hidden).toBeGreaterThanOrEqual(1);
  // in the end every card of my hand is shown
  await expect(page.locator('.hand .card[style*="opacity: 0"]')).toHaveCount(0, { timeout: 3000 });
  const beats = await page.evaluate(() => (window.__ccBeats ?? []).filter((b) => b.type === 'cardDrawn').length);
  expect(beats).toBeGreaterThanOrEqual(2);
});
