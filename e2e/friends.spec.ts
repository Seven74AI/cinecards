import { expect, test, type Browser, type Page } from '@playwright/test';

/** Story 8.3: a friend list with live presence, and a direct invitation joined in one tap. */

const API = `http://localhost:${process.env.E2E_SERVER_PORT ?? 2567}`;

type Acc = { token: string; id: number; nickname: string };

const newAccount = async (prefix: string): Promise<Acc> => {
  const nickname = `${prefix}${Date.now() % 1e6}`;
  const r = await fetch(`${API}/api/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, password: 'motdepasse' }) });
  const body = (await r.json()) as { token: string; account: { id: number; nickname: string } };
  return { token: body.token, id: body.account.id, nickname };
};

/** A browser already signed in to the account (the session the client keeps in localStorage). */
const signedInPage = async (browser: Browser, a: Acc): Promise<Page> => {
  const ctx = await browser.newContext();
  await ctx.addInitScript((s) => localStorage.setItem('cinecards.account', s), JSON.stringify({ token: a.token, nickname: a.nickname, id: a.id }));
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('tab', { name: 'En ligne' }).click();
  await expect(page.locator('.account-line')).toContainText(`Connecté : ${a.nickname}`);
  return page;
};

const panel = (page: Page) => page.getByRole('dialog', { name: 'Amis' });

test('add a friend, see them online, invite them and play', async ({ browser }) => {
  const a = await newAccount('Ami');
  const b = await newAccount('Bff');
  const alice = await signedInPage(browser, a);
  const bob = await signedInPage(browser, b);

  // A asks B by nickname
  await alice.getByRole('button', { name: 'Amis', exact: true }).click();
  await expect(panel(alice)).toContainText('Ajoute un ami avec son pseudo.');
  await panel(alice).getByLabel('Pseudo d’un joueur').fill('Personne');
  await panel(alice).getByRole('button', { name: 'Ajouter' }).click();
  await expect(panel(alice)).toContainText('Aucun joueur ne porte ce pseudo.');
  await panel(alice).getByLabel('Pseudo d’un joueur').fill(b.nickname);
  await panel(alice).getByRole('button', { name: 'Ajouter' }).click();
  await expect(panel(alice)).toContainText(`Demande envoyée à ${b.nickname}.`);
  await expect(panel(alice).locator('.friend-item', { hasText: b.nickname })).toContainText('en attente');

  // B sees the request live (badge), accepts, and sees A in green
  await bob.getByRole('button', { name: 'Amis (1 demande)' }).click();
  await panel(bob).getByRole('button', { name: `Accepter ${a.nickname}` }).click();
  const aForB = panel(bob).locator('.friend-item', { hasText: a.nickname });
  await expect(aForB).toContainText('en ligne');
  await expect(aForB.locator('.presence-dot.online')).toBeVisible();

  // A's list follows; A invites B, B refuses
  const bForA = panel(alice).locator('.friend-item', { hasText: b.nickname });
  await expect(bForA).toContainText('en ligne');
  await bForA.getByRole('button', { name: `Inviter ${b.nickname}` }).click();
  await expect(alice.locator('.lobby')).toContainText(`Invitation envoyée à ${b.nickname}`);
  const toast = bob.locator('.invite-toast');
  await expect(toast).toContainText(`${a.nickname} t’invite à un duel`);
  await toast.getByRole('button', { name: 'Refuser' }).click();
  await expect(toast).toHaveCount(0);
  await expect(alice.locator('.lobby')).toContainText(`${b.nickname} a refusé.`);

  // A leaves that room and invites again; B joins in one tap, with the account's nickname
  await alice.locator('.lobby').getByRole('button', { name: 'Annuler' }).click();
  await alice.getByRole('tab', { name: 'En ligne' }).click();
  await alice.getByRole('button', { name: 'Amis', exact: true }).click();
  await panel(alice).getByRole('button', { name: `Inviter ${b.nickname}` }).click();
  await expect(alice.locator('.lobby')).toContainText(`Invitation envoyée à ${b.nickname}`);
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Rejoindre' }).click();
  for (const page of [alice, bob]) {
    await expect(page.locator('.banner')).toBeVisible();
    await expect(page.locator('.hero-name', { hasText: a.nickname })).toBeVisible();
    await expect(page.locator('.hero-name', { hasText: b.nickname })).toBeVisible();
  }
  await expect(bob.locator('.invite-toast')).toHaveCount(0);

  // B is "en partie" for A
  const list = (await (await fetch(`${API}/api/friends`, { headers: { Authorization: `Bearer ${a.token}` } })).json()) as { friends: { id: number; presence: string }[] };
  expect(list.friends).toEqual([expect.objectContaining({ id: b.id, presence: 'inGame' })]);

  await alice.getByRole('button', { name: 'Quitter' }).click();
  await alice.locator('.overlay').getByRole('button', { name: 'Abandonner' }).click();
  await alice.locator('.overlay').getByRole('button', { name: 'Abandonner' }).click();
  await expect(bob.locator('.end')).toContainText('Victoire');
});
