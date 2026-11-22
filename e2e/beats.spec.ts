import { expect, test, type Page } from '@playwright/test';

/**
 * Story 12.1: the table replays an event batch beat by beat. Dev test scene `?scene=mort`: Topper Harley
 * (150 ATQ) kills the Knights who say "Ni!" (150 PV). The dead card must stay in its slot until its death
 * animation ends, and the beats play in order: attack, damage, death.
 */
const NI = 'Les Chevaliers qui disent « Ni ! »';

async function attackNi(page: Page) {
  await page.locator('.board.mine').getByRole('button', { name: 'Topper Harley' }).click();
  await page.getByRole('button', { name: 'Choisir une cible' }).click();
  await page.locator('.board.theirs').getByRole('button', { name: NI }).click();
}

test('a destroyed card stays in its slot until its death animation ends', async ({ page }) => {
  await page.goto('/?scene=mort');
  const ni = page.locator('.board.theirs').getByRole('button', { name: NI });
  await expect(ni).toBeVisible();
  // watch the foe board: when does the card get its dying state, and when does it leave the DOM?
  await page.evaluate((name) => {
    const w = window as unknown as { __ccSeen: { dying?: number; gone?: number }; __ccBeats?: unknown[] };
    w.__ccSeen = {};
    w.__ccBeats = [];
    const board = document.querySelector('.board.theirs')!;
    const check = () => {
      const el = board.querySelector(`[aria-label="${name}"]`);
      if (el?.classList.contains('is-dying') && w.__ccSeen.dying === undefined) w.__ccSeen.dying = performance.now();
      if (!el && w.__ccSeen.gone === undefined) w.__ccSeen.gone = performance.now();
    };
    new MutationObserver(check).observe(board, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }, NI);

  await attackNi(page);
  await expect(ni).toHaveClass(/is-dying/);
  await expect(ni).toBeHidden({ timeout: 5000 });

  const { seen, beats } = await page.evaluate(() => {
    const w = window as unknown as { __ccSeen: { dying: number; gone: number }; __ccBeats: { type: string; phase: string; t: number }[] };
    return { seen: w.__ccSeen, beats: w.__ccBeats };
  });
  const at = (type: string, phase = 'start') => beats.find((b) => b.type === type && b.phase === phase)!.t;
  // beats in order
  expect(at('attackDeclared')).toBeLessThan(at('damageDealt'));
  expect(at('damageDealt')).toBeLessThan(at('cardDestroyed'));
  // the card was still there, dying, during its death beat, and left only when it ended
  expect(seen.dying).toBeGreaterThanOrEqual(at('cardDestroyed') - 1);
  expect(seen.gone).toBeGreaterThanOrEqual(at('cardDestroyed', 'end') - 1);
  expect(seen.gone - seen.dying).toBeGreaterThan(500);
});

test('instant speed: the result shows at once, and the setting is kept', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cinecards.animSpeed', 'instant'));
  await page.goto('/?scene=mort');
  await expect(page.getByRole('button', { name: /Vitesse des animations : instantanée/ })).toBeVisible();
  await attackNi(page);
  await expect(page.locator('.board.theirs').getByRole('button', { name: NI })).toHaveCount(0, { timeout: 300 });
  // cycling the setting goes back to normal speed and is stored
  await page.getByRole('button', { name: /Vitesse des animations/ }).click();
  await expect(page.getByRole('button', { name: /Vitesse des animations : normale/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cinecards.animSpeed'))).toBe('normal');
});
