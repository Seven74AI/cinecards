import { expect, test, type Page } from '@playwright/test';

/** Stories 11.4 / 11.5: targets are asked when the card arrives, with a "k / N" counter, "Valider" and "Aucune cible". */

// deterministic game: replace Math.random with a seeded generator before the app loads
const seeded = () => {
  let a = 12345;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

async function clearPopups(page: Page) {
  for (let i = 0; i < 5; i++) {
    if (await page.getByRole('button', { name: 'Je suis prêt·e' }).isVisible()) await page.getByRole('button', { name: 'Je suis prêt·e' }).click();
    else if (await page.getByRole('button', { name: 'Laisser passer' }).isVisible()) await page.getByRole('button', { name: 'Laisser passer' }).click();
    else if (await page.locator('.overlay .pick-grid').isVisible()) await page.locator('.overlay').getByRole('button', { name: 'Valider' }).click();
    else if (await page.getByText('Choisis un effet.').isVisible()) await page.locator('.overlay .target-list .btn').first().click();
    else return;
  }
}

test('hot seat: an arrival effect asks for up to N targets, and "Aucune cible" skips it', async ({ page }) => {
  await page.addInitScript(seeded);
  await page.goto('/');
  await page.getByRole('button', { name: 'Duel à deux sur ce téléphone' }).click();
  const banner = page.locator('.banner');
  for (let turn = 0; turn < 30; turn++) {
    await clearPopups(page);
    // try every affordable card in hand until one asks for targets
    for (let tries = 0; tries < 8; tries++) {
      await clearPopups(page);
      if (await banner.getByRole('button', { name: 'Valider' }).isVisible()) break;
      const card = page.locator('.hand .card.is-ready').first();
      if (!(await card.isVisible())) break;
      await card.click();
      const play = page.getByRole('button', { name: /^Jouer/ }).first();
      if (!(await play.isVisible()) || (await play.isDisabled())) break;
      await play.click();
    }
    await clearPopups(page);
    const confirm = banner.getByRole('button', { name: 'Valider' });
    if (await confirm.isVisible()) {
      await expect(banner).toContainText(/0 \/ \d/);
      const skip = banner.getByRole('button', { name: 'Aucune cible' });
      if (await skip.isVisible()) {
        await expect(confirm).toBeEnabled();
        await skip.click();
      } else {
        await page.locator('.card.is-target').first().click();
        await expect(banner).toContainText(/1 \/ \d/);
        if (await confirm.isDisabled()) await page.locator('.card.is-target').first().click();
        await confirm.click();
      }
      await expect(confirm).toBeHidden();
      return;
    }
    const end = page.getByRole('button', { name: 'Fin du tour' });
    if (await end.isEnabled()) await end.click();
  }
  throw new Error('no card asked for targets in 30 turns');
});
