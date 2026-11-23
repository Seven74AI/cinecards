import type { Page } from '@playwright/test';

/**
 * Story 14.2: on the compact phone table (portrait, the e2e default 390 × 844) my hand is folded behind the fan
 * button of my banner. Opens it (when there is one and it is closed) so the hand cards can be played.
 */
export async function openHand(page: Page) {
  const btn = page.locator('.table .hand-btn');
  if ((await btn.count()) && (await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
}
