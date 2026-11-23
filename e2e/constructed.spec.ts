import { mkdirSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

/** Story 10.3: choosing a saved deck for an online room, and for a solo game against Le Grimoire. */

const API = `http://localhost:${process.env.E2E_SERVER_PORT ?? 2567}`;
const SHOTS = '_bmad-output/implementation-artifacts/screens/10-3';

type Acc = { token: string; id: number; nickname: string };

let n = 0;
const newAccount = async (prefix: string): Promise<Acc> => {
  const nickname = `${prefix}${Date.now() % 1e5}${n++}`;
  const r = await fetch(`${API}/api/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, password: 'motdepasse' }) });
  const body = (await r.json()) as { token: string; account: { id: number; nickname: string } };
  return { token: body.token, id: body.account.id, nickname };
};

const saveDeck = async (a: Acc, name: string, cards: string[]) => {
  const r = await fetch(`${API}/api/decks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` }, body: JSON.stringify({ name, cards }) });
  const { deck } = (await r.json()) as { deck: { id: number; valid: boolean } };
  expect(deck.valid).toBe(true);
  return deck;
};

const signedInPage = async (browser: Browser, a: Acc): Promise<Page> => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => localStorage.setItem('cinecards.account', s), JSON.stringify({ token: a.token, nickname: a.nickname, id: a.id }));
  const page = await ctx.newPage();
  await page.goto('/');
  return page;
};

/** The client's own playable cards, read from the dev server's modules (no catalog endpoint on the server). */
const playable = async (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    const m = (await import(/* @vite-ignore */ '/src/game/catalog.ts')) as { PLAYABLE: string[] };
    return [...m.PLAYABLE].sort();
  });

test('two accounts play their own decks online; the guest picks theirs in the waiting room', async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const a = await newAccount('Ca');
  const b = await newAccount('Cb');
  const alice = await signedInPage(browser, a);
  const cards = await playable(alice);
  await saveDeck(a, 'Les élus', cards.slice(0, 50));
  await saveDeck(b, 'Graal', cards.slice(-50));
  await saveDeck(b, 'Bis', cards.slice(1));
  await alice.reload(); // the home screen reads the decks when it opens

  await alice.getByRole('tab', { name: 'En ligne' }).click();
  await expect(alice.locator('.account-line')).toContainText(`Connecté : ${a.nickname}`);
  const option = alice.getByRole('radio', { name: /Decks construits/ });
  await expect(option).toBeEnabled();
  await option.check();
  await expect(alice.getByLabel('Mon deck')).toHaveValue(/\d+/);
  await expect(alice.getByLabel('Mon deck').locator('option')).toHaveText(['Les élus']);
  await alice.screenshot({ path: `${SHOTS}/home-decks-construits.png` });
  await alice.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const code = (await alice.locator('.big-code').textContent())!.trim();
  await expect(alice.locator('.lobby-mode')).toHaveText('Pioche : Decks construits');
  await expect(alice.locator('.lobby-my-deck')).toContainText('Ton deck : Les élus');

  const bob = await signedInPage(browser, b);
  await bob.goto(`/?salle=${code}`);
  await expect(bob.locator('.account-line')).toContainText(`Connecté : ${b.nickname}`);
  await bob.getByRole('button', { name: 'Rejoindre' }).click();
  const choice = bob.getByRole('group', { name: 'Choisis ton deck' });
  await expect(choice).toBeVisible();
  await expect(choice.getByRole('radio')).toHaveCount(2);
  await expect(alice.locator('.lobby-deck')).toContainText(`En attente du deck de ${b.nickname}…`);
  await choice.getByRole('radio', { name: 'Graal' }).check();
  await bob.screenshot({ path: `${SHOTS}/lobby-choisis-ton-deck.png` });
  await choice.getByRole('button', { name: 'Jouer ce deck' }).click();

  await expect(alice.locator('.banner')).toBeVisible();
  await expect(bob.locator('.banner')).toBeVisible();
  // each player's own pile on the table: 50 cards minus the opening hand
  for (const page of [alice, bob]) {
    const me = page.locator('.table .hero').last();
    const hand = Number((await me.locator('[title="Main"]').textContent())!.trim());
    await expect(me.locator('[title="Pioche"]')).toHaveText(String(50 - hand));
  }
  await alice.getByRole('button', { name: 'Journal' }).click();
  await expect(alice.locator('.journal')).toContainText('La partie commence (decks construits).');
});

test('a guest cannot sit in a constructed room', async ({ browser }) => {
  const a = await newAccount('Ga');
  const alice = await signedInPage(browser, a);
  await saveDeck(a, 'Le mien', (await playable(alice)).slice(0, 50));
  await alice.reload();
  await alice.getByRole('tab', { name: 'En ligne' }).click();
  await alice.getByRole('radio', { name: /Decks construits/ }).check();
  await alice.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const code = (await alice.locator('.big-code').textContent())!.trim();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/?salle=${code}`);
  await guest.getByLabel('Ton pseudo').fill('Invité');
  await guest.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(guest.getByRole('alert')).toHaveText('Cette salle se joue en decks construits : connecte-toi et construis un deck valide.');
  await expect(alice.locator('.seats li.on')).toHaveCount(1);
});

test('without a valid deck the option is greyed with a link to "Mes decks"; solo plays my deck against Le Grimoire', async ({ browser }) => {
  const a = await newAccount('Sa');
  const page = await signedInPage(browser, a);
  const option = page.getByRole('radio', { name: /Decks construits/ });
  await expect(option).toBeDisabled();
  await expect(page.locator('.mode-hint')).toContainText('Construis d’abord un deck valide');
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/home-sans-deck-valide.png` });
  await page.locator('.modes').getByRole('button', { name: 'Mes decks' }).click();
  await expect(page.getByRole('heading', { name: 'Mes decks' })).toBeVisible();

  // a deck saved meanwhile: back on the home screen the option opens
  await saveDeck(a, 'Solo', (await playable(page)).slice(1));
  await page.getByRole('button', { name: 'Retour au menu' }).click();
  await expect(option).toBeEnabled();
  await option.check();
  // no constructed decks in hot seat
  await expect(page.getByRole('button', { name: 'Duel à deux sur ce téléphone' })).toBeDisabled();
  await page.getByRole('button', { name: 'S’entraîner contre le Grimoire' }).click();
  await expect(page.locator('.banner')).toBeVisible();
  // my own pile: 50 cards minus my hand (the Grimoire has its own 50)
  const me = page.locator('.table .hero').last();
  const hand = Number((await me.locator('[title="Main"]').textContent())!.trim());
  await expect(me.locator('[title="Pioche"]')).toHaveText(String(50 - hand));
  await page.getByRole('button', { name: 'Journal' }).click();
  await expect(page.locator('.journal')).toContainText('La partie commence (decks construits).');
  // the last deck chosen is remembered on this device
  expect(await page.evaluate(() => localStorage.getItem('cinecards.deck'))).toMatch(/^\d+$/);
});
