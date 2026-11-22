import { expect, test } from '@playwright/test';

/**
 * Story 13.12: smooth animations on phones. Dev scene `?scene=mort` on the portrait phone (390 × 844): Topper
 * Harley kills the Knights who say "Ni!".
 */
const NI = 'Les Chevaliers qui disent « Ni ! »';

test('?fps shows a frame counter (average and lowest over a second); without it, nothing', async ({ page }) => {
  await page.goto('/?scene=mort&fps');
  await expect(page.locator('.fps-meter')).toHaveText(/^\d+ i\/s · min \d+$/, { timeout: 5000 });
  await page.goto('/?scene=mort');
  await expect(page.locator('.table')).toBeVisible();
  await expect(page.locator('.fps-meter')).toHaveCount(0);
});

test('the ambient effects pause while an action plays, and the phone table runs fewer of them', async ({ page }) => {
  await page.goto('/?scene=mort');
  await expect(page.locator('.table-root.phone')).toBeVisible();
  // fewer embers on the portrait phone, slower runes, no candle flicker
  const shown = await page.locator('.ember').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').length);
  expect(shown).toBe(6);
  expect(await page.locator('.slot .rune-ring').first().evaluate((e) => getComputedStyle(e).animationDuration)).toBe('90s');
  // let the opening (turn banner) end
  await expect(page.locator('html')).not.toHaveClass(/cc-playing/, { timeout: 8000 });
  expect(await page.locator('.slot .rune-ring').first().evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('running');

  await page.locator('.board.mine').getByRole('button', { name: 'Topper Harley' }).click();
  await page.getByRole('button', { name: 'Choisir une cible' }).click();
  // a target pulses through a light veil (opacity), no longer through an animated filter
  const target = page.locator('.board.theirs').getByRole('button', { name: NI });
  expect(await target.evaluate((e) => getComputedStyle(e, '::after').animationName)).toBe('targetPulse');
  expect(await target.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  await target.click();
  await expect(page.locator('html')).toHaveClass(/cc-playing/);
  expect(await page.locator('.slot .rune-ring').first().evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('paused');
  expect(await page.locator('.ember').first().evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('paused');
  await expect(target).toBeHidden({ timeout: 6000 });
  await expect(page.locator('html')).not.toHaveClass(/cc-playing/, { timeout: 6000 });
  expect(await page.locator('.slot .rune-ring').first().evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('running');
});

test('no looping animation moves a filter, a box-shadow or a clip-path', async ({ page }) => {
  await page.goto('/?scene=pose');
  await expect(page.locator('.table')).toBeVisible();
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const sheet of [...document.styleSheets]) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r of [...rules]) {
        if (!(r instanceof CSSKeyframesRule)) continue;
        for (const k of [...r.cssRules] as CSSKeyframeRule[]) {
          for (const p of ['filter', 'box-shadow', 'clip-path']) if (k.style.getPropertyValue(p)) out.push(`${r.name}: ${p}`);
        }
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
});
