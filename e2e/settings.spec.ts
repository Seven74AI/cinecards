import { expect, test, type Page } from '@playwright/test';

/**
 * Story 14.4: the "Réglages" button of the top bar opens a small popover with "Main ouverte : Compacte | Détaillée".
 * The choice is kept on the device (`cinecards.handView`), an open hand switches view at once, Compacte by default.
 * The top bar still fits on a 360 px phone, solo and online (room code + emote button).
 * Set SHOTS_DIR to also save screenshots.
 */
const shot = async (page: Page, name: string) => {
  if (!process.env.SHOTS_DIR) return;
  await page.waitForTimeout(300); // the popover's fade-in
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` });
};

/** Every top bar item inside the bar, one after the other, nothing clipped, on one 44 px line. */
async function topbarFits(page: Page) {
  return page.locator('.table .topbar').evaluate((bar) => {
    const b = bar.getBoundingClientRect();
    const items = [...bar.children].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    const code = bar.querySelector<HTMLElement>('.room-code')!;
    const btns = [...bar.querySelectorAll<HTMLElement>('.icon-btn')].map((e) => e.getBoundingClientRect());
    return {
      inside: items.every((r) => r.left >= b.left - 0.5 && r.right <= b.right + 0.5),
      noOverlap: items.every((r, i) => i === 0 || r.left >= items[i - 1]!.right - 0.5),
      oneLine: items.every((r) => Math.abs(r.top + r.height / 2 - (b.top + b.height / 2)) < 1),
      codeWhole: code.scrollWidth <= code.clientWidth + 1,
      pageScrollsX: document.documentElement.scrollWidth > innerWidth,
      height: b.height,
      minButton: Math.min(...btns.flatMap((r) => [r.width, r.height])),
      gear: (() => {
        const g = bar.querySelector('.settings-btn')!.getBoundingClientRect();
        return { w: g.width, h: g.height };
      })(),
    };
  });
}

function expectFits(m: Awaited<ReturnType<typeof topbarFits>>) {
  expect(m.inside).toBe(true);
  expect(m.noOverlap).toBe(true);
  expect(m.oneLine).toBe(true);
  expect(m.codeWhole).toBe(true);
  expect(m.pageScrollsX).toBe(false);
  expect(m.height).toBe(44);
  expect(m.minButton).toBeGreaterThanOrEqual(44);
  expect(m.gear.w).toBeGreaterThanOrEqual(44);
  expect(m.gear.h).toBeGreaterThanOrEqual(44);
}

for (const size of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]) {
  test(`réglages ${size.width} × ${size.height}: switch the open hand to Détaillée, kept after a reload, Escape closes`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/?scene=pleine');
    expectFits(await topbarFits(page));
    // solo: the bar of the mockup, speed button included
    await expect(page.getByRole('button', { name: /Vitesse des animations/ })).toBeVisible();

    const gear = page.getByRole('button', { name: 'Réglages' });
    await expect(gear).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(gear).toHaveAttribute('aria-expanded', 'false');

    // open the hand first: it switches view while open
    await page.locator('.table .hand-btn').click();
    await expect(page.locator('.hand-panel .card-hand')).toHaveCount(10);

    await gear.click();
    const dialog = page.getByRole('dialog', { name: 'Réglages' });
    await expect(dialog).toBeVisible();
    await expect(gear).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog).toContainText('Main ouverte');
    await expect(dialog).toContainText('Retenu sur cet appareil.');
    const compacte = dialog.getByRole('button', { name: 'Compacte' });
    const detaillee = dialog.getByRole('button', { name: 'Détaillée' });
    await expect(compacte).toHaveAttribute('aria-pressed', 'true');
    await expect(detaillee).toHaveAttribute('aria-pressed', 'false');
    await expect(compacte).toBeFocused();
    // opaque, under the top bar, inside the screen
    const box = await dialog.evaluate((d) => {
      const r = d.getBoundingClientRect();
      return {
        top: r.top,
        left: r.left,
        right: r.right,
        bg: getComputedStyle(d).backgroundColor,
        bar: document.querySelector('.table .topbar')!.getBoundingClientRect().bottom,
      };
    });
    expect(box.bg).toBe('rgb(26, 16, 8)');
    expect(Math.abs(box.top - box.bar)).toBeLessThanOrEqual(1);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(size.width);

    await detaillee.click();
    await expect(detaillee).toHaveAttribute('aria-pressed', 'true');
    await expect(compacte).toHaveAttribute('aria-pressed', 'false');
    // the open hand behind shows full cards at once
    await expect(page.locator('.hand-panel')).toHaveClass(/\bdetailed\b/);
    await expect(page.locator('.hand-panel .card-full')).toHaveCount(10);
    expect(await page.evaluate(() => localStorage.getItem('cinecards.handView'))).toBe('detailed');
    await shot(page, `reglages-${size.width}x${size.height}`);

    // Escape closes and gives the focus back to the gear
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(gear).toBeFocused();
    await expect(gear).toHaveAttribute('aria-expanded', 'false');
    // the hand is still open
    await expect(page.locator('.hand-panel .card-full')).toHaveCount(10);

    // kept after a reload
    await page.reload();
    await page.locator('.table .hand-btn').click();
    await expect(page.locator('.hand-panel .card-full')).toHaveCount(10);
    await gear.click();
    await expect(detaillee).toHaveAttribute('aria-pressed', 'true');

    // back to Compacte
    await compacte.click();
    await expect(page.locator('.hand-panel')).not.toHaveClass(/\bdetailed\b/);
    await expect(page.locator('.hand-panel .card-hand')).toHaveCount(10);
    expect(await page.evaluate(() => localStorage.getItem('cinecards.handView'))).toBe('compact');

    // a tap on the gear again closes (it lands on the popover's backdrop), without folding the hand
    await gear.click({ force: true });
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.hand-panel .card-hand')).toHaveCount(10);
  });
}

test('réglages: a tap outside closes without touching the table', async ({ page }) => {
  await page.goto('/?scene=pleine');
  await page.locator('.table .hand-btn').click();
  await page.getByRole('button', { name: 'Réglages' }).click();
  const dialog = page.getByRole('dialog', { name: 'Réglages' });
  await expect(dialog).toBeVisible();
  // tap the first hand card through the popover's backdrop: it closes the popover only
  await page.locator('.hand-panel .card').first().click({ force: true });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('aside.sheet[role="dialog"]')).toHaveCount(0);
  await expect(page.locator('.hand-panel .card')).toHaveCount(10);
});

test('réglages on desktop: no gear, desktop unchanged (the hand is not folded there)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=pleine');
  await expect(page.locator('.table .hand .card').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réglages' })).toHaveCount(0);
  await expect(page.locator('.table .hand-btn')).toHaveCount(0);
  await expect(page.locator('.table .card-full')).toHaveCount(0);
});

test('top bar fits at 360 px in an online duel (room code, emotes, réglages)', async ({ browser }) => {
  const size = { width: 360, height: 640 };
  const alice = await (await browser.newContext({ viewport: size })).newPage();
  const bob = await (await browser.newContext({ viewport: size })).newPage();
  await alice.goto('/');
  await alice.getByRole('tab', { name: 'En ligne' }).click();
  await alice.getByLabel('Ton pseudo').fill('Alice');
  await alice.getByRole('button', { name: 'Créer un duel et inviter' }).click();
  const code = (await alice.locator('.big-code').textContent())!.trim();
  await bob.goto(`/?salle=${code}`);
  await bob.getByLabel('Ton pseudo').fill('Bob');
  await bob.getByRole('button', { name: 'Rejoindre' }).click();
  for (const page of [alice, bob]) {
    await expect(page.locator('.banner')).toBeVisible();
    await expect(page.locator('.table .room-code')).toContainText(code);
    await expect(page.getByRole('button', { name: 'Répliques' })).toBeVisible();
    expectFits(await topbarFits(page));
  }
  // the widest code the server can deal (5 letters) still fits
  await alice.locator('.table .room-code').evaluate((e) => {
    e.lastChild!.textContent = 'WWWWW';
  });
  expectFits(await topbarFits(alice));
  await alice.locator('.table .room-code').evaluate((e, c) => {
    e.lastChild!.textContent = c;
  }, code);
  await shot(alice, 'topbar-online-360');
  // no room left for the speed button: the speed is chosen in Réglages (kept like the button's choice)
  await expect(alice.getByRole('button', { name: /Vitesse des animations/ })).toHaveCount(0);
  await alice.getByRole('button', { name: 'Réglages' }).click();
  const dialog = alice.getByRole('dialog', { name: 'Réglages' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Vitesse normale' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Vitesse rapide' }).click();
  await expect(dialog.getByRole('button', { name: 'Vitesse rapide' })).toHaveAttribute('aria-pressed', 'true');
  expect(await alice.evaluate(() => localStorage.getItem('cinecards.animSpeed'))).toBe('fast');
  await shot(alice, 'reglages-online-360');
});
