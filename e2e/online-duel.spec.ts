import { expect, test } from '@playwright/test';

test('two friends play an online duel from an invitation link', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();

  await alice.goto('/');
  await alice.getByRole('tab', { name: 'En ligne' }).click();
  await alice.getByLabel('Ton pseudo').fill('Alice');
  await alice.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const code = (await alice.locator('.big-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);

  await bob.goto(`/?salle=${code}`);
  await bob.getByLabel('Ton pseudo').fill('Bob');
  await bob.getByRole('button', { name: 'Rejoindre' }).click();

  await expect(alice.locator('.banner')).toBeVisible();
  await expect(bob.locator('.banner')).toBeVisible();
  await expect(alice.locator('.room-code')).toContainText(code);

  // whoever starts ends the turn; the other player sees it is their turn
  const aliceStarts = await alice.getByRole('button', { name: 'Fin du tour' }).isEnabled();
  const [first, second] = aliceStarts ? [alice, bob] : [bob, alice];
  await expect(second.locator('.banner')).toContainText('Tour de');
  await first.getByRole('button', { name: 'Fin du tour' }).click();
  await expect(second.locator('.banner')).toContainText('Ton tour');
  await expect(first.locator('.banner')).toContainText('Tour de');

  // the opponent's hand is hidden: only card backs
  await expect(first.locator('.foe-hand .card-back').first()).toBeVisible();

  // quitting concedes: the other player wins
  await first.getByRole('button', { name: 'Quitter' }).click();
  await first.locator('.overlay').getByRole('button', { name: 'Quitter' }).click();
  await expect(second.locator('.end')).toContainText('Victoire');
});
