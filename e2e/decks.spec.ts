import { expect, test, type Browser, type Page } from '@playwright/test';

/** Story 10.2: "Mes decks" and the deck builder (mockup B), decks saved on the account. */

const API = `http://localhost:${process.env.E2E_SERVER_PORT ?? 2567}`;

type Acc = { token: string; id: number; nickname: string };

const newAccount = async (prefix: string): Promise<Acc> => {
  const nickname = `${prefix}${Date.now() % 1e6}`;
  const r = await fetch(`${API}/api/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, password: 'motdepasse' }) });
  const body = (await r.json()) as { token: string; account: { id: number; nickname: string } };
  return { token: body.token, id: body.account.id, nickname };
};

const signedInPage = async (browser: Browser, a: Acc): Promise<Page> => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((s) => localStorage.setItem('cinecards.account', s), JSON.stringify({ token: a.token, nickname: a.nickname, id: a.id }));
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('tab', { name: 'En ligne' }).click();
  await expect(page.locator('.account-line')).toContainText(`Connecté : ${a.nickname}`);
  return page;
};

test('build a deck with filters, save it, copy it and delete it', async ({ browser }) => {
  const a = await newAccount('Deck');
  const page = await signedInPage(browser, a);

  await page.locator('.account-line').getByRole('button', { name: 'Mes decks' }).click();
  await expect(page.getByRole('heading', { name: 'Mes decks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouveau deck' })).toBeVisible();
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();

  // filter by film: Matrix only
  const grid = page.getByRole('list', { name: 'Cartes' });
  await page.getByRole('button', { name: /^Filtres/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Filtres' });
  await sheet.getByLabel('Chercher un film').fill('matr');
  await sheet.getByText('Matrix', { exact: true }).click();
  await expect(sheet.getByRole('button', { name: /^Voir \d+ cartes$/ })).toBeVisible();
  await sheet.getByRole('button', { name: /^Voir \d+ cartes$/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: 'Filtres · 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retirer le filtre Film : Matrix' })).toBeVisible();
  const matrixCount = await grid.getByRole('listitem').count();
  expect(matrixCount).toBeGreaterThan(5);
  expect(matrixCount).toBeLessThan(40);

  // tap = add, the gold check appears, the bar counts; tap again = remove
  await grid.getByRole('button', { name: 'Ajouter Tank' }).click();
  await expect(grid.getByRole('button', { name: 'Retirer Tank' })).toBeVisible();
  await expect(page.locator('.deck-cell.in .deck-mark.in')).toHaveCount(1);
  await expect(page.locator('.deck-dock')).toContainText('1 / 50');
  await expect(page.locator('.deck-dock')).toContainText('Il manque 49 cartes');
  await grid.getByRole('button', { name: /^Ajouter / }).first().click();
  await expect(page.locator('.deck-dock')).toContainText('2 / 50');
  await grid.getByRole('button', { name: 'Retirer Tank' }).click();
  await expect(page.locator('.deck-dock')).toContainText('1 / 50');

  // search without accents
  await page.getByRole('button', { name: 'Retirer le filtre Film : Matrix' }).click();
  await page.getByLabel('Rechercher une carte').fill('NEO');
  await expect(grid.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Effacer la recherche' }).click();

  // add every card but one: 50 / 50, "Valide"
  const adds = grid.getByRole('button', { name: /^Ajouter / });
  for (let n = 1; n < 50; n++) await adds.first().click();
  await expect(page.locator('.deck-dock')).toContainText('50 / 50');
  await expect(page.locator('.deck-dock')).toContainText('Valide');
  await expect(adds).toHaveCount(1);

  // "Voir le deck": the sheet groups the cards; touching one removes it
  await page.getByRole('button', { name: 'Voir le deck ›' }).click();
  const deckSheet = page.getByRole('dialog', { name: 'Mon deck' });
  await expect(deckSheet.getByRole('region', { name: 'Personnages' })).toBeVisible();
  await deckSheet.getByRole('button', { name: /^Retirer .* du deck$/ }).first().click();
  await expect(deckSheet).toContainText('Il manque 1 carte');
  await deckSheet.getByRole('button', { name: 'Afficher en liste' }).click();
  await expect(deckSheet.locator('.deck-row').first()).toBeVisible();
  await deckSheet.getByRole('button', { name: 'Fermer' }).click();
  await adds.first().click();
  await expect(page.locator('.deck-dock')).toContainText('Valide');

  // rename and save; the server sends the status back
  await page.getByLabel('Nom du deck').fill('Les élus de Sion');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.deck-toast')).toContainText('Deck enregistré');

  // a change, then back: "Quitter sans enregistrer ?"
  await page.getByLabel('Nom du deck').fill('Autre nom');
  await page.getByRole('button', { name: 'Retour à Mes decks' }).click();
  const leave = page.getByRole('alertdialog', { name: 'Quitter sans enregistrer ?' });
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Quitter' }).click();

  const item = page.getByRole('article', { name: 'Les élus de Sion' });
  await expect(item).toContainText('50 / 50');
  await expect(item).toContainText('Valide');
  await expect(page.getByRole('article', { name: 'Autre nom' })).toHaveCount(0);

  // copy, then delete the copy with confirmation
  await item.getByRole('button', { name: 'Copier Les élus de Sion' }).click();
  const copy = page.getByRole('article', { name: 'Les élus de Sion (copie)' });
  await expect(copy).toContainText('Valide');
  await copy.getByRole('button', { name: 'Supprimer Les élus de Sion (copie)' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Supprimer ce deck ?' });
  await expect(confirm).toContainText('« Les élus de Sion (copie) » sera supprimé de ton compte.');
  await confirm.getByRole('button', { name: 'Annuler' }).click();
  await expect(copy).toBeVisible();
  await copy.getByRole('button', { name: 'Supprimer Les élus de Sion (copie)' }).click();
  await confirm.getByRole('button', { name: 'Supprimer' }).click();
  await expect(copy).toHaveCount(0);
  await expect(item).toBeVisible();

  // saved on the account: the server lists it as valid
  const listed = (await (await fetch(`${API}/api/decks`, { headers: { Authorization: `Bearer ${a.token}` } })).json()) as { decks: { name: string; valid: boolean; cards: string[] }[] };
  expect(listed.decks).toEqual([expect.objectContaining({ name: 'Les élus de Sion', valid: true })]);
  expect(listed.decks[0]!.cards).toHaveLength(50);

  // back to the home screen
  await page.getByRole('button', { name: 'Retour au menu' }).click();
  await expect(page.locator('.account-line')).toContainText(`Connecté : ${a.nickname}`);
  await page.context().close();
});

test('the builder fits a 360 × 640 phone and a long press opens the card sheet', async ({ browser }) => {
  const a = await newAccount('Petit');
  const page = await signedInPage(browser, a);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.locator('.account-line').getByRole('button', { name: 'Mes decks' }).click();
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  await expect(page.locator('.deck-grid .deck-cell').first()).toBeVisible();
  // no horizontal overflow; only the grid scrolls
  const sizes = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, screen: document.querySelector('.deck-screen')!.scrollWidth, grid: document.querySelector('.deck-grid')!.scrollWidth, gridClient: document.querySelector('.deck-grid')!.clientWidth }));
  expect(sizes.doc).toBeLessThanOrEqual(360);
  expect(sizes.screen).toBeLessThanOrEqual(360);
  expect(sizes.grid).toBeLessThanOrEqual(sizes.gridClient);
  // three columns
  const xs = await page.locator('.deck-grid .deck-cell').evaluateAll((els) => els.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(xs[0]).toBe(xs[2]);
  expect(xs[3]).toBeGreaterThan(xs[0]!);
  // the last row clears the bottom bar once scrolled to the end
  await page.locator('.deck-grid').evaluate((g) => g.scrollTo(0, g.scrollHeight));
  const last = await page.locator('.deck-grid .deck-cell').last().boundingBox();
  const dock = await page.locator('.deck-dock').boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(dock!.y);
  // long press = the card sheet, without adding the card
  const first = page.locator('.deck-grid .deck-cell').first();
  await first.scrollIntoViewIfNeeded();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.locator('aside.sheet[role="dialog"]')).toBeVisible();
  await expect(page.locator('.deck-dock')).toContainText('0 / 50');
  await page.context().close();
});
