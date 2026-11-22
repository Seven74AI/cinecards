import { expect, test, type Page } from '@playwright/test';

/**
 * Story 8.2: passkeys (Face ID, fingerprint, device code) and the recovery code, with Chromium's virtual
 * authenticator (CDP). The e2e origin is http://localhost:<port>, which WebAuthn accepts without HTTPS.
 */

/** A platform authenticator with discoverable keys that always says yes. */
const authenticator = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { credentials: async () => (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials };
};

const online = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'En ligne' }).click();
};

const dialog = (page: Page) => page.getByRole('dialog');

const takeRecoveryCode = async (page: Page) => {
  const d = dialog(page);
  const code = (await d.locator('.recovery-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
  await d.getByLabel('J’ai noté mon code').check();
  await d.getByRole('button', { name: 'Continuer' }).click();
  await expect(d).toHaveCount(0);
  return code;
};

const passkeyLogin = async (page: Page) => {
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await dialog(page).getByRole('button', { name: 'Se connecter avec une clé d’accès' }).click();
};

test('create an account with a passkey, sign in without a nickname, manage keys and password, recover with a new key', async ({ browser }) => {
  const nick = `Cle-${Date.now() % 1e6}`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await online(page);
  const device = await authenticator(page);

  // create: nickname, then the device; no password; the recovery code is shown once
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await dialog(page).getByLabel('Pseudo').fill(nick);
  await dialog(page).getByRole('button', { name: 'Avec une clé d’accès (recommandé)' }).click();
  const firstCode = await takeRecoveryCode(page);
  await expect(page.locator('.account-line')).toContainText(`Connecté : ${nick}`);
  const creds = await device.credentials();
  expect(creds).toHaveLength(1);
  expect(creds[0]!.isResidentCredential).toBe(true);

  // the nickname is taken now, by a passkey account too
  const other = await (await browser.newContext()).newPage();
  await online(other);
  await authenticator(other);
  await other.getByRole('button', { name: 'Créer un compte' }).click();
  await dialog(other).getByLabel('Pseudo').fill(nick.toLowerCase());
  await dialog(other).getByRole('button', { name: 'Avec une clé d’accès (recommandé)' }).click();
  await expect(dialog(other)).toContainText('Ce pseudo est déjà pris.');

  // sign out, then back in with the key: no nickname typed
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByLabel('Ton pseudo')).toBeVisible();
  await passkeyLogin(page);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.account-line')).toContainText(`Connecté : ${nick}`);

  // "Mon compte": one key, no password; the last way in cannot be removed
  await page.getByRole('button', { name: 'Mon compte' }).click();
  const panel = dialog(page);
  await expect(panel.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  await expect(panel.locator('.passkey-item')).toHaveCount(1);
  await expect(panel.locator('.passkey-item')).toContainText('utilisée le');
  await panel.getByRole('button', { name: 'Retirer' }).click();
  await expect(panel).toContainText('C’est ta seule façon de te connecter : ajoute d’abord une autre clé ou un mot de passe.');
  await expect(panel.locator('.passkey-item')).toHaveCount(1);

  // choose a password, then the key can go (with a confirmation)
  await panel.getByRole('button', { name: 'Choisir un mot de passe' }).click();
  await panel.getByLabel('Nouveau mot de passe').fill('motdepasse');
  await panel.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await expect(panel).toContainText('Mot de passe enregistré.');
  await expect(panel.getByRole('button', { name: 'Changer le mot de passe' })).toBeVisible();
  await panel.getByRole('button', { name: 'Retirer' }).click();
  await panel.getByRole('button', { name: 'Oui, retirer' }).click();
  await expect(panel).toContainText('Clé d’accès retirée.');
  await expect(panel.locator('.passkey-item')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Fermer' }).click();

  // the removed key no longer signs in; the password does
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await passkeyLogin(page);
  await expect(dialog(page)).toContainText('Cette clé d’accès n’est plus liée à un compte.');
  await dialog(page).getByLabel('Pseudo').fill(nick);
  await dialog(page).getByLabel('Mot de passe', { exact: true }).fill('motdepasse');
  await dialog(page).getByRole('button', { name: 'Me connecter' }).click();
  await expect(page.locator('.account-line')).toContainText(`Connecté : ${nick}`);

  // add a key again from "Mon compte"
  await page.getByRole('button', { name: 'Mon compte' }).click();
  await panel.getByRole('button', { name: 'Ajouter une clé d’accès' }).click();
  await expect(panel).toContainText('Clé d’accès ajoutée.');
  await expect(panel.locator('.passkey-item')).toHaveCount(1);
  await expect(panel.locator('.passkey-item')).toContainText('jamais utilisée');
  await panel.getByRole('button', { name: 'Fermer' }).click();

  // key lost: another device (a new authenticator) gets a new key with the recovery code
  const ctx2 = await browser.newContext();
  const phone = await ctx2.newPage();
  await online(phone);
  const device2 = await authenticator(phone);
  await phone.getByRole('button', { name: 'Se connecter' }).click();
  await dialog(phone).getByRole('button', { name: 'Mot de passe ou clé perdus ?' }).click();
  await dialog(phone).getByLabel('Pseudo').fill(nick);
  await dialog(phone).getByLabel('Code de secours').fill(firstCode);
  await dialog(phone).getByRole('button', { name: 'Nouvelle clé d’accès' }).click();
  const secondCode = await takeRecoveryCode(phone);
  expect(secondCode).not.toBe(firstCode);
  await expect(phone.locator('.account-line')).toContainText(`Connecté : ${nick}`);
  expect(await device2.credentials()).toHaveLength(1);

  // every other session was closed
  await page.reload();
  await page.getByRole('tab', { name: 'En ligne' }).click();
  await expect(page.getByLabel('Ton pseudo')).toBeVisible();

  // the new key signs in on that device; "Mon compte" lists both keys
  await phone.getByRole('button', { name: 'Se déconnecter' }).click();
  await passkeyLogin(phone);
  await expect(phone.locator('.account-line')).toContainText(`Connecté : ${nick}`);
  await phone.getByRole('button', { name: 'Mon compte' }).click();
  await expect(dialog(phone).locator('.passkey-item')).toHaveCount(2);
});
