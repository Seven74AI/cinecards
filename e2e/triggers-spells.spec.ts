import { expect, test, type Page } from '@playwright/test';
import { openHand } from './hand.ts';

/**
 * Story 12.6: who triggers what. Dev scene `?scene=pose`: the homing missile, Camelot and the A.P.U unit in hand,
 * Topper and Lancelot (Holy Grail) on my side, the Knights who say "Ni!" and the Black Knight on the foe's.
 */

/** Records the effect layers that appear (class names and texts). */
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

async function play(page: Page, name: string) {
  await openHand(page);
  await page.locator(`.hand .card[aria-label^="${name}"]`).press('Enter');
  await page.getByRole('button', { name: /^Jouer/ }).first().click();
}

test('a spell burns, its label shows, then a projectile reaches the target, in order', async ({ page }) => {
  await page.goto('/?scene=pose');
  await watchFx(page);
  await play(page, 'Missile');
  await expect.poll(async () => (await fx(page)).some((f) => f.cls.includes('fx-num')), { timeout: 12000 }).toBe(true);
  const seen = await fx(page);
  const at = (pred: (f: { cls: string; text: string }) => boolean) => seen.find(pred)?.t ?? Infinity;
  const card = at((f) => f.cls.includes('fx-card'));
  const tag = at((f) => f.cls.includes('fx-tag') && f.text.startsWith('Effet · « '));
  const orb = at((f) => f.cls.includes('fx-orb'));
  const hit = at((f) => f.cls.includes('fx-num'));
  expect(card).toBeLessThan(tag);
  expect(tag).toBeLessThanOrEqual(orb);
  expect(orb).toBeLessThan(hit);
  const beats = await page.evaluate(() => (window.__ccBeats ?? []).filter((b) => b.phase === 'start').map((b) => b.type));
  expect(beats.indexOf('cardPlayed')).toBeLessThan(beats.indexOf('abilityUsed'));
  expect(beats.indexOf('abilityUsed')).toBeLessThan(beats.indexOf('damageDealt'));
});

test('a terrain: "À l’arrivée" label over it, and a wave over the cards of its family', async ({ page }) => {
  await page.goto('/?scene=pose');
  await watchFx(page);
  await play(page, 'Camelot');
  await expect.poll(async () => (await fx(page)).some((f) => f.cls.includes('fx-tint') && f.cls.includes('family')), { timeout: 12000 }).toBe(true);
  const seen = await fx(page);
  expect(seen.some((f) => f.cls.includes('fx-seal'))).toBe(true);
  expect(seen.some((f) => f.cls.includes('fx-tag') && f.text.startsWith('À l'))).toBe(true);
  // the wave covers Lancelot (Holy Grail) only, not Topper (Hot Shots!)
  expect(seen.filter((f) => f.cls.includes('family'))).toHaveLength(1);
});
