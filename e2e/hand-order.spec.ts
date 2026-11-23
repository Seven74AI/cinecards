import { expect, test } from '@playwright/test';
import { openHand } from './hand.ts';

/**
 * Story 14.5 (Root): the cards I can play come first in my hand, then the others, each group in draw order, on every
 * layout. Dev scene `?scene=tri`: 5 coins and the hand Smith (13), Patsy (1), Néo (10), Camelot (3) in draw order.
 */
for (const size of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test(`hand order on ${size.name}: playable cards first, then the others, each in draw order`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/?scene=tri');
    await openHand(page);
    const cards = page.locator('.table .hand .card');
    await expect(cards).toHaveCount(4);
    const names = await cards.evaluateAll((els) => els.map((e) => e.querySelector('.card-name')?.textContent?.trim() ?? ''));
    expect(names[0]).toMatch(/Patsy/);
    expect(names[1]).toMatch(/Camelot/);
    expect(names[2]).toMatch(/Smith/);
    expect(names[3]).toMatch(/Néo/);
    await expect(cards.nth(0)).toHaveClass(/is-ready/);
    await expect(cards.nth(2)).toHaveClass(/is-disabled/);
  });
}
