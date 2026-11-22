import { expect, test } from '@playwright/test';

/**
 * Story 13.3: where bonuses and penalties come from. Dev scene `?scene=sources`: Sire Lancelot gets +20 ATQ from
 * Arthur's aura, +30 PV from the Camelot terrain, −30 ATQ from Heather and Megan (foe) and +100/+100 from the red
 * pill, a spell already in the graveyard, and +100 ATQ from the A.P.U, an equipment also gone (story 13.5).
 * Story 13.9: the lines are drawn only on demand (a modified badge, a row of « Bonus et malus »), for ~3 s.
 */
const LANCELOT = 'Sire Lancelot le Brave';
const VANDERGELD = 'Heather et Megan Vandergeld';

test('a modified badge counts its sources; its lines show only when asked', async ({ page }) => {
  await page.goto('/?scene=sources');
  const lancelot = page.locator('.board.mine').getByRole('button', { name: LANCELOT });
  await expect(lancelot.locator('.badge.atk .src-n')).toHaveText('4');
  await expect(lancelot.locator('.badge.hp .src-n')).toHaveText('2');

  // story 13.9: tapping the modified ATK badge draws the lines to that stat's sources in play only:
  // Arthur (bonus, green) and Heather and Megan (penalty, red); Camelot (PV) and the departed pill and A.P.U: none
  await lancelot.locator('.badge.atk').click();
  await expect(page.locator('.src-lines')).toHaveAttribute('data-count', '2');
  await expect(page.locator('.src-line.buff')).toHaveCount(1);
  await expect(page.locator('.src-line.malus')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: LANCELOT })).toHaveCount(0);
  // the PV badge: Camelot only (the pill has left the table); the next tap replaces the lines
  await lancelot.locator('.badge.hp').click();
  await expect(page.locator('.src-lines')).toHaveAttribute('data-count', '1');
  await expect(page.locator('.src-line.buff')).toHaveCount(1);
  // they go away by themselves after about 3 s
  await expect(page.locator('.src-lines')).toHaveCount(0, { timeout: 4500 });

  // opening the sheet draws nothing
  await lancelot.click();
  const sheet = page.getByRole('dialog', { name: LANCELOT });
  await expect(sheet).toBeVisible();
  await expect(page.locator('.src-lines')).toHaveCount(0);
  // story 13.8: a table card opens the same full sheet as a hand card (no lowered sheet)
  await expect(sheet).not.toHaveClass(/peek/);
  const body = await sheet.locator('.sheet-body').boundingBox();
  expect(body!.height).toBeGreaterThan(844 * 0.6);

  const mods = sheet.getByRole('region', { name: 'Bonus et malus' });
  await expect(mods.getByRole('listitem')).toHaveCount(5);
  // story 13.5: each line names the category of its source, with the cost-token icon
  expect((await mods.locator('.cat-tag').allTextContents()).sort()).toEqual(['Personnage', 'Personnage', 'Sort', 'Terrain', 'Équipement']);
  await expect(mods.locator('.cat-tag svg')).toHaveCount(5);
  await expect(mods.getByRole('button', { name: /Les pilules de Morpheus/ })).toContainText('carte partie');
  await expect(mods.getByRole('button', { name: /Camelot/ })).toContainText('tant qu’elle est en jeu');

  // story 13.9: a row whose source is on the table tucks the sheet away and draws that one line
  await mods.getByRole('button', { name: `${VANDERGELD} (Personnage) : Langue de vipère` }).click();
  await expect(page.locator('.src-lines')).toHaveAttribute('data-count', '1');
  await expect(page.locator('.src-line.malus')).toHaveCount(1);
  await expect(sheet).toHaveClass(/tucked/);
  // the next tap ends the lines and brings the sheet back (it does not close it)
  await page.mouse.click(195, 300);
  await expect(page.locator('.src-lines')).toHaveCount(0);
  await expect(sheet).not.toHaveClass(/tucked/);
  await expect(sheet).toBeVisible();

  // a departed source still opens its preview (story 13.1)
  await mods.getByRole('button', { name: /Les pilules de Morpheus/ }).click();
  const preview = page.getByRole('dialog', { name: 'Aperçu : Les pilules de Morpheus' });
  await expect(preview).toBeVisible();
  await expect(page.locator('.src-lines')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();

  // the attack flow is unchanged: choose a target, the attack lands
  await sheet.getByRole('button', { name: 'Choisir une cible' }).click();
  await expect(page.locator('.src-lines')).toHaveCount(0);
  await page.locator('.board.theirs').getByRole('button', { name: VANDERGELD }).click();
  await expect(page.locator('.board.theirs').getByRole('button', { name: VANDERGELD })).toHaveCount(0, { timeout: 5000 });
});
