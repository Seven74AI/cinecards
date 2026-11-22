import { expect, test } from '@playwright/test';

/** Story 11.8: keyword bubbles, references between cards, and the "Règles et mots-clés" screen. */

test('rules screen lists the glossary, including Barrage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Règles et mots-clés' }).click();
  const rules = page.getByRole('dialog', { name: 'Règles et mots-clés' });
  await expect(rules.getByRole('heading', { name: 'Combat' })).toBeVisible();
  await expect(rules.getByText('Barrage', { exact: true })).toBeVisible();
  await expect(rules.getByText(/vos PV ne peuvent pas être attaqués/)).toBeVisible();
  await rules.getByRole('button', { name: 'Fermer' }).last().click();
  await expect(rules).toBeHidden();
});

test('a keyword shows its definition and « Au galop ! » opens Arthur', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Voir les \d+ cartes/ }).click();
  await page.locator('.collection').getByRole('button', { name: 'Patsy', exact: true }).click();
  const patsy = page.getByRole('dialog', { name: 'Patsy' });
  await patsy.getByRole('button', { name: 'hâte' }).click();
  await expect(patsy.locator('.kw-bubble')).toContainText('Peut attaquer dès le tour où il est posé.');
  // story 13.1: a cited card opens a preview over the sheet, which stays open underneath
  await patsy.getByRole('button', { name: '« Au galop ! »' }).click();
  const preview = page.getByRole('dialog', { name: 'Aperçu : Arthur, roi des Bretons' });
  await expect(preview).toBeVisible();
  await expect(preview.locator('.ability.is-highlighted')).toContainText('Au galop !');
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(patsy).toBeVisible();
  // "Arthur", unquoted, is a link too; "Voir la fiche" opens the full sheet, closing it goes back to Patsy
  await patsy.getByRole('button', { name: 'Arthur', exact: true }).click();
  await preview.getByRole('button', { name: 'Voir la fiche' }).click();
  const arthur = page.getByRole('dialog', { name: 'Arthur, roi des Bretons' });
  await expect(arthur).toBeVisible();
  await arthur.getByRole('button', { name: 'Fermer' }).last().click();
  await expect(arthur).toBeHidden();
  await expect(patsy).toBeVisible();
});

test('in a game, a cited card in play glows on the table; a tap outside closes the preview', async ({ page }) => {
  await page.goto('/?scene=renvois');
  await page.locator('.board.mine').getByRole('button', { name: 'Patsy' }).click();
  const sheet = page.getByRole('dialog', { name: 'Patsy' });
  await sheet.getByRole('button', { name: 'Arthur', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Aperçu : Arthur, roi des Bretons' });
  await expect(preview).toBeVisible();
  await expect(page.locator('.board.mine .slot.ref-glow')).toHaveCount(1);
  await expect(page.locator('.board.mine .slot.ref-glow').getByRole('button', { name: 'Arthur, roi des Bretons' })).toBeVisible();
  await page.mouse.click(5, 420);
  await expect(preview).toBeHidden();
  await expect(page.locator('.ref-glow')).toHaveCount(0);
  await expect(sheet).toBeVisible();
});

test('in a game, the ability label explains its trigger', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Duel à deux sur ce téléphone' }).click();
  const ready = page.getByRole('button', { name: 'Je suis prêt·e' });
  if (await ready.isVisible()) await ready.click();
  await expect(page.getByRole('button', { name: 'Règles et mots-clés' })).toBeVisible();
  await page.locator('.hand .card').first().click();
  const tag = page.locator('.sheet .kw-tag').first();
  if (await tag.isVisible()) {
    await tag.click();
    await expect(page.locator('.sheet .kw-bubble')).toBeVisible();
  }
});
