import { expect, test } from '@playwright/test';

/** Story 11.3: the 75 s turn timer runs in solo and hot seat too. */

test('hot seat: the timer starts when the device is handed over, alerts at 10 s and ends the turn', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Duel à deux sur ce téléphone' }).click();
  const first = (await page.locator('.handoff h2').textContent())!;
  // nothing runs while the pass-the-device screen is up
  await page.clock.runFor(30_000);
  await page.getByRole('button', { name: 'Je suis prêt·e' }).click();
  const timer = page.getByRole('timer');
  await expect(timer).toContainText('75s');
  await page.clock.runFor(66_000);
  await expect(timer).toContainText('9s');
  await expect(timer).toHaveClass(/low/);
  await page.clock.runFor(10_000);
  // time is up: the turn passes to the other player
  await expect(page.locator('.handoff h2')).toBeVisible();
  await expect(page.locator('.handoff h2')).not.toHaveText(first);
});

test('solo: the timer is shown with an hourglass', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'S’entraîner contre le Grimoire' }).click();
  await expect(page.getByRole('timer')).toContainText(/\d+s/);
  await expect(page.getByRole('timer').locator('svg')).toBeVisible();
});
