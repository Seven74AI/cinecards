import { expect, test, type Page } from '@playwright/test';
import { openHand } from './hand.ts';

/**
 * Story 13.10 (demo scenes « Mise en avant » and « Carte retirée »). Dev scene `?scene=retrait`: Le Grimoire holds
 * only Tank; on its turn it plays it (spotlight), Tank's "À l'arrivée" effect sends my Lancelot back to my hand
 * (stamp, blinking slot, red alert, highlighted journal line).
 */

const starts = (page: Page) => page.evaluate(() => (window.__ccBeats ?? []).filter((b) => b.phase === 'start').map((b) => ({ type: b.type, t: b.t })));

async function foePlaysTank(page: Page) {
  await page.goto('/?scene=retrait');
  await page.waitForSelector('.table');
  await page.getByRole('button', { name: /Fin du tour/i }).click();
}

test('the foe’s card is shown in the spotlight, then its effect, then the alert about my card', async ({ page }) => {
  await foePlaysTank(page);
  const spot = page.locator('.fx-spot');
  await expect(spot).toBeVisible({ timeout: 15000 });
  await expect(spot.locator('.who')).toHaveText('Le Grimoire pose Tank');
  await expect(spot.locator('.lab')).toHaveText("À l'arrivée");
  await expect(spot.locator('.q')).toContainText('Opérateur ?!');
  await expect(spot.locator('.tx')).toContainText('renvoyez-les dans la main');
  await expect(spot.locator('.skip')).toHaveText('Touchez pour passer');
  await expect(page.locator('.fx-spot-card [aria-label="Tank"]')).toBeVisible();
  // the stamp on my card, then the alert naming the card, the destination, the ability and the source
  await expect(page.locator('.fx-stamp')).toHaveText('RENVOYÉE', { timeout: 15000 });
  await expect(page.locator('.board.mine .card.removed-glow')).toHaveCount(1);
  const alert = page.locator('.fx-removed');
  await expect(alert).toBeVisible({ timeout: 5000 });
  await expect(alert).toContainText('Votre carte a quitté la table');
  await expect(alert).toContainText('Sire Lancelot le Brave');
  await expect(alert).toContainText('renvoyée dans votre main');
  await expect(alert).toContainText('Opérateur ?!');
  await expect(alert).toContainText('(Tank, adversaire)');
  await expect(page.locator('.fx-ghost-slot')).toHaveCount(1);
  // the order: spotlight → card played → its effect → stamp → card leaves + alert
  const b = await starts(page);
  const at = (type: string) => b.findIndex((x) => x.type === type);
  expect(at('spotlight')).toBeGreaterThanOrEqual(0);
  expect(at('spotlight')).toBeLessThan(at('cardPlayed'));
  expect(at('cardPlayed')).toBeLessThan(at('abilityUsed'));
  expect(at('abilityUsed')).toBeLessThan(at('removalStamp'));
  expect(at('removalStamp')).toBeLessThan(at('removalAlert'));
  expect(at('returnedToHand')).toBeLessThan(at('removalAlert'));
  // the spotlight holds the table about 4.5 s at normal speed (entry 0.85 s + 3 s of text)
  expect(b[at('cardPlayed')]!.t - b[at('spotlight')]!.t).toBeGreaterThan(3800);
  // the alert stays about 4 s, then goes
  await expect(alert).toHaveCount(0, { timeout: 6000 });
});

test('a tap skips the spotlight', async ({ page }) => {
  await page.goto('/?scene=pose');
  await page.waitForSelector('.table');
  await page.waitForTimeout(1500);
  await openHand(page);
  await page.locator('.hand .card[aria-label^="Missile"]').press('Enter');
  await page.getByRole('button', { name: /^Jouer/ }).first().click();
  const spot = page.locator('.fx-spot');
  await expect(spot).toBeVisible();
  await expect(spot.locator('.who')).toHaveText('Vous jouez un sort');
  await expect(spot.locator('.lab')).toHaveText('Sort · Effet');
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => performance.now());
  await spot.locator('.panel').click();
  await expect(spot).toHaveCount(0, { timeout: 1000 });
  const b = await starts(page);
  const played = b.find((x) => x.type === 'cardPlayed');
  expect(played).toBeTruthy();
  expect(played!.t - before).toBeLessThan(500);
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('the alert shows on the desktop table and the journal line stands out', async ({ page }) => {
    await foePlaysTank(page);
    await expect(page.locator('.fx-spot')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.fx-removed')).toContainText('Votre carte a quitté la table', { timeout: 15000 });
    await expect(page.locator('.journal-list li.removed')).toHaveText(/Sire Lancelot le Brave/);
  });
});
