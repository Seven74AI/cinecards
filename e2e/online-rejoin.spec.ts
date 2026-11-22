import { expect, test, type Page } from '@playwright/test';

/** Story 11.2: leaving an online duel, by button or by closing the tab, keeps the seat for 90 s. */

const joinByCode = async (page: Page, code: string, nickname: string) => {
  await page.getByRole('tab', { name: 'En ligne' }).click();
  await page.getByLabel('Ton pseudo').fill(nickname);
  await page.getByLabel('Code de la salle').fill(code);
  await page.getByRole('button', { name: 'Rejoindre' }).click();
};

const quit = async (page: Page) => {
  await page.getByRole('button', { name: 'Quitter' }).click();
  await expect(page.locator('.overlay')).toContainText('Tu pourras revenir pendant 90 s');
  await page.locator('.overlay').getByRole('button', { name: 'Quitter' }).click();
  await expect(page.getByRole('tab', { name: 'En ligne' })).toBeVisible();
};

test('host and guest leave and come back by code, link and new tab', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  let host = await hostCtx.newPage();
  const guest = await (await browser.newContext()).newPage();

  // a waiting room survives its host leaving
  await host.goto('/');
  await host.getByRole('tab', { name: 'En ligne' }).click();
  await host.getByLabel('Ton pseudo').fill('Alice');
  await host.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const code = (await host.locator('.big-code').textContent())!.trim();
  await host.getByRole('button', { name: 'Annuler' }).click();
  await joinByCode(host, code, 'Alice');
  await expect(host.locator('.big-code')).toHaveText(code);

  await guest.goto(`/?salle=${code}`);
  await guest.getByLabel('Ton pseudo').fill('Bob');
  await guest.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(host.locator('.banner')).toBeVisible();
  await expect(guest.locator('.banner')).toBeVisible();

  // play one turn so there is a state to find again
  const hostStarts = await host.getByRole('button', { name: 'Fin du tour' }).isEnabled();
  await (hostStarts ? host : guest).getByRole('button', { name: 'Fin du tour' }).click();
  await expect((hostStarts ? guest : host).locator('.banner')).toContainText('Ton tour');
  const hostBanner = (await host.locator('.banner-text strong').textContent())!;
  const hostHand = await host.locator('.hand > *').count();

  // host quits (no forfeit) and comes back by typing the code
  await quit(host);
  await expect(guest.locator('.toast.info')).toContainText('Alice');
  await joinByCode(host, code, 'Alice');
  await expect(host.locator('.banner-text strong')).toHaveText(hostBanner);
  await expect(host.locator('.hand > *')).toHaveCount(hostHand);
  await expect(guest.locator('.toast.info')).toHaveCount(0);

  // guest quits and comes back through the invitation link
  await quit(guest);
  await guest.goto(`/?salle=${code}`);
  await guest.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(guest.locator('.banner')).toBeVisible();
  await expect(guest.locator('.room-code')).toContainText(code);

  // host closes the tab and resumes from a new tab of the same browser
  await host.close();
  await expect(guest.locator('.toast.info')).toContainText('Alice');
  host = await hostCtx.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: `Reprendre la partie en ligne (salle ${code})` }).click();
  await expect(host.locator('.banner-text strong')).toHaveText(hostBanner);
  await expect(guest.locator('.toast.info')).toHaveCount(0);

  // the game goes on: the active player ends the turn
  const active = (await host.getByRole('button', { name: 'Fin du tour' }).isEnabled()) ? host : guest;
  const idle = active === host ? guest : host;
  await active.getByRole('button', { name: 'Fin du tour' }).click();
  await expect(idle.locator('.banner')).toContainText('Ton tour');
});

test('join errors tell an unknown room from a full one', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await joinByCode(page, 'ZZZZZ', 'Carl');
  await expect(page.getByRole('alert')).toContainText('Aucune salle ne porte ce code');

  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto('/');
  await a.getByRole('tab', { name: 'En ligne' }).click();
  await a.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const code = (await a.locator('.big-code').textContent())!.trim();
  await b.goto(`/?salle=${code}`);
  await b.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(b.locator('.banner')).toBeVisible();
  // the failed code stays in the form
  await expect(page.getByLabel('Code de la salle')).toHaveValue('ZZZZZ');
  await page.getByLabel('Code de la salle').fill(code);
  await page.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(page.getByRole('alert')).toContainText('Cette salle est complète');
});
