import { expect, test } from '@playwright/test';

/**
 * Story 13.3: where bonuses and penalties come from. Dev scene `?scene=sources`: Sire Lancelot gets +20 ATQ from
 * Arthur's aura, +30 PV from the Camelot terrain, −30 ATQ from Heather and Megan (foe) and +100/+100 from the red
 * pill, a spell already in the graveyard, and +100 ATQ from the A.P.U, an equipment also gone (story 13.5).
 */
const LANCELOT = 'Sire Lancelot le Brave';
const VANDERGELD = 'Heather et Megan Vandergeld';

test('a modified badge counts its sources; selecting the card links each source in play', async ({ page }) => {
  await page.goto('/?scene=sources');
  const lancelot = page.locator('.board.mine').getByRole('button', { name: LANCELOT });
  await expect(lancelot.locator('.badge.atk .src-n')).toHaveText('4');
  await expect(lancelot.locator('.badge.hp .src-n')).toHaveText('2');

  await lancelot.click();
  // Arthur and Camelot (bonus, green), Heather and Megan (penalty, red); the pill has left the table: no line
  await expect(page.locator('.src-lines')).toHaveAttribute('data-count', '3');
  await expect(page.locator('.src-line.buff')).toHaveCount(2);
  await expect(page.locator('.src-line.malus')).toHaveCount(1);

  const sheet = page.getByRole('dialog', { name: LANCELOT });
  const mods = sheet.getByRole('region', { name: 'Bonus et malus' });
  await expect(mods.getByRole('listitem')).toHaveCount(5);
  // story 13.5: each line names the category of its source, with the cost-token icon
  expect((await mods.locator('.cat-tag').allTextContents()).sort()).toEqual(['Personnage', 'Personnage', 'Sort', 'Terrain', 'Équipement']);
  await expect(mods.locator('.cat-tag svg')).toHaveCount(5);
  await expect(mods.getByRole('button', { name: /Les pilules de Morpheus/ })).toContainText('carte partie');
  await expect(mods.getByRole('button', { name: /Camelot/ })).toContainText('tant qu’elle est en jeu');
  await mods.getByRole('button', { name: `${VANDERGELD} (Personnage) : Langue de vipère` }).click();
  const preview = page.getByRole('dialog', { name: `Aperçu : ${VANDERGELD}` });
  await expect(preview).toBeVisible();
  await expect(preview.locator('.ability.is-highlighted')).toContainText('Langue de vipère');
  await expect(page.locator('.board.theirs .slot.ref-glow')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();

  // the attack flow is unchanged: choose a target, the lines go away, the attack lands
  await sheet.getByRole('button', { name: 'Choisir une cible' }).click();
  await expect(page.locator('.src-lines')).toHaveCount(0);
  await page.locator('.board.theirs').getByRole('button', { name: VANDERGELD }).click();
  await expect(page.locator('.board.theirs').getByRole('button', { name: VANDERGELD })).toHaveCount(0, { timeout: 5000 });
});
