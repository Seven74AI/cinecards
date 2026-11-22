import { expect, test } from '@playwright/test';

/**
 * Story 13.4: Néo's ATQ doubles every 2 of his owner's turns, and the bonus stacks. Dev scene `?scene=neo`: Néo
 * already doubled once (320 ATQ) and doubles again at the start of my next turn.
 */
test('the cycle badge announces the next doubling; at the start of my turn Néo goes from 320 to 640 ATQ', async ({ page }) => {
  await page.goto('/?scene=neo');
  const neo = page.locator('.board.mine .card').first();
  await expect(neo.locator('.st.cycle')).toHaveAttribute('title', 'ATQ doublée dans 1 tour');
  await expect(neo.locator('.st.cycle .x2')).toHaveText('×2');
  await expect(neo.locator('.badge.atk')).toContainText('320');

  await page.getByRole('button', { name: 'Fin du tour' }).click();
  await expect(page.getByRole('button', { name: 'Fin du tour' })).toBeEnabled({ timeout: 30000 });
  await expect(neo.locator('.badge.atk')).toContainText('640', { timeout: 5000 });
  await expect(neo.locator('.st.cycle')).toHaveAttribute('title', 'ATQ doublée ce tour · prochain doublement dans 2 tours');

  await page.getByRole('button', { name: 'Journal' }).click();
  await expect(page.locator('.journal')).toContainText('+320 ATQ');
  await expect(page.locator('.journal')).toContainText(/maximum d.armes/);
  await page.getByRole('button', { name: 'Fermer le journal' }).click();

  await neo.click();
  const sheet = page.getByRole('dialog').filter({ has: page.getByRole('region', { name: 'Bonus et malus' }) });
  const mods = sheet.getByRole('region', { name: 'Bonus et malus' });
  await expect(mods.getByRole('listitem')).toHaveCount(2);
  await expect(mods).toContainText('+160 ATQ');
  await expect(mods).toContainText('+320 ATQ');
  await expect(sheet.locator('.sheet-cycle')).toContainText('prochain doublement dans 2 tours');
});
