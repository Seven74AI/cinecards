import { expect, test, type Page } from '@playwright/test';

/** Story 8.1: an account with a nickname and a password, usable from any device, with a recovery code. */

const online = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'En ligne' }).click();
};

const dialog = (page: Page) => page.getByRole('dialog');

/** Reads the recovery code shown once, ticks "J'ai noté mon code" and continues. */
const takeRecoveryCode = async (page: Page) => {
  const d = dialog(page);
  const code = (await d.locator('.recovery-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
  await expect(d.getByRole('button', { name: 'Copier' })).toBeVisible();
  await expect(d.getByRole('button', { name: 'Imprimer' })).toBeVisible();
  const go = d.getByRole('button', { name: 'Continuer' });
  await expect(go).toBeDisabled();
  await d.getByLabel('J’ai noté mon code').check();
  await go.click();
  await expect(d).toHaveCount(0);
  return code;
};

const logIn = async (page: Page, nickname: string, password: string) => {
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const d = dialog(page);
  await d.getByLabel('Pseudo').fill(nickname);
  await d.getByLabel('Mot de passe', { exact: true }).fill(password);
  await d.getByRole('button', { name: 'Me connecter' }).click();
};

const recoverWith = async (page: Page, nickname: string, code: string, password: string) => {
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const d = dialog(page);
  await d.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
  await d.getByLabel('Pseudo').fill(nickname);
  await d.getByLabel('Code de secours').fill(code);
  await d.getByLabel('Nouveau mot de passe').fill(password);
  await d.getByRole('button', { name: 'Changer le mot de passe' }).click();
};

test('create an account, play under its nickname, log in elsewhere and reset the password', async ({ browser }) => {
  const nick = `Test-${Date.now() % 1e6}`;
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();

  // create the account: the recovery code is shown once
  await online(alice);
  await alice.getByRole('button', { name: 'Créer un compte' }).click();
  await dialog(alice).getByLabel('Pseudo').fill(nick);
  await dialog(alice).getByLabel('Mot de passe', { exact: true }).fill('court');
  await dialog(alice).getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(dialog(alice)).toContainText('8 caractères au moins.');
  await dialog(alice).getByLabel('Mot de passe', { exact: true }).fill('motdepasse');
  await dialog(alice).getByRole('button', { name: 'Créer mon compte' }).click();
  const firstCode = await takeRecoveryCode(alice);
  await expect(alice.locator('.account-line')).toContainText(`Connecté : ${nick}`);
  await expect(alice.getByLabel('Ton pseudo')).toHaveCount(0);

  // the session survives a reload
  await alice.reload();
  await alice.getByRole('tab', { name: 'En ligne' }).click();
  await expect(alice.locator('.account-line')).toContainText(nick);

  // the guest opponent sees the account's nickname
  await alice.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const room = (await alice.locator('.big-code').textContent())!.trim();
  await bob.goto(`/?salle=${room}`);
  await bob.getByLabel('Ton pseudo').fill('Bob');
  await bob.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(bob.locator('.banner')).toBeVisible();
  await expect(bob.locator('.hero-name', { hasText: nick })).toBeVisible();
  await alice.getByRole('button', { name: 'Quitter' }).click();
  await alice.locator('.overlay').getByRole('button', { name: 'Abandonner' }).click();
  await alice.locator('.overlay').getByRole('button', { name: 'Abandonner' }).click();
  await expect(bob.locator('.end')).toContainText('Victoire');

  // log out: back to the guest field
  await online(alice);
  await alice.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(alice.getByLabel('Ton pseudo')).toBeVisible();
  await alice.reload();
  await alice.getByRole('tab', { name: 'En ligne' }).click();
  await expect(alice.getByLabel('Ton pseudo')).toBeVisible();

  // another device: a wrong password, then the right one (case of the nickname does not matter)
  const carol = await (await browser.newContext()).newPage();
  await online(carol);
  await logIn(carol, nick.toLowerCase(), 'pasleboncode');
  await expect(dialog(carol)).toContainText('Pseudo ou mot de passe incorrect.');
  await dialog(carol).getByLabel('Mot de passe', { exact: true }).fill('motdepasse');
  await dialog(carol).getByRole('button', { name: 'Me connecter' }).click();
  await expect(dialog(carol)).toHaveCount(0);
  await expect(carol.locator('.account-line')).toContainText(`Connecté : ${nick}`);
  await carol.getByRole('button', { name: 'Se déconnecter' }).click();

  // forgotten password: the recovery code sets a new one and is replaced
  await recoverWith(carol, nick, firstCode.toLowerCase().replaceAll('-', ''), 'nouveaumdp');
  const secondCode = await takeRecoveryCode(carol);
  expect(secondCode).not.toBe(firstCode);
  await expect(carol.locator('.account-line')).toContainText(nick);
  await carol.getByRole('button', { name: 'Se déconnecter' }).click();

  // the old code no longer works; the new password does
  await recoverWith(carol, nick, firstCode, 'encoreunautre');
  await expect(dialog(carol)).toContainText('Pseudo ou code de secours incorrect.');
  await dialog(carol).getByRole('button', { name: 'Annuler' }).click();
  await logIn(carol, nick, 'nouveaumdp');
  await expect(carol.locator('.account-line')).toContainText(nick);
});
