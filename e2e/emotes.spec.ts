import { expect, test, type Page } from '@playwright/test';

/** Story 8.5: fixed emotes in an online duel, shown 3 s near the sender's portrait, with a mute switch. */
test('emotes: send, see for 3 s, then mute the opponent', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();

  await alice.goto('/');
  await alice.getByRole('tab', { name: 'En ligne' }).click();
  await alice.getByLabel('Ton pseudo').fill('Alice');
  await alice.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const code = (await alice.locator('.big-code').textContent())!.trim();
  await bob.goto(`/?salle=${code}`);
  await bob.getByLabel('Ton pseudo').fill('Bob');
  await bob.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(alice.locator('.banner')).toBeVisible();
  await expect(bob.locator('.banner')).toBeVisible();

  const send = async (page: Page, text: string) => {
    await page.getByRole('button', { name: 'Répliques' }).click();
    const list = page.getByRole('dialog', { name: 'Répliques' });
    await expect(list.getByRole('button')).toHaveCount(8);
    await list.getByRole('button', { name: text }).click();
    await expect(list).toHaveCount(0); // the list closes
  };

  // Alice (seat 0) sends; Bob sees it near Alice's portrait, Alice near her own
  await send(alice, 'Bien joué !');
  const bobSees = bob.locator('.emote-bubble[data-emote-from="0"]');
  await expect(bobSees).toHaveText('Bien joué !');
  await expect(alice.locator('.emote-bubble[data-emote-from="0"]')).toHaveText('Bien joué !');
  await expect(bobSees).toHaveCSS('pointer-events', 'none');
  // the button is greyed for 3 s
  await expect(alice.getByRole('button', { name: 'Répliques' })).toHaveClass(/cooling/);
  // gone after about 3 s
  await expect(bobSees).toHaveCount(0, { timeout: 4500 });

  // Bob mutes Alice's emotes (the switch is kept on the device)
  await bob.getByRole('button', { name: 'Répliques' }).click();
  const sw = bob.getByRole('switch', { name: 'Couper les répliques adverses' });
  await sw.check();
  await expect(sw).toBeChecked();
  await bob.keyboard.press('Escape');
  expect(await bob.evaluate(() => localStorage.getItem('cinecards.muteEmotes'))).toBe('1');

  await expect(alice.getByRole('button', { name: 'Répliques' })).not.toHaveClass(/cooling/);
  await send(alice, 'Revanche ?');
  await expect(alice.locator('.emote-bubble[data-emote-from="0"]')).toHaveText('Revanche ?');
  await bob.waitForTimeout(800);
  await expect(bob.locator('.emote-bubble')).toHaveCount(0);

  // Bob's own emote still shows on both sides
  await send(bob, 'Merci !');
  await expect(alice.locator('.emote-bubble[data-emote-from="1"]')).toHaveText('Merci !');
  await expect(bob.locator('.emote-bubble[data-emote-from="1"]')).toHaveText('Merci !');
});

test('emotes are not offered in a local game', async ({ page }) => {
  await page.goto('/?scene=mort'); // a dev scene runs a local session
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Répliques' })).toHaveCount(0);
});
