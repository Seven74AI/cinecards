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
  await patsy.getByRole('button', { name: '« Au galop ! »' }).click();
  const arthur = page.getByRole('dialog', { name: /Arthur/ });
  await expect(arthur).toBeVisible();
  await expect(arthur.locator('.ability.is-highlighted')).toContainText('Au galop !');
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
