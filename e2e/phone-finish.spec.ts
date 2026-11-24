import { expect, test, type Page } from '@playwright/test';
import { openHand } from './hand.ts';

/**
 * Story 14.6: finishing touches of the compact phone table.
 * 1. The badge counting a modified stat's sources never covers the ATK or PV number of a table card.
 * 2. A terrain or spell name holds on its plate (two lines at most), with no vertical scroll.
 * 3. A card that arrives in the open hand is scrolled into view.
 */
const PHONES = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

/** Typical iPhone safe areas (Chromium reports none), as in safe-area.spec.ts. */
async function fakeSafeAreas(page: Page) {
  await page.locator('.table.compact').evaluate((e: HTMLElement) => {
    e.style.setProperty('--sa-t', '47px');
    e.style.setProperty('--sa-b', '34px');
  });
}

/** For each source-count badge on the table: does it meet the text of a stat number (its own badge's or the other's)? */
async function badgeHits(page: Page) {
  return page.evaluate(() => {
    const textRects = (badge: Element) => {
      const range = document.createRange();
      const rects: DOMRect[] = [];
      for (const n of badge.childNodes) {
        if (n.nodeType === Node.ELEMENT_NODE && ((n as Element).classList.contains('src-n') || (n as Element).tagName.toLowerCase() === 'svg')) continue;
        range.selectNodeContents(n);
        rects.push(...range.getClientRects());
      }
      return rects.filter((r) => r.width > 0);
    };
    const meets = (a: DOMRect, b: DOMRect) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    return [...document.querySelectorAll('.table .slot .src-n')].map((n) => {
      const card = n.closest('.card')!;
      const numbers = [...card.querySelectorAll('.card-stats .badge')].flatMap(textRects);
      const r = n.getBoundingClientRect();
      // the two numbers do not meet each other either (story 14.6: the PV badge used to cover the ATK)
      const [atk, hp] = [...card.querySelectorAll('.card-stats .badge')].map((b) => b.getBoundingClientRect());
      return {
        card: card.getAttribute('aria-label'),
        covers: numbers.some((q) => meets(r, q)),
        badgesMeet: !!atk && !!hp && atk.right > hp.left + 0.5,
        font: parseFloat(getComputedStyle(n.parentElement!).fontSize),
      };
    });
  });
}

for (const size of PHONES) {
  test(`${size.width}×${size.height}: source counts clear of the ATK and PV numbers`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const scene of ['sources', 'pleine']) {
      await page.goto(`/?scene=${scene}`);
      await expect(page.locator('.table .slot .src-n').first()).toBeVisible();
      if (scene === 'pleine') await fakeSafeAreas(page);
      await page.evaluate(() => document.fonts.ready.then(() => true)); // the names are measured in their own font
      const hits = await badgeHits(page);
      expect(hits.length).toBeGreaterThan(0);
      for (const h of hits) {
        expect(h.covers, `${scene}: ${h.card}`).toBe(false);
        expect(h.badgesMeet, `${scene}: ${h.card}`).toBe(false);
        expect(h.font).toBeGreaterThanOrEqual(9);
      }
    }
    // a modified badge still shows its sources' lines when tapped (story 13.9)
    await page.goto('/?scene=sources');
    await page.locator('.board.mine').getByRole('button', { name: 'Sire Lancelot le Brave' }).locator('.badge.atk').click();
    await expect(page.locator('.src-lines')).toHaveAttribute('data-count', '2');
  });

  test(`${size.width}×${size.height}: terrain and spell names hold on their plates`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/?scene=pleine');
    await expect(page.locator('.table .zplate')).toHaveCount(6);
    await fakeSafeAreas(page);
    await page.evaluate(() => document.fonts.ready.then(() => true)); // the names are measured in their own font
    const plates = await page.locator('.table .zplate').evaluateAll((els) =>
      els.map((plate) => {
        const zn = plate.querySelector<HTMLElement>('.zn')!;
        // the name laid out free (no line clamp) at the same width: how many lines it needs
        const free = zn.cloneNode(true) as HTMLElement;
        free.style.cssText = `display:block;-webkit-line-clamp:none;overflow:visible;position:absolute;visibility:hidden;width:${zn.getBoundingClientRect().width}px`;
        plate.appendChild(free);
        const lines = Math.round(free.getBoundingClientRect().height / parseFloat(getComputedStyle(zn).lineHeight));
        free.remove();
        const z = zn.getBoundingClientRect();
        const p = plate.getBoundingClientRect();
        return {
          name: plate.getAttribute('aria-label'),
          text: zn.textContent,
          lines,
          font: parseFloat(getComputedStyle(zn).fontSize),
          inside: z.top >= p.top - 0.5 && z.bottom <= p.bottom + 0.5,
          wide: zn.scrollWidth <= zn.clientWidth + 1,
        };
      }),
    );
    for (const p of plates) {
      expect(p.text).toBe(p.name);
      expect(p.lines, p.name!).toBeLessThanOrEqual(2);
      expect(p.inside, p.name!).toBe(true);
      expect(p.wide, p.name!).toBe(true);
      expect(p.font).toBeGreaterThanOrEqual(9);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
  });
}

for (const view of ['compact', 'detailed']) {
  test(`360×640, ${view} open hand: a drawn card is scrolled into view`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/?scene=pioche${view === 'detailed' ? '&handView=detailed' : ''}`);
    await expect(page.locator('.table .hand-btn')).toBeVisible();
    await openHand(page);
    const row = page.locator('.table .hand-row');
    await expect(row.locator('.card')).toHaveCount(9);
    // opening the hand does not scroll it
    expect(await row.evaluate((e) => e.scrollLeft)).toBe(0);
    const before = await row.locator('.card').evaluateAll((els) => els.map((e) => e.getAttribute('data-iid')));

    // the detailed hand covers the turn banner (story 14.3): the button is pressed without a pointer
    await page.getByRole('button', { name: 'Fin du tour' }).evaluate((b: HTMLElement) => b.click());
    await expect(page.getByRole('button', { name: 'Fin du tour' })).toBeEnabled({ timeout: 30000 });
    await expect(row.locator('.card')).toHaveCount(10);
    const iids = await row.locator('.card').evaluateAll((els) => els.map((e) => e.getAttribute('data-iid')));
    const drawn = iids.find((iid) => !before.includes(iid))!;
    const card = row.locator(`.card[data-iid="${drawn}"]`);
    // whole inside the row, left of its fading edge, once the scroll has ended
    await expect
      .poll(
        () =>
          card.evaluate((c) => {
            const r = c.getBoundingClientRect();
            const rowEl = c.closest('.hand-row')!;
            const box = rowEl.getBoundingClientRect();
            return r.left >= box.left - 1 && r.right <= box.left + rowEl.clientWidth * 0.88 + 1;
          }),
        { timeout: 3000 },
      )
      .toBe(true);
    await expect(card).toHaveCSS('opacity', '1');
  });
}
