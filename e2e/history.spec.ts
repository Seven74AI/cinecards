import { expect, test, type Browser, type Page } from '@playwright/test';

/** Story 8.4: each account's history shows the online game it just played. */

const API = `http://localhost:${process.env.E2E_SERVER_PORT ?? 2567}`;

type Acc = { token: string; id: number; nickname: string };

const newAccount = async (prefix: string): Promise<Acc> => {
  const nickname = `${prefix}${Date.now() % 1e6}`;
  const r = await fetch(`${API}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, password: 'motdepasse' }),
  });
  const body = (await r.json()) as {
    token: string;
    account: { id: number; nickname: string };
  };
  return { token: body.token, id: body.account.id, nickname };
};

const online = async (page: Page, a: Acc) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'En ligne' }).click();
  await expect(page.locator('.account-line')).toContainText(`Connecté : ${a.nickname}`);
};

const signedInPage = async (browser: Browser, a: Acc): Promise<Page> => {
  const ctx = await browser.newContext();
  await ctx.addInitScript((s) => localStorage.setItem('cinecards.account', s), JSON.stringify({ token: a.token, nickname: a.nickname, id: a.id }));
  const page = await ctx.newPage();
  await online(page, a);
  return page;
};

const panel = (page: Page) => page.getByRole('dialog', { name: 'Historique' });

test('two accounts play online; each history shows the result and the opponent', async ({ browser }) => {
  const a = await newAccount('Hia');
  const b = await newAccount('Hib');
  const alice = await signedInPage(browser, a);
  const bob = await signedInPage(browser, b);

  // nothing yet
  await alice.getByRole('button', { name: 'Historique' }).click();
  await expect(panel(alice)).toContainText('Aucune partie en ligne pour l’instant.');
  await panel(alice).getByRole('button', { name: 'Fermer' }).click();

  // a duel, ended by "Abandonner"
  await alice.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const room = (await alice.locator('.big-code').textContent())!.trim();
  await bob.getByLabel('Code de la salle').fill(room);
  await bob.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(bob.locator('.banner')).toBeVisible();
  await alice.getByRole('button', { name: 'Quitter' }).click();
  await alice.locator('.overlay').getByRole('button', { name: 'Abandonner' }).click();
  await alice.locator('.overlay').getByRole('button', { name: 'Abandonner' }).click();
  await expect(bob.locator('.end')).toContainText('Victoire');

  // Bob: a win by concession against Alice
  await online(bob, b);
  await bob.getByRole('button', { name: 'Historique' }).click();
  const bobGame = panel(bob).locator('.history-item').first();
  await expect(bobGame).toContainText('Victoire · abandon adverse');
  await expect(bobGame).toContainText(`contre ${a.nickname}`);
  await expect(bobGame).toContainText('Pioche commune');
  await expect(bobGame.locator('.result-dot.win')).toBeVisible();
  await expect(panel(bob).locator('.history-record .win dd')).toHaveText('1');

  // Alice: her concession against Bob
  await online(alice, a);
  await alice.getByRole('button', { name: 'Historique' }).click();
  const aliceGame = panel(alice).locator('.history-item').first();
  await expect(aliceGame).toContainText('Abandon');
  await expect(aliceGame).toContainText(`contre ${b.nickname}`);
  await expect(aliceGame.locator('.result-dot.loss')).toBeVisible();
  await expect(panel(alice).locator('.history-record .loss dd')).toHaveText('1');
  await expect(panel(alice).locator('.history-item')).toHaveCount(1);
});
